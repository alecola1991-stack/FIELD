import test from 'node:test';
import assert from 'node:assert/strict';
import { GamepadController, padAxes } from '../src/game/GamepadController.js';
import { MENU_PLAYLIST, goalExcitement } from '../src/game/MenuPlaylist.js';
import { Sound, audioLevel } from '../src/game/Sound.js';
import { WORLD } from '../src/config/settings.js';
import { Input } from '../src/game/Input.js';
import { Player } from '../src/game/Player.js';

let pads=[];
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{getGamepads:()=>pads}});
globalThis.document={visibilityState:'visible',hasFocus:()=>true,getElementById:()=>null,activeElement:null,querySelectorAll:()=>[],addEventListener(){}};
globalThis.window={addEventListener(){}};
function pad(id='Xbox Controller'){return {id,index:0,connected:true,axes:[0,0],buttons:Array.from({length:18},()=>({pressed:false}))};}
function controller(){const c=Object.create(GamepadController.prototype);Object.assign(c,{index:0,previous:Array(18).fill(false),lastView:'game',direction:'',nextMove:0,mappingStep:-1,
 ui:{currentView:'game',settings:{controllerMap:{}},game:{input:new Input(),state:{paused:false,matchOver:false}},sound:{unlock(){}},pause(value){this.game.state.paused=value;}}});return c;}

test('PlayStation and Xbox standard layouts support sticks, deadzone and D-pad',()=>{
 for(const id of ['DualShock 4 (054c)','DualSense PS5','Xbox Wireless Controller']) {
  const p=pad(id);p.axes=[.1,-.1];assert.deepEqual(padAxes(p),{x:0,y:0});
  p.axes=[1,0];assert.deepEqual(padAxes(p),{x:1,y:0});
  p.axes=[1,1];const diagonal=padAxes(p);assert.ok(Math.hypot(diagonal.x,diagonal.y)<=1.01);
  p.buttons[12].pressed=true;assert.deepEqual(padAxes(p),{x:0,y:-1});
 }
});
test('gamepad shots use press edges, pause once and clear movement after disconnect',()=>{
 const c=controller(),p=pad();pads=[p];p.axes=[1,0];p.buttons[0].pressed=true;c.poll(0);
 assert.equal(c.ui.game.input.consume('Space'),true);assert.deepEqual(c.ui.game.input.axes(),{x:1,y:0});
 c.poll(16);assert.equal(c.ui.game.input.consume('Space'),false);
 p.buttons[9].pressed=true;c.poll(32);assert.equal(c.ui.game.state.paused,true);
 pads=[];c.poll(48);assert.deepEqual(c.ui.game.input.padAxes,{x:0,y:0});
});
test('keyboard overrides a connected stick and disabled gameplay ignores both',()=>{
 const input=new Input();input.padAxes={x:.8,y:.1};assert.deepEqual(input.axes(),input.padAxes);
 input.press('KeyA');assert.deepEqual(input.axes(),{x:-1,y:0});input.enabled=false;assert.deepEqual(input.axes(),{x:0,y:0});
});
test('analog movement limits slow-stick speed without changing full keyboard speed',()=>{
 const p=new Player({x:0,y:0,name:'P'});p.move(.3,0,1);assert.ok(Math.hypot(p.vx,p.vy)<=p.maxSpeed*.3);
 const fast=new Player({x:0,y:0,name:'P'});fast.move(1,0,.1);assert.ok(fast.vx>0);
});
test('stadium excitement increases near both goals and respects vertical distance and modified geometry',()=>{
 assert.equal(goalExcitement({x:WORLD.width/2,y:WORLD.height/2},WORLD),0);
 assert.equal(goalExcitement({x:WORLD.left,y:WORLD.height/2},WORLD),1);
 assert.equal(goalExcitement({x:WORLD.right,y:WORLD.height/2},WORLD),1);
 assert.ok(goalExcitement({x:WORLD.left+20,y:WORLD.height/2},WORLD)>goalExcitement({x:WORLD.left+160,y:WORLD.height/2},WORLD));
 assert.equal(goalExcitement({x:WORLD.left,y:WORLD.goalTop-300},WORLD),0);
 assert.equal(goalExcitement(null,WORLD),0);
});
test('playlist has four distinct original themes and volume never exceeds the safe range',()=>{
 assert.equal(new Set(MENU_PLAYLIST.map(song=>song.name)).size,4);
 for(const song of MENU_PLAYLIST){assert.equal(song.melody.length,16);assert.equal(song.roots.length,4);assert.ok(song.bpm>0);}
 assert.equal(audioLevel(-10),0);assert.equal(audioLevel(300),1);assert.equal(audioLevel('bad',35),.35);
});
test('music is scheduled only in menus and the stadium bus is independent',()=>{
 const values={};const param=key=>({value:0,setTargetAtTime(v){values[key]=v;}});
 const sound=Object.create(Sound.prototype);let notes=0;
 Object.assign(sound,{track:0,step:0,nextNote:0,scene:'menu',voices:new Set(),excitement:1,matchActive:true,
 getSettings:()=>({sound:true,volume:100,musicVolume:35,ambienceVolume:50}),
 ctx:{state:'running',currentTime:10},master:{gain:param('master')},music:{gain:param('music')},crowd:{gain:param('crowd')},note(){notes++;}});
 sound.tick();assert.ok(notes>0);assert.equal(values.music,.35);assert.equal(values.crowd,0);
 notes=0;sound.setScene('game');sound.tick();assert.equal(notes,0);assert.equal(values.music,0);assert.ok(values.crowd>0);
 sound.getSettings=()=>({sound:false,volume:100});sound.tick();assert.equal(values.master,0);assert.equal(values.crowd,0);
});
