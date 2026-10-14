import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MENU_PLAYLIST } from '../src/game/MenuPlaylist.js';
import { MenuMusic } from '../src/game/MenuMusic.js';
const songs=MENU_PLAYLIST.map(track=>({...track,parts:undefined}));
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 const listeners={};const audio={paused:true,loads:0,plays:0,addEventListener(name,fn){listeners[name]=fn;},load(){this.loads++;},pause(){this.paused=true;},async play(){this.plays++;this.paused=false;}};
 let ends=0;const music=new MenuMusic({createMediaElementSource:()=>({connect(){}})},{},()=>ends++,audio);
 return {music,audio,listeners,ends:()=>ends};
}
test('all bundled tracks are actual MP3 files with audio frames',()=>{
 for(const track of MENU_PLAYLIST){const data=Buffer.concat((track.parts||[track.src]).map(url=>readFileSync(new URL(url))));assert.ok(data.length>50000);assert.equal(data.subarray(0,3).toString(),'ID3');assert.ok(data.some((byte,i)=>byte===255&&(data[i+1]&224)===224));}
});
test('recordings play once, pause in gameplay, resume, and advance on ending',async()=>{
 const {music,audio,listeners,ends}=fixture();music.sync(true,songs[0]);await flush();
 assert.equal(audio.plays,1);assert.equal(audio.loads,1);music.sync(true,songs[0]);await flush();assert.equal(audio.plays,1);
 music.sync(false,songs[0]);assert.equal(audio.paused,true);listeners.ended();assert.equal(ends(),0);
 music.sync(true,songs[0]);await flush();listeners.ended();assert.equal(ends(),1);
 music.sync(true,songs[1]);await flush();assert.equal(audio.src,MENU_PLAYLIST[1].src);assert.equal(audio.loads,2);
});
test('autoplay rejection waits for a gesture and pending play cannot restart a paused game',async()=>{
 const {music,audio}=fixture();audio.play=async()=>{audio.plays++;throw Object.assign(new Error(),{name:'NotAllowedError'});};
 music.sync(true,songs[0]);await flush();assert.equal(music.blocked,true);music.sync(true,songs[0]);await flush();assert.equal(audio.plays,1);
 music.unlock();audio.play=async()=>{audio.plays++;audio.paused=false;};music.sync(true,songs[0]);music.sync(false,songs[0]);await flush();assert.equal(audio.paused,true);
});
test('large recording parts are joined intact and an old download cannot replace a newer track',async()=>{
 const {audio}=fixture();let created=0,revoked=0;
 const blobs=[];const urls={createObjectURL(blob){blobs.push(blob);return 'blob:recording-'+(++created);},revokeObjectURL(){revoked++;}};
 const music=new MenuMusic({createMediaElementSource:()=>({connect(){}})},{},()=>{},audio,
 async function(url){assert.equal(this,globalThis,'native browser fetch requires the window receiver');return {ok:true,arrayBuffer:async()=>readFileSync(new URL(url))};},urls);
 music.sync(true,MENU_PLAYLIST[0]);await flush();await flush();
 assert.equal(created,1);assert.equal(audio.paused,false);
 const data=Buffer.from(await blobs[0].arrayBuffer());
 const {createHash}=await import('node:crypto');
 assert.equal(createHash('sha256').update(data).digest('hex'),'1b8e354e55092e9e99cb28d1cb905e6d01406d12ed1695a2a7ed2a067220c494');
 music.sync(true,MENU_PLAYLIST[1]);await flush();assert.equal(revoked,1);assert.equal(audio.src,MENU_PLAYLIST[1].src);
 music.sync(true,MENU_PLAYLIST[0]);music.sync(true,MENU_PLAYLIST[2]);await flush();await flush();
 assert.equal(created,1);assert.equal(audio.src,MENU_PLAYLIST[2].src);
});
