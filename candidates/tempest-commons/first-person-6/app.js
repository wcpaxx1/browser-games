(function(){'use strict';const $=id=>document.getElementById(id),C=Cockpit,canvas=$('field'),view=new CockpitView(canvas),keys=new Set(),keyboardKeys=new Set(),drivePointers=new Map(),firePointers=new Set(),pendingDirections=new Map();let operation=0,worldDirty=true,inputDirty=false,simMoving=false,feedbackUntil=0,feedbackKind="",feedbackPending=false;let g=C.create(),started=false,fire=false,aimX=0,aimY=0,acc=0,last=0,lastFrame=0,lastEvent=0,silent=false,ctx=null,toastUntil=0,terminal=false;
const uid=()=>Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);let store;try{store=localStorage}catch(e){store={get length(){throw e},getItem(){throw e},setItem(){throw e}}}let vault=new CockpitSave.Save(store,uid());
view.reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)').matches||false;
function invalidateImport(){operation++;$('file').value='';}
function syncInputs(){keys.clear();for(const k of keyboardKeys)keys.add(k);for(const k of drivePointers.values())keys.add(k);fire=firePointers.size>0;}
function releaseAll(){keyboardKeys.clear();drivePointers.clear();firePointers.clear();syncInputs();}
function viewState(){return {width:canvas.width,height:canvas.height,moving:simMoving,reduced:view.reduced};}
function showFeedback(kind){feedbackPending=true;feedbackKind=kind;feedbackUntil=performance.now()+120;const e=$('input-feedback');if(e){e.hidden=false;e.dataset.kind=kind;e.dataset.acceptedAt=String(performance.now());e.textContent=(kind==='reload'||kind==='pending')?'◌':kind==='drive'?'↑':kind==='command'?'◎':'●';}}
function updateReticle(){const e=$('aim');if(!e)return;e.dataset.aimX=String(aimX);e.dataset.aimY=String(aimY);if(e.style){e.style.left=(50+aimX*50)+'%';e.style.top=(43+aimY*canvas.width/canvas.height*50)+'%';e.style.color=active()&&C.aim(g,aimX,aimY,viewState())?'#ffae70':'#e3e5c0';}}
// Input history and simulation use the same monotonic active-time axis. The live
// sets above are only pointer/keyboard ownership; never read them for past ticks.
let simTime=0,inputFrontier=0,clockAt=0,clockRunning=false,activeWallStart=0,eventSequence=0,feedbackSequence=0,savePending=false,exportPending=false;
const inputHistory=[],historyDirections=new Map(),historyFire=new Set();let historyAimX=0,historyAimY=0;
function accrue(now){now=Math.max(clockAt,now);if(clockRunning)acc+=now-clockAt;clockAt=now;}
function resetTimeline(now=performance.now()){acc=0;simTime=0;inputFrontier=0;simMoving=false;clockAt=now;activeWallStart=now;clockRunning=false;inputHistory.length=0;historyDirections.clear();historyFire.clear();pendingDirections.clear();historyAimX=historyAimY=0;}
function eventTime(e){const now=performance.now();accrue(now);const stamp=Number(e?.timeStamp),wall=Number.isFinite(stamp)&&stamp>=activeWallStart&&stamp<=now?stamp:now;
 // An unusually late-dispatched event may precede already committed simulation.
 // Clamp to that frontier rather than rewriting history or replaying a shot.
 return Math.max(simTime,inputFrontier,simTime+acc-Math.max(0,clockAt-wall));}
function enqueue(type,data={},e){const ev={type,...data,time:eventTime(e),sequence:++eventSequence};let i=inputHistory.length;while(i>0&&inputHistory[i-1].time>ev.time)i--;inputHistory.splice(i,0,ev);
 // A current edge can execute synchronously only after all older whole ticks.
 // During backlog the lightweight DOM acknowledges receipt; the action remains
 // queued until its own time. New projectiles cannot age through historical debt.
 if(acc<50)consumeEvents(simTime+acc);return ev;}
function historicalHeld(code){return [...historyDirections.values()].includes(code)||[...pendingDirections.values()].includes(code);}
function applyInput(ev){switch(ev.type){
 case 'directionDown':historyDirections.set(ev.source,ev.code);pendingDirections.set(ev.source,ev.code);break;
 case 'directionUp':historyDirections.delete(ev.source);if(ev.cancel)pendingDirections.delete(ev.source);break;
 case 'fireDown':{historyFire.add(ev.id);historyAimX=ev.x;historyAimY=ev.y;const result=C.shoot(g,ev.x,ev.y,{...ev.view,moving:simMoving});if(clockRunning&&ev.feedback===feedbackSequence)showFeedback(result.ok?'shot':'reload');if(result.ok){worldDirty=true;inputDirty=true;if(clockRunning)sound('shot');if(clockRunning&&result.outOfRange)toast('↑ 靠近目标');}break;}
 case 'fireUp':historyFire.delete(ev.id);break;
 case 'aim':historyAimX=ev.x;historyAimY=ev.y;break;
 case 'command':{const ok=C.command(g,ev.x,ev.y,{...ev.view,moving:simMoving});if(clockRunning)toast(ok?'小队集火':'瞄准前哨后右键');if(ok){if(clockRunning){sound('command');showFeedback('command');}worldDirty=true;inputDirty=true;}break;}
 case 'clear':historyDirections.clear();historyFire.clear();pendingDirections.clear();simMoving=false;break;
 }}
function consumeEvents(until){while(inputHistory.length&&inputHistory[0].time<=until+1e-7){const ev=inputHistory.shift();inputFrontier=Math.max(inputFrontier,ev.time);applyInput(ev);}}
function pressFire(e,center=false){if(!active()||firePointers.has(e.pointerId))return;if(center){aimX=aimY=0;updateReticle();}firePointers.add(e.pointerId);syncInputs();const feedback=++feedbackSequence;showFeedback('pending');enqueue('fireDown',{id:e.pointerId,x:aimX,y:aimY,view:viewState(),feedback},e);}
function requestCommand(e){if(!active())return;showFeedback('pending');enqueue('command',{x:aimX,y:aimY,view:viewState()},e);}
function drainHistory(){let steps=0;const paused=g.sim.paused;g.sim.paused=false;
 while(acc>=50&&steps<10&&g.sim.status==='playing'){
  const end=simTime+50;consumeEvents(end);
  const drive=(historicalHeld('ArrowUp')||historicalHeld('KeyW')?1:0)-(historicalHeld('ArrowDown')||historicalHeld('KeyS')?1:0),turn=(historicalHeld('ArrowRight')||historicalHeld('KeyD')?1:0)-(historicalHeld('ArrowLeft')||historicalHeld('KeyA')?1:0);
  simMoving=drive!==0||turn!==0;C.step(g,{drive,turn,fire:historyFire.size>0,aimX:historyAimX,aimY:historyAimY,view:viewState()});pendingDirections.clear();simTime=end;acc-=50;steps++;worldDirty=true;if(g.sim.tick%200===0)save();
 }
 // Edges in the fractional remainder happen after the last whole tick. They
 // can affect rendering immediately but will not be aged until the next tick.
 if(acc<50&&g.sim.status==='playing')consumeEvents(simTime+acc);
 g.sim.paused=paused;if(g.sim.status!=='playing')finish();
}
function toast(text){$('toast').textContent=text;toastUntil=performance.now()+1800}
function sound(type){if(silent)return;try{ctx ||= new(window.AudioContext||window.webkitAudioContext)();ctx.resume();const o=ctx.createOscillator(),amp=ctx.createGain();o.connect(amp);amp.connect(ctx.destination);const t=ctx.currentTime;o.type=type==='shot'?'sawtooth':'sine';o.frequency.setValueAtTime(type==='shot'?85:type==='command'?630:220,t);o.frequency.exponentialRampToValueAtTime(type==='shot'?24:160,t+.2);amp.gain.setValueAtTime(type==='shot'?.045:.035,t);amp.gain.exponentialRampToValueAtTime(.001,t+.22);o.start(t);o.stop(t+.23)}catch(e){}}
function resize(){const r=canvas.getBoundingClientRect(),scale=Math.min(1,960/Math.max(1,r.width),Math.sqrt(450000/Math.max(1,r.width*r.height)));canvas.width=Math.max(240,Math.round(r.width*scale));canvas.height=Math.max(240,Math.round(r.height*scale));view.draw(g,{aimX,aimY,moving:simMoving,externalReticle:true});worldDirty=false;updateReticle()}
function active(){return started&&!g.sim.paused&&g.sim.status==='playing'&&$('confirm').hidden}
function save(){if(acc>=50||inputHistory.length){savePending=true;$('save-status').textContent='正在结算已发生的动作…';return false;}savePending=false;const ok=vault.write(g);$('save-status').textContent=ok?'已保存在本浏览器 · 独立存档槽':'存储不可用，只保留本页内存，请导出';return ok}
// Replacement deliberately cancels uncommitted history. Preserve the current
// authoritative snapshot directly; a deferred timeline save cannot satisfy this.
function preserveCommitted(){let ok=false;try{ok=vault.write(g)}catch(e){}const note=ok?'已完成进度已保存在旧存档槽。未结算操作将取消。':'旧进度保存失败，行动未替换。请取消后导出备份。';$('restart-note').textContent=note;if(!ok)$('save-status').textContent=note;return ok;}
function blockReplacement(){$('confirm').hidden=false;$('paused').hidden=false;slots();}
function slots(){const current=$('slots').value;$('slots').textContent='';for(const item of vault.list()){const opt=document.createElement('option');opt.value=item.key;opt.textContent=item.error?'损坏存档（保留）':`${Math.floor(item.tick/20)} 秒 · ${item.status==='won'?'胜利':item.status==='lost'?'失败':'进行中'}${item.memory?' · 内存':''}`;opt.disabled=!!item.error;$('slots').appendChild(opt)}if(current&&vault.list().some(x=>x.key===current))$('slots').value=current;else $('slots').value=vault.key}
function freeze(){enqueue('clear');clockRunning=false;feedbackSequence++;feedbackPending=false;if($('input-feedback'))$('input-feedback').hidden=true;releaseAll();g.sim.paused=true}
function pause(){if(!started||terminal)return;freeze();save();slots();$('paused').hidden=false;canvas.blur()}
function resume(){if(terminal)return;worldDirty=true;inputDirty=true;invalidateImport();g.sim.paused=false;releaseAll();clockAt=performance.now();activeWallStart=clockAt;clockRunning=true;last=clockAt;$('paused').hidden=true;$('intro').hidden=true;canvas.focus()}
function reset(){invalidateImport();if(started&&!preserveCommitted()){blockReplacement();return;}feedbackPending=false;if($('input-feedback'))$('input-feedback').hidden=true;worldDirty=true;inputDirty=true;g=C.create(72134);savePending=exportPending=false;resetTimeline();vault=new CockpitSave.Save(store,uid());started=true;terminal=false;lastEvent=0;aimX=aimY=0;keys.clear();fire=false;acc=0;$('result').hidden=true;$('confirm').hidden=true;$('paused').hidden=true;$('intro').hidden=true;$('objective').textContent='摧毁前哨';save();resume();sound('command')}
function finish(){worldDirty=true;invalidateImport();terminal=true;freeze();resetTimeline();save();$('result-title').textContent=g.sim.status==='won'?'前哨拿下！':'小队失联';$('result-kicker').textContent=g.sim.status==='won'?'行动成功':'行动结束';$('result-info').textContent=`${(g.sim.tick/20).toFixed(1)} 秒 · ${g.hits} 发命中`;$('objective').textContent=g.sim.status==='won'?'任务完成':'行动结束';$('result').hidden=false;sound(g.sim.status==='won'?'command':'hit')}
function restore(next){worldDirty=true;inputDirty=true;const validated=C.validate(next);if(started&&!preserveCommitted())throw Error('旧进度保存失败，当前行动未替换；请先导出备份。');invalidateImport();g=validated;savePending=exportPending=false;resetTimeline();vault=new CockpitSave.Save(store,uid());started=true;terminal=false;lastEvent=g.sim.tick;aimX=aimY=0;freeze();$('intro').hidden=true;$('result').hidden=true;$('confirm').hidden=true;if(g.sim.status==='playing'){$('paused').hidden=false;$('objective').textContent='摧毁前哨';save();slots();toast('已读取，点击继续')}else finish()}
function position(e){const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width*canvas.width,y=(e.clientY-r.top)/r.height*canvas.height;aimX=Math.max(-1,Math.min(1,(x-canvas.width/2)/(canvas.width/2)));aimY=(y-canvas.height*.43)/(canvas.width/2);updateReticle();if(active())enqueue('aim',{x:aimX,y:aimY},e);}
canvas.addEventListener('contextmenu',e=>e.preventDefault());canvas.addEventListener('pointermove',e=>{position(e)});canvas.addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();canvas.focus();position(e);canvas.setPointerCapture?.(e.pointerId);if(e.button===2){requestCommand(e)}else if(e.button===0){pressFire(e)}});
const release=(e,kind=e.type)=>{if(e.pointerId===undefined)return;const heldDrive=drivePointers.has(e.pointerId),source='p:'+e.pointerId,cancel=kind==='pointercancel'||kind==='lostpointercapture'&&heldDrive;
 if(heldDrive)enqueue('directionUp',{source,cancel},e);
 if(firePointers.has(e.pointerId)&&(kind!=='pointerup'||!(e.buttons&1))){enqueue('fireUp',{id:e.pointerId},e);firePointers.delete(e.pointerId);}
 drivePointers.delete(e.pointerId);syncInputs();};for(const kind of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(kind,e=>release(e,kind));window.addEventListener('pointerup',e=>release(e,'pointerup'));window.addEventListener('pointercancel',e=>release(e,'pointercancel'));

window.addEventListener('keydown',e=>{if(e.code==='Escape'&&!$('confirm').hidden){e.preventDefault();invalidateImport();$('confirm').hidden=true;return}if(e.code==='Escape'||e.code==='Space'){if(started){e.preventDefault();if(g.sim.paused&&!$('paused').hidden)resume();else pause()}return}if(['INPUT','SELECT','BUTTON'].includes(document.activeElement?.tagName)&&!$('paused').hidden)return;if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyS','KeyA','KeyD'].includes(e.code)&&active()){e.preventDefault();if(!keyboardKeys.has(e.code)){enqueue('directionDown',{source:'k:'+e.code,code:e.code},e);showFeedback('drive');}keyboardKeys.add(e.code);syncInputs()}});window.addEventListener('keyup',e=>{if(keyboardKeys.has(e.code))enqueue('directionUp',{source:'k:'+e.code,cancel:false},e);keyboardKeys.delete(e.code);syncInputs()});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause()});window.addEventListener('resize',resize);
$('start').onclick=()=>{started=true;$('intro').hidden=true;resume();save();sound('command')};$('menu').onclick=pause;$('resume').onclick=resume;$('save').onclick=()=>{save();slots()};$('mute').onclick=()=>{silent=!silent;$('mute').textContent='声音 '+(silent?'关':'开')};
$('restart').onclick=()=>{invalidateImport();preserveCommitted();$('confirm').hidden=false};$('cancel').onclick=()=>{invalidateImport();$('confirm').hidden=true};$('confirm-restart').onclick=reset;$('again').onclick=reset;
$('load').onclick=()=>{invalidateImport();try{restore(vault.load($('slots').value))}catch(e){toast(e.message)}};
function exportSave(){if(acc>=50||inputHistory.length){exportPending=true;save();return;}exportPending=false;save();const blob=new Blob([CockpitSave.encode(g)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tempest-cockpit-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000)}$('export').onclick=exportSave;
$('import').onclick=()=>{invalidateImport();$('file').click()};$('file').addEventListener('cancel',invalidateImport);$('file').onchange=async()=>{const token=++operation,f=$('file').files?.[0];$('file').value='';if(!f)return;try{if(f.size>2000000)throw Error('文件过大');const raw=await f.text();if(token!==operation)return;const next=CockpitSave.decode(raw);if(token!==operation)return;restore(next)}catch(e){if(token===operation)toast(e.message)}};
const prior=vault.list().find(x=>!x.error);if(prior){$('continue').hidden=false;$('continue').onclick=()=>{invalidateImport();try{restore(vault.load(prior.key))}catch(e){toast(e.message)}}}
for(const b of document.querySelectorAll('[data-drive]')){const code={up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'}[b.dataset.drive];b.addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();b.setPointerCapture?.(e.pointerId);if(drivePointers.has(e.pointerId))return;drivePointers.set(e.pointerId,code);enqueue('directionDown',{source:'p:'+e.pointerId,code},e);syncInputs();showFeedback('drive')});for(const type of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(type,e=>release(e,type));}
$('fire-touch').addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);pressFire(e,true)});for(const type of ['pointerup','pointercancel','lostpointercapture'])$('fire-touch').addEventListener(type,e=>release(e,type));$('squad-touch').onclick=e=>{if(active()){aimX=aimY=0;updateReticle();requestCommand(e)}};
function frame(now){accrue(Math.max(now,performance.now()));last=now;if(started&&!terminal){drainHistory();
 if(clockRunning){for(const e of g.sim.events.filter(e=>e.tick>lastEvent&&e.kind==='fire'&&e.from===g.pilot))sound('shot');if(g.sim.events.some(e=>e.tick>lastEvent&&e.kind==='impact'))sound('hit');}lastEvent=g.sim.tick;}
 if(acc<50&&!inputHistory.length){if(savePending){save();if(g.sim.paused)slots();}if(exportPending)exportSave();}
 if(now-toastUntil>0)$('toast').textContent='';if(feedbackPending){feedbackPending=false;feedbackUntil=now+120;}else if(now>=feedbackUntil&&$('input-feedback'))$('input-feedback').hidden=true;$('hints').hidden=g.sim.tick>240||!started||g.sim.paused;
 if(worldDirty&&(inputDirty||now-lastFrame>=32)){view.draw(g,{aimX,aimY,moving:simMoving,externalReticle:true});worldDirty=false;inputDirty=false;lastFrame=now;updateReticle();}requestAnimationFrame(frame)}resize();requestAnimationFrame(frame);
})();
