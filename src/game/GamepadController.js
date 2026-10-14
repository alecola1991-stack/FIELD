export const DEFAULT_PAD_MAP = Object.freeze({ shoot: 0, confirm: 0, cancel: 1, pause: 9 });
export function padAxes(pad, deadzone = .2) {
  let x = Number(pad?.axes?.[0]) || 0, y = Number(pad?.axes?.[1]) || 0;
  const pressed = i => Boolean(pad?.buttons?.[i]?.pressed);
  if (pressed(14) || pressed(15) || pressed(12) || pressed(13)) { x = Number(pressed(15))-Number(pressed(14)); y = Number(pressed(13))-Number(pressed(12)); }
  const length = Math.hypot(x,y); if (length <= deadzone) return { x: 0, y: 0 };
  const amount = Math.min(1,(length-deadzone)/(1-deadzone));
  return { x: Math.round(x/length*amount*100)/100, y: Math.round(y/length*amount*100)/100 };
}
export class GamepadController {
  constructor(ui) {
    this.ui=ui; this.index=null; this.previous=[]; this.nextMove=0; this.direction=''; this.lastView=''; this.mappingStep=-1;
    this.boundPoll = time => { this.poll(time); this.frame=requestAnimationFrame(this.boundPoll); };
    window.addEventListener('blur', () => { this.ui.game.input.padAxes={x:0,y:0}; this.previous=[]; });
    this.frame=requestAnimationFrame(this.boundPoll);
  }
  status(text) { const node=document.getElementById('controller-status'); if(node) node.textContent=text; }
  startMapping() { if(this.index===null) { this.status('Conecta el mando y pulsa un botón antes de configurar.'); return; } this.mappingStep=0; this.custom={}; this.status('Pulsa el botón que quieras usar para disparar.'); }
  resetMapping() { this.ui.settings.controllerMap={...DEFAULT_PAD_MAP}; this.mappingStep=-1; this.ui.persist(); this.status('Botones restablecidos: ✕ / A disparar; ○ / B volver; Options / Menu pausar.'); }
  poll(time) {
    let pads=[]; try { pads=[...(navigator.getGamepads?.() || [])].filter(p=>p?.connected!==false && p); } catch {}
    const pad=pads.find(p=>p.index===this.index) || pads.find(p=>p.buttons.some(b=>b.pressed)) || pads[0];
    if(!pad || document.visibilityState==='hidden' || (document.hasFocus && !document.hasFocus())) { this.ui.game.input.padAxes={x:0,y:0}; if(pad)this.previous=pad.buttons.map(b=>Boolean(b.pressed)); if(!pad && this.index!==null){this.index=null;this.previous=[];this.status('Mando desconectado. Puedes seguir con teclado o controles táctiles.');} return; }
    if(pad.index!==this.index) { this.index=pad.index; this.previous=pad.buttons.map(b=>Boolean(b.pressed)); this.status(`${/054c|dual|playstation|sony/i.test(pad.id)?'PlayStation':/xbox|xinput|045e/i.test(pad.id)?'Xbox':'Mando'} conectado · stick / cruceta para moverte.`); }
    const pressed=pad.buttons.map(b=>Boolean(b.pressed)), edge=i=>pressed[i]&&!this.previous[i];
    const map={...DEFAULT_PAD_MAP,...this.ui.settings.controllerMap};
    const changedView=this.lastView!==this.ui.currentView; this.lastView=this.ui.currentView;
    if(this.mappingStep>=0) {
      const button=pressed.findIndex((value,i)=>value&&!this.previous[i]);
      if(button>=0){ const actions=['shoot','confirm','cancel','pause'];this.custom[actions[this.mappingStep++]]=button;
        if(this.mappingStep===4){this.ui.settings.controllerMap=this.custom;this.ui.persist();this.mappingStep=-1;this.status('Configuración del mando guardada.');}
        else this.status(['','Pulsa el botón para aceptar en los menús.','Pulsa el botón para volver / cancelar.','Pulsa el botón para pausar.'][this.mappingStep]);
      }
      this.ui.game.input.padAxes={x:0,y:0}; this.previous=pressed; return;
    }
    const game=this.ui.currentView==='game', running=game&&!this.ui.game.state.paused&&!this.ui.game.state.matchOver;
    this.ui.game.input.padAxes=running?padAxes(pad):{x:0,y:0};
    if(!changedView && running && (edge(map.shoot)||edge(5)||edge(7))) { this.ui.game.input.pressed.add('Space'); this.rumble(.25,70); this.ui.sound.unlock?.(); }
    if(edge(map.pause) && game && !this.ui.game.state.matchOver) this.ui.pause(!this.ui.game.state.paused);
    else if(!changedView && !running) {
      const axes=padAxes(pad,.35); const direction=Math.abs(axes.x)>Math.abs(axes.y)? axes.x>0?'right':axes.x<0?'left':'':axes.y>0?'down':axes.y<0?'up':'';
      if(direction && (direction!==this.direction || time>=this.nextMove)){this.navigate(direction);this.nextMove=time+(direction!==this.direction?350:145);} this.direction=direction;
      if(edge(map.confirm)) { const active=document.activeElement; if(!this.controls().includes(active))this.controls()[0]?.focus(); else if(active?.matches('input[type="checkbox"]')){active.click();} else if(active?.matches('select')) this.adjust(active,1); else if(active?.matches('input:not([type="range"]),textarea')) this.openKeyboard(active); else active?.click?.(); this.ui.sound.unlock?.(); }
      if(edge(map.cancel)) this.back();
    }
    this.previous=pressed;
  }
  controls() {
    const root=this.keyboard || (this.ui.currentView==='game' ? (this.ui.game.state.matchOver?this.ui.result_overlay:this.ui.pause_overlay) : this.ui.screens[this.ui.currentView]);
    return [...(root?.querySelectorAll('button,a,input,select,[tabindex="0"]')||[])].filter(n=>!n.disabled && n.getBoundingClientRect().width>0 && getComputedStyle(n).visibility!=='hidden');
  }
  adjust(control,delta) {
    if(control.matches('select')) { const options=[...control.options].filter(o=>!o.disabled); const index=options.indexOf(control.selectedOptions[0]); if(options.length)control.value=options[Math.max(0,Math.min(options.length-1,index+delta))].value; }
    else { const step=Number(control.step)||1; control.value=String(Math.max(Number(control.min)||0,Math.min(Number(control.max)||100,Number(control.value)+delta*step))); }
    control.dispatchEvent(new Event('input',{bubbles:true})); control.dispatchEvent(new Event('change',{bubbles:true}));
  }
  navigate(direction) {
    const controls=this.controls(), active=document.activeElement;
    if(!controls.length)return;
    if(controls.includes(active) && (direction==='left'||direction==='right') && active.matches('input[type="range"],select')) {this.adjust(active,direction==='right'?1:-1);return;}
    if(!controls.includes(active)){controls[0].focus();controls[0].scrollIntoView({block:'nearest'});return;}
    const a=active.getBoundingClientRect(), ax=a.left+a.width/2, ay=a.top+a.height/2;
    const candidates=controls.filter(n=>n!==active).map(node=>{const r=node.getBoundingClientRect();const dx=r.left+r.width/2-ax,dy=r.top+r.height/2-ay;const primary=direction==='right'?dx:direction==='left'?-dx:direction==='down'?dy:-dy;return {node,primary,score:primary+Math.abs(direction==='left'||direction==='right'?dy:dx)*2};}).filter(n=>n.primary>4).sort((a,b)=>a.score-b.score);
    const next=candidates[0]?.node || controls[(controls.indexOf(active)+(direction==='up'||direction==='left'?-1:1)+controls.length)%controls.length];
    next.focus();next.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  rumble(strength=.4,duration=180) {
    if(this.ui.settings.controllerVibration===false)return;
    try {const pad=navigator.getGamepads?.()[this.index];pad?.vibrationActuator?.playEffect?.('dual-rumble',{duration,strongMagnitude:strength,weakMagnitude:strength*.7})?.catch(()=>{});}catch{}
  }
  openKeyboard(input) {
    if(this.keyboard)return;this.keyboardInput=input;this.uppercase=false;
    const box=document.createElement('div');box.className='controller-keyboard';box.setAttribute('role','dialog');box.setAttribute('aria-modal','true');box.setAttribute('aria-label','Teclado para mando');
    const title=document.createElement('h3');title.textContent='Teclado con mando';this.keyboardText=document.createElement('p');
    const grid=document.createElement('div');grid.className='controller-keyboard-grid';
    const chars=input.type==='number'?'0123456789':'abcdefghijklmnopqrstuvwxyzñ0123456789@._-!?#$';
    for(const char of chars){const button=document.createElement('button');button.type='button';button.textContent=char;button.addEventListener('click',()=>this.typeKeyboard(this.uppercase?char.toUpperCase():char));grid.append(button);}
    const actions=document.createElement('div');actions.className='social-actions';
    for(const [label,callback] of [['Mayúsculas',()=>{this.uppercase=!this.uppercase;}],['Espacio',()=>this.typeKeyboard(' ')],['Borrar',()=>{input.value=input.value.slice(0,-1);this.updateKeyboard();}],['Listo',()=>this.closeKeyboard()]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',callback);actions.append(button);}
    box.append(title,this.keyboardText,grid,actions);document.body.append(box);this.keyboard=box;this.updateKeyboard();grid.querySelector('button')?.focus();
  }
  typeKeyboard(char) {const input=this.keyboardInput,limit=input.maxLength>0?input.maxLength:100;if(input.value.length<limit)input.value+=char;this.updateKeyboard();}
  updateKeyboard() {const input=this.keyboardInput;this.keyboardText.textContent=input.type==='password'?'•'.repeat(input.value.length):input.value || 'Introduce el texto';input.dispatchEvent(new Event('input',{bubbles:true}));}
  closeKeyboard() {const input=this.keyboardInput;this.keyboard?.remove();this.keyboard=null;this.keyboardInput=null;input?.dispatchEvent(new Event('change',{bubbles:true}));input?.focus();}
  back() {
    if(this.keyboard){this.closeKeyboard();return;}
    if(this.ui.currentView==='modifiers'){this.ui.closeModifiers();return;}
    if(this.ui.currentView==='game'){if(this.ui.game.state.matchOver){if(!this.ui.result_finish.disabled)this.ui.finishToMenu();}else this.ui.pause(false);return;}
    const controls=this.controls(); const back=controls.find(n=>n.classList.contains('back-button'));back?.click();
  }
}
