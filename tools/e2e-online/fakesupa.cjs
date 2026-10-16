// Local stand-in for Supabase used by the end-to-end tests:
//  * REST: /rest/v1/rpc/field_online runs the real SQL on the local Postgres as the JWT user.
//  * Auth: minimal /auth/v1 endpoints (sessions are preloaded in the browser).
//  * Realtime: Phoenix v2 protocol over WebSocket with broadcast (text and binary),
//    presence and private-channel authorization through field_private.channel_access.
// Test controls: POST /__drop?user=<id> closes that user's sockets; GET /__stats.
const http = require('node:http');
const { Pool } = require('pg');
const { WebSocketServer } = require('ws');

function startFakeSupabase({ port = 54321, latency = 0, log = () => {} } = {}) {
  const pool = new Pool({ host: process.env.PGHOST || '/tmp', port: Number(process.env.PGPORT || 5499), user: process.env.PGUSER || 'postgres', database: process.env.PGDATABASE || 'field', max: 12 });
  const stats = { rpc: 0, rpcErrors: [], broadcasts: 0, httpBroadcasts: 0, joins: 0, joinDenied: 0, presence: 0 };
  const decodeSub = token => { try { return JSON.parse(Buffer.from(String(token).split('.')[1], 'base64url').toString()).sub; } catch { return null; } };
  const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'Access-Control-Expose-Headers': '*' };
  const send = (res, status, body) => { res.writeHead(status, { ...cors, 'Content-Type': 'application/json' }); res.end(body === undefined ? '' : JSON.stringify(body)); };

  async function asUser(sub, sql, params) {
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query("select set_config('request.jwt.claim.sub',$1,true)", [sub || '']);
      await client.query('set local role authenticated');
      const result = await client.query(sql, params);
      await client.query('commit');
      return result.rows;
    } catch (error) { await client.query('rollback').catch(() => {}); throw error; }
    finally { client.release(); }
  }

  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const url = new URL(req.url, 'http://localhost');
    let body = '';
    for await (const chunk of req) body += chunk;
    const sub = decodeSub((req.headers.authorization || '').replace(/^Bearer /, ''));
    try {
      if (url.pathname === '/__drop') {
        let closed = 0;
        for (const ws of sockets) if (ws.sub === url.searchParams.get('user')) { ws.terminate(); closed++; }
        return send(res, 200, { closed });
      }
      if (url.pathname === '/__stats') return send(res, 200, stats);
      if (url.pathname === '/auth/v1/settings') return send(res, 200, { external: { google: false, email: true } });
      if (url.pathname === '/auth/v1/user') return sub ? send(res, 200, { id: sub, aud: 'authenticated', role: 'authenticated', email: `${sub.slice(0, 8)}@test.local` }) : send(res, 401, { message: 'no session' });
      if (url.pathname === '/auth/v1/logout') return send(res, 204);
      if (url.pathname === '/rest/v1/rpc/field_online') {
        stats.rpc++;
        const { action, payload } = JSON.parse(body || '{}');
        if (latency) await new Promise(r => setTimeout(r, latency));
        try {
          const rows = await asUser(sub, 'select public.field_online($1,$2::jsonb) as r', [action, JSON.stringify(payload || {})]);
          return send(res, 200, rows[0].r);
        } catch (error) {
          stats.rpcErrors.push({ action, message: error.message });
          return send(res, 400, { code: error.code || 'P0001', message: error.message, details: null, hint: null });
        }
      }
      if (url.pathname === '/rest/v1/rpc/save_player_profile') return send(res, 204);
      if (url.pathname === '/rest/v1/player_profiles') return send(res, 200, []);
      if (url.pathname === '/rest/v1/online_match_results') return send(res, req.method === 'GET' ? 200 : 201, []);
      if (url.pathname.endsWith('/api/broadcast')) { stats.httpBroadcasts++; return send(res, 202, {}); }
      log('404', req.method, url.pathname);
      return send(res, 404, { message: 'not found' });
    } catch (error) { log('server error', error); return send(res, 500, { message: error.message }); }
  });

  // ---- Realtime ---------------------------------------------------------------
  const wss = new WebSocketServer({ noServer: true });
  const sockets = new Set();
  const topics = new Map(); // topic -> Map(ws -> { joinRef, key, metas, self })
  let refCounter = 0;
  server.on('upgrade', (req, socket, head) => {
    if (!req.url.startsWith('/realtime/')) { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, req));
  });
  const deliver = (ws, data) => {
    if (ws.readyState !== 1) return;
    if (latency) setTimeout(() => ws.readyState === 1 && ws.send(data), latency); else ws.send(data);
  };
  const text = (ws, joinRef, ref, topic, event, payload) => deliver(ws, JSON.stringify([joinRef, ref, topic, event, payload]));
  const reply = (ws, joinRef, ref, topic, status = 'ok', response = {}) => { if (ref !== null && ref !== undefined && ref !== '') text(ws, joinRef, ref, topic, 'phx_reply', { status, response }); };
  const presenceOf = members => {
    const state = {};
    for (const member of members.values()) if (member.metas.length) state[member.key] = { metas: member.metas };
    return state;
  };
  const presenceDiff = (topic, joins, leaves) => {
    const members = topics.get(topic); if (!members) return;
    stats.presence++;
    for (const [ws, member] of members) text(ws, member.joinRef, null, topic, 'presence_diff', { joins, leaves });
  };
  const leaveTopic = (ws, topic) => {
    const members = topics.get(topic); const member = members?.get(ws);
    if (!member) return;
    members.delete(ws);
    if (member.metas.length) presenceDiff(topic, {}, { [member.key]: { metas: member.metas } });
    if (!members.size) topics.delete(topic);
  };
  const relay = (fromWs, topic, build) => {
    const members = topics.get(topic); if (!members) return;
    stats.broadcasts++;
    const self = members.get(fromWs)?.self;
    for (const [ws] of members) if (ws !== fromWs || self) deliver(ws, build());
  };

  wss.on('connection', ws => {
    sockets.add(ws);
    ws.on('close', () => { sockets.delete(ws); for (const topic of [...topics.keys()]) leaveTopic(ws, topic); });
    ws.on('message', async (data, isBinary) => {
      if (isBinary) {
        const buf = Buffer.from(data); let o = 0;
        const kind = buf[o++]; if (kind !== 3) return;
        const jl = buf[o++], rl = buf[o++], tl = buf[o++], el = buf[o++], ml = buf[o++], enc = buf[o++];
        const joinRef = buf.slice(o, o += jl).toString(), ref = buf.slice(o, o += rl).toString();
        const topic = buf.slice(o, o += tl).toString(), event = buf.slice(o, o += el).toString(), meta = buf.slice(o, o += ml);
        const payload = buf.slice(o);
        if (!topics.get(topic)?.has(ws)) return;
        relay(ws, topic, () => {
          const t = Buffer.from(topic), e = Buffer.from(event);
          return Buffer.concat([Buffer.from([4, t.length, e.length, meta.length, enc]), t, e, meta, payload]);
        });
        if (ref) reply(ws, joinRef, ref, topic);
        return;
      }
      let message; try { message = JSON.parse(data.toString()); } catch { return; }
      const [joinRef, ref, topic, event, payload] = message;
      if (event === 'heartbeat') return reply(ws, null, ref, 'phoenix');
      if (event === 'access_token') return reply(ws, joinRef, ref, topic);
      if (event === 'phx_join') {
        const config = payload?.config || {};
        ws.sub = decodeSub(payload?.access_token) || ws.sub;
        stats.joins++;
        if (config.private) {
          let allowed = false;
          try { allowed = (await asUser(ws.sub, 'select field_private.channel_access($1) as ok', [topic.replace(/^realtime:/, '')]))[0]?.ok; } catch (error) { log('auth error', error.message); }
          if (!allowed) { stats.joinDenied++; return reply(ws, joinRef, ref, topic, 'error', { reason: 'Unauthorized: You do not have permissions to read from this Channel topic' }); }
        }
        if (!topics.has(topic)) topics.set(topic, new Map());
        topics.get(topic).set(ws, { joinRef, key: config.presence?.key || `k${++refCounter}`, metas: [], self: !!config.broadcast?.self });
        reply(ws, joinRef, ref, topic, 'ok', { postgres_changes: [] });
        text(ws, joinRef, null, topic, 'presence_state', presenceOf(topics.get(topic)));
        return;
      }
      if (event === 'phx_leave') { leaveTopic(ws, topic); return reply(ws, joinRef, ref, topic); }
      const member = topics.get(topic)?.get(ws);
      if (!member) return reply(ws, joinRef, ref, topic, 'error', { reason: 'not joined' });
      if (event === 'presence') {
        if (payload?.event === 'track') {
          const leaves = member.metas.length ? { [member.key]: { metas: member.metas } } : {};
          member.metas = [{ ...payload.payload, phx_ref: `p${++refCounter}` }];
          if (Object.keys(leaves).length) presenceDiff(topic, {}, leaves);
          presenceDiff(topic, { [member.key]: { metas: member.metas } }, {});
        } else if (payload?.event === 'untrack' && member.metas.length) {
          const metas = member.metas; member.metas = []; presenceDiff(topic, {}, { [member.key]: { metas } });
        }
        return reply(ws, joinRef, ref, topic);
      }
      if (event === 'broadcast') {
        relay(ws, topic, () => JSON.stringify([null, null, topic, 'broadcast', payload]));
        return reply(ws, joinRef, ref, topic);
      }
      reply(ws, joinRef, ref, topic);
    });
  });

  return new Promise(resolve => server.listen(port, () => resolve({
    stats, pool, sockets,
    close: async () => { for (const ws of sockets) ws.terminate(); server.close(); await pool.end(); },
  })));
}

module.exports = { startFakeSupabase };
