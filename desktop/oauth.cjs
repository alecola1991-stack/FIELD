// Google sign-in for the desktop app (OAuth with PKCE through the system browser).
// The game asks Supabase for the Google URL with redirectTo pointing at a tiny server on this
// computer (127.0.0.1, fixed ports so they can be allowed in Supabase); the browser comes back
// with ?code=…, which the game exchanges for a session. Nothing else is served.
const http = require('node:http');

const PORTS = [47821, 47822, 47823];
const CALLBACK = '/auth/callback';
const page = (title, text) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${title}</title>
<meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1115;color:#ecf3ef;font:16px system-ui,sans-serif;text-align:center}
main{max-width:420px;padding:32px;border:1px solid #ffffff1f;border-radius:18px;background:#111a1f}h1{font-size:24px;margin:0 0 10px;color:#65e6a5}p{color:#a5b2aa;line-height:1.6;margin:0}</style></head>
<body><main><h1>${title}</h1><p>${text}</p></main></body></html>`;

function listen(server, port) {
  return new Promise((resolve, reject) => {
    const failed = error => { server.off('listening', ok); reject(error); };
    const ok = () => { server.off('error', failed); resolve(); };
    server.once('error', failed); server.once('listening', ok);
    server.listen(port, '127.0.0.1');
  });
}

// Starts the callback server on the first free port. wait() resolves with { code } or
// { error } once the browser comes back (or { error } after `timeout` ms); close() stops it.
async function startCallback({ ports = PORTS, timeout = 5 * 60 * 1000 } = {}) {
  let settle; const result = new Promise(resolve => { settle = resolve; });
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (request.method !== 'GET' || url.pathname !== CALLBACK) { response.writeHead(404, { Connection: 'close' }).end(); return; }
    const code = url.searchParams.get('code'), error = url.searchParams.get('error_description') || url.searchParams.get('error');
    const ok = !!code && /^[A-Za-z0-9._~-]{8,512}$/.test(code);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', Connection: 'close' });
    response.end(ok ? page('Sesión iniciada', 'Ya puedes cerrar esta pestaña y volver a Fútbol arcade.')
      : page('No se pudo iniciar sesión', 'Vuelve a Fútbol arcade e inténtalo de nuevo.'));
    settle(ok ? { code } : { error: error || 'Google no devolvió el acceso.' });
  });
  let port = null;
  for (const candidate of ports) {
    try { await listen(server, candidate); port = candidate; break; } catch { /* port busy: try the next one */ }
  }
  if (!port) throw new Error('No se pudo preparar el inicio de sesión (puertos ocupados). Cierra otras copias del juego e inténtalo de nuevo.');
  const timer = setTimeout(() => settle({ error: 'Se agotó el tiempo para iniciar sesión con Google.' }), timeout);
  timer.unref?.();
  return {
    redirectTo: `http://127.0.0.1:${port}${CALLBACK}`,
    wait: () => result,
    cancel: () => settle({ error: 'Inicio de sesión cancelado.' }),
    close: () => { clearTimeout(timer); server.close(); server.closeAllConnections?.(); },
  };
}

// Only Supabase's Google authorize URL may be opened in the browser.
function isGoogleAuthorizeUrl(value, redirectTo) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && /\.supabase\.co$/.test(url.hostname) && url.pathname === '/auth/v1/authorize'
      && url.searchParams.get('provider') === 'google' && url.searchParams.get('redirect_to') === redirectTo;
  } catch { return false; }
}

module.exports = { PORTS, CALLBACK, startCallback, isGoogleAuthorizeUrl };
