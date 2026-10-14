(function(root){'use strict';
const $=id=>document.getElementById(id),canvas=$('battle'),field=$('field'),G=root.Tempest;
let storage;try{storage=localStorage;void storage.length}catch(e){storage={get length(){return 0},key(){return null},getItem(){return null},setItem(){throw Error('浏览器存储不可用')}}}
const now=()=>performance.now(),session=new root.CommandSession(storage,now()),view=new root.CommandView(canvas),observer=new root.CommandFeedback.Observer();
let combatFeedback={units:{},alert:''};
let selected=[],pointers=new Map(),keys=new Set(),hover=null,box=null,touchOrder=false,lastFrame=now(),lastGame=session.g,lastPhase=null,lastSlots='',receiptUntil=0,receiptFirst=false,lastAuto=0;
function position(e){const b=canvas.getBoundingClientRect();return {x:(e.clientX-b.left)*view.w/b.width,y:(e.clientY-b.top)*view.h/b.height}}
function feedback(text){$('receipt').textContent=text;receiptFirst=true;receiptUntil=Infinity}
function clearInput(){for(const id of pointers.keys())try{canvas.releasePointerCapture(id)}catch(e){}pointers.clear();keys.clear();hover=null;box=null}
function select(ids,add=false){const live=session.g.sim.entities.filter(e=>e.type==='ranger'&&e.team===0).map(e=>e.id);selected=[...new Set([...(add?selected:[]),...ids])].filter(id=>live.includes(id));touchOrder=false;feedback(selected.length?'已选择 '+selected.length+' 辆坦克':'选择已清除');update()}
function all(){select(session.g.sim.entities.filter(e=>e.type==='ranger'&&e.team===0).map(e=>e.id))}
function selectionScope(ids=selected){const signs=session.g.sim.entities.filter(e=>e.type==='ranger'&&e.team===0&&ids.includes(e.id)).map(e=>e.callsign).sort((a,b)=>a-b);return signs.length?'已选 '+signs.join('、')+' 号（'+signs.length+' 辆）':'未选中坦克'}
function order(p){if(!session.active)return false;if(!selected.length){feedback('先左键选择蓝色坦克');return false}const hit=view.pick(p.x,p.y),world=view.visiblePoint(p.x,p.y),target=session.g.sim.entities.find(e=>e.id===hit?.id),attack=target?.team===1;
 if(!attack&&(world.x<.5||world.y<.5||world.x>G.W-.5||world.y>G.H-.5)){feedback('这里超出战场');return false}
 const c=attack?{ids:[...selected],kind:'attack',target:target.id}:{ids:[...selected],kind:'move',x:world.x,y:world.y};
 if(session.command(c,now())){const t=attack?target:world;view.mark={x:t.x,y:t.y,attack,at:now()};feedback((attack?'攻击':'移动')+'命令已提交 · '+selectionScope(c.ids));touchOrder=false;return true}return false;
}
function stop(){if(!session.active)return;if(!selected.length){feedback('未选中坦克，无法下达停止命令');return}const ids=[...selected];if(session.command({ids,kind:'stop'},now()))feedback('停止命令已提交 · '+selectionScope(ids))}
function resize(){const r=field.getBoundingClientRect();view.resize(Math.max(1,r.width),Math.max(1,r.height),devicePixelRatio||1);view.fit(session.g)}
new ResizeObserver(resize).observe(field);resize();
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{if(!session.active)return;e.preventDefault();canvas.focus({preventScroll:true});const p=position(e);if(e.button===2){order(p);return}if(![0,1].includes(e.button))return;try{canvas.setPointerCapture(e.pointerId)}catch(err){}pointers.set(e.pointerId,{...p,sx:p.x,sy:p.y,button:e.button,touch:e.pointerType!=='mouse',shift:e.shiftKey,moved:false});hover=null});
canvas.addEventListener('pointermove',e=>{const p=position(e),d=pointers.get(e.pointerId);if(!session.active)return;if(!d){if(e.pointerType==='mouse')hover=p;return}const dx=p.x-d.x,dy=p.y-d.y;d.moved=d.moved||Math.hypot(p.x-d.sx,p.y-d.sy)>7;if(d.moved){if(d.button===1||d.touch){view.pan(-dx,-dy);hover=null}else box={x:d.sx,y:d.sy,w:p.x-d.sx,h:p.y-d.sy}}d.x=p.x;d.y=p.y});
canvas.addEventListener('pointerup',e=>{const d=pointers.get(e.pointerId);if(!d)return;pointers.delete(e.pointerId);try{canvas.releasePointerCapture(e.pointerId)}catch(err){}if(!session.active){box=null;return}const p=position(e);if(d.moved){if(!d.touch&&d.button===0&&box)select(view.box(box),d.shift);box=null;return}if(d.button===1)return;
 const hit=view.pick(p.x,p.y);if(d.touch&&(touchOrder||(selected.length&&hit?.team!==0))){order(p);return}select(hit?.team===0?[hit.id]:[],d.shift);
});
function cancelPointer(e){pointers.delete(e.pointerId);box=null;hover=null}canvas.addEventListener('pointercancel',cancelPointer);canvas.addEventListener('lostpointercapture',cancelPointer);canvas.addEventListener('pointerleave',clearInput);
canvas.addEventListener('wheel',e=>{if(!session.active)return;e.preventDefault();const p=position(e);view.zoomAt(e.deltaY<0?1.1:1/1.1,p.x,p.y);hover=null},{passive:false});
function focusPhase(){clearInput();if(session.phase==='paused')$('resume').focus();else if(session.phase==='confirm')$('cancel-restart').focus();else if(session.phase==='result')$('again').focus();else canvas.focus({preventScroll:true})}
function pause(){if(session.pause(now())){clearInput();update()}}function resume(){if(session.resume(now())){clearInput();update()}}
$('pause').onclick=pause;$('resume').onclick=resume;$('home').onclick=()=>{if(!session.active)return;view.fit(session.g);hover=null};$('select-all').onclick=()=>{if(session.active)all()};$('stop').onclick=stop;$('touch-order').onclick=()=>{if(session.active&&selected.length){touchOrder=!touchOrder;update()}};
$('restart').onclick=()=>{if(session.askRestart())update()};$('cancel-restart').onclick=()=>{session.cancelRestart();update()};$('confirm-restart').onclick=()=>{session.restart(now());update()};$('again').onclick=()=>{session.restart(now());update()};
$('save').onclick=()=>{if(session.phase==='paused'){session.saveAs();update()}};
function download(raw,name){const b=new Blob([raw],{type:'application/json'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),30000)}
function exportSave(){session.requestExport(now(),download);clearInput();update()}$('export').onclick=exportSave;$('result-export').onclick=exportSave;
$('load').onclick=()=>{session.load($('slots').value,now());update()};$('import').onclick=()=>{if(session.phase!=='paused'||session.busy)return;session.cancelImport();$('file').value='';$('file').click()};$('file').onchange=async()=>{const file=$('file').files?.[0];if(file)await session.importFile(file,now);else session.cancelImport();$('file').value='';update()};$('file').addEventListener('cancel',()=>session.cancelImport());
root.addEventListener('keydown',e=>{
 const code=e.code;if(['Space','Escape','Enter','NumpadEnter'].includes(code)&&e.repeat){e.preventDefault();return}
 if(session.phase==='confirm'){
  if(['Space','Escape','Enter','NumpadEnter','Tab'].includes(code))e.preventDefault();
  if(code==='Escape')session.cancelRestart();
  else if(code==='Tab')($('cancel-restart')===document.activeElement?$('confirm-restart'):$('cancel-restart')).focus();
  else if(['Enter','NumpadEnter'].includes(code)){if(document.activeElement===$('cancel-restart'))session.cancelRestart();else if(document.activeElement===$('confirm-restart'))session.restart(now())}
  update();return;
 }
 if(session.busy){if(['Space','Escape','Enter','NumpadEnter'].includes(code))e.preventDefault();return}
 if(session.phase==='paused'){if(code==='Space'||code==='Escape'){e.preventDefault();resume()}return}
 if(!session.active)return;
 if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(code)){e.preventDefault();keys.add(code)}
 else if(code==='Space'){e.preventDefault();pause()}
 else if(code==='Escape'){e.preventDefault();if(selected.length)select([]);else pause()}
 else if(code==='KeyS'){e.preventDefault();stop()}
});
root.addEventListener('keyup',e=>keys.delete(e.code));
function deactivate(){clearInput();if(session.active)pause();session.cancelImport()}
root.addEventListener('blur',deactivate);document.addEventListener('visibilitychange',()=>{if(document.hidden)deactivate()});root.addEventListener('storage',e=>{session.storageChanged(e.key);update()});
const cards=new Map();for(let n=1;n<=3;n++){const b=document.createElement('button'),name=document.createElement('span'),hp=document.createElement('small'),bar=document.createElement('i'),intent=document.createElement('small');intent.className='intent';name.textContent='▰ 坦克 '+n;b.append(name,hp,bar,intent);b.onclick=e=>{if(!session.active)return;const u=session.g.sim.entities.find(e=>e.callsign===n&&e.type==='ranger');if(u)select([u.id],e.shiftKey)};$('cards').appendChild(b);cards.set(n,{b,hp,bar,intent})}
function update(){
 if(lastGame!==session.g){lastGame=session.g;selected=[];view.fit(session.g);clearInput();lastAuto=0;feedback('选择蓝色坦克，向红色前哨进军')}
 const s=session.g.sim;selected=selected.filter(id=>s.entities.some(e=>e.id===id));
 combatFeedback=observer.observe(session.g,now());const facts=root.CommandFeedback.facts(session.g);
 for(const [n,{b,hp,bar,intent}]of cards){
  const e=s.entities.find(e=>e.callsign===n&&e.type==='ranger'),status=e?combatFeedback.units[e.id]:null;
  b.className=!e?'dead':[selected.includes(e.id)?'selected':'',status.severity,status.hit?'hit':''].filter(Boolean).join(' ');
  b.disabled=!session.active||!e;b.setAttribute('aria-pressed',String(!!e&&selected.includes(e.id)));
  hp.textContent=e?Math.ceil(e.hp)+'/'+G.SPEC.ranger.hp+(status.label?' · '+status.label:''):'已损失';
  bar.style.width=(status?status.ratio*100:0)+'%';bar.style.background=status?.color||'';
  intent.textContent=status?status.intent:'无法选择';
  b.setAttribute('aria-label','坦克 '+n+'，'+hp.textContent+'，'+intent.textContent+(status?.hit?'，刚刚受击':'')+(!e?'，既有选择保持不变':''));
 }
 if($('stage').textContent!==facts.stage)$('stage').textContent=facts.stage;
 $('hint').textContent=s.status!=='playing'?'战局已结束 · 可重试或导出战局':selectionScope()+' · '+(!selected.length?'左键点选或拖框选择':facts.guards?'右键集火反坦克兵':'右键集火前哨');
 if($('combat-alert').textContent!==combatFeedback.alert)$('combat-alert').textContent=combatFeedback.alert;

 $('touch-order').classList.toggle('on',touchOrder);$('stop').disabled=!session.active||!selected.length;$('select-all').disabled=!session.active;$('touch-order').disabled=!session.active||!selected.length;$('pause').disabled=!session.active;
 $('shade').hidden=session.phase==='playing';$('pause-panel').hidden=session.phase!=='paused';$('confirm-panel').hidden=session.phase!=='confirm';$('result-panel').hidden=session.phase!=='result';
 $('result-title').textContent=s.status==='won'?'前哨已摧毁':s.status==='draw'?'双方全灭':'小队已全灭';$('result-detail').textContent=facts.resultDetail;$('result-advice').textContent=facts.resultAdvice;
 for(const id of ['resume','restart','load','import','save','export','result-export','again'])$(id).disabled=session.busy;$('export').textContent=session.busy?'结算中…':'导出';$('result-export').textContent=session.busy?'结算中…':'导出战局';
 for(const id of ['notice','confirm-notice','result-notice'])$(id).textContent=session.notice;
 if(session.phase==='paused'&&!session.busy){const list=session.slot.list(),stamp=JSON.stringify(list);if(stamp!==lastSlots){lastSlots=stamp;$('slots').replaceChildren();for(const v of list){const o=document.createElement('option');o.value=v.key;o.textContent=v.error?'损坏存档（保留）':Math.floor(v.tick/20)+' 秒 · '+({playing:'进行中',won:'胜利',lost:'失败',draw:'同归于尽'}[v.status]||v.status)+(v.memory?' · 内存':'');o.disabled=!!v.error;$('slots').appendChild(o)}}}
 if(lastPhase!==session.phase){lastPhase=session.phase;focusPhase()}
}
function frame(t){const dt=Math.min(40,Math.max(0,t-lastFrame));lastFrame=t;
 if(session.active){let dx=(keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0),dy=(keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0);if(hover&&!pointers.size){if(hover.x<18)dx--;else if(hover.x>view.w-18)dx++;if(hover.y<18)dy--;else if(hover.y>view.h-18)dy++}if(dx||dy)view.pan(dx*dt*.55,dy*dt*.55)}
 session.frame(t);if(session.timeline.settled&&session.active&&session.g.sim.tick-lastAuto>=100){session.write();lastAuto=session.g.sim.tick}
 update();view.draw(session.g,{selected,box,feedback:combatFeedback},t);
 // Receipt expires only after it has survived one complete presented frame.
 if(receiptFirst){receiptFirst=false;receiptUntil=t+180}else if(t>receiptUntil)$('receipt').textContent='';
 root.requestAnimationFrame(frame);
}
update();view.draw(session.g,{selected,feedback:combatFeedback},now());root.requestAnimationFrame(frame);
})(globalThis);
