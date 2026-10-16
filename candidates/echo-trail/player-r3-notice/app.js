(function(){
'use strict';
const C=window.EchoCore,V=window.EchoView,S=window.EchoStorage,$=id=>document.getElementById(id),canvas=$('board'),ctx=canvas.getContext('2d');
const store=S.create(()=>window.localStorage),motion=window.matchMedia('(prefers-reduced-motion: reduce)');
// One immediate action per distinct press. Only forward/back use our own clock.
const keyDirections={ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left'},pressed=new Set(),WALK_MS=180;
let walking=null,nextWalk=Infinity;
function clearKeys(){pressed.clear();walking=null;nextWalk=Infinity;}
let saved=store.load(),progress=saved.data,game=null,lastTime=performance.now(),lastDraw=0,pulseAt=0,bumpAt=-1000,moveAt=0,motionPausedAt=null,visualFrom={x:1.5,y:1.5,angle:0},visualTo={x:1.5,y:1.5,angle:0},moveDuration=140,generation=0,pending=null,finished=false;
const messages={preserved:'旧存档已保留。可先备份，再导入或重置。',unavailable:'无法读取浏览器存档。可游玩，请导出进度备份。','memory-only':'进度没能保存，请导出备份。','external-change':'另一页面改了进度。已暂停保存，请导出备份后刷新。','reset-failed':'没有清除成功，旧进度仍在。'};
function saveStatus(r){saved=r;progress=r.data;$('storage-warning').hidden=!messages[r.status];$('storage-warning').textContent=r.status==='preserved'?'旧存档已保留':'进度未保存';$('storage-description').textContent=messages[r.status]||'进度仅在此浏览器保存。刷新从本关起点继续。';$('original-button').hidden=!r.hasPreserved;}
function checkpoint(){saveStatus(store.save(progress));}
function applySettings(){document.body.classList.toggle('reduced-motion',progress.settings.reducedMotion);document.body.classList.toggle('high-contrast',progress.settings.highContrast);$('motion-setting').checked=progress.settings.reducedMotion;$('contrast-setting').checked=progress.settings.highContrast;}
function settled(now){const stamp=Math.max(lastTime,now),elapsed=stamp-lastTime;lastTime=stamp;if(game)game=C.reducer(game,{type:'tick',ms:elapsed});}
function menuOpen(){return $('settings-dialog').open||$('confirm-dialog').open;}
function levelButtons(){const list=$('levels');list.replaceChildren();C.LEVELS.forEach((l,i)=>{const b=document.createElement('button');b.className=(i===game.levelId?'current ':'')+(progress.completed.includes(i)?'complete':'');b.disabled=i>progress.unlockedLevel;b.setAttribute('aria-label',`第${i+1}关${b.disabled?'，未解锁':''}`);b.setAttribute('title',`第 ${i+1} 关`);b.addEventListener('click',()=>start(i));list.append(b);});}
function start(id){if(!Number.isInteger(id)||id>progress.unlockedLevel||id<0||id>4)return;clearKeys();game=C.create(id);lastTime=performance.now();pulseAt=lastTime;moveAt=lastTime;visualFrom={x:game.x+.5,y:game.y+.5,angle:(game.heading-1)*Math.PI/2};visualTo={...visualFrom};motionPausedAt=null;finished=false;progress.currentLevel=id;checkpoint();render();}
function camera(now){const at=motionPausedAt??now,t=progress.settings.reducedMotion||motion.matches?1:Math.min(1,Math.max(0,(at-moveAt)/moveDuration)),ease=1-(1-t)**3;return{x:visualFrom.x+(visualTo.x-visualFrom.x)*ease,y:visualFrom.y+(visualTo.y-visualFrom.y)*ease,angle:visualFrom.angle+(visualTo.angle-visualFrom.angle)*ease,bob:progress.settings.reducedMotion||motion.matches?0:Math.sin(t*Math.PI)*3};}
function resumeState(now){if(game.mode!=='paused')return;if(motionPausedAt!==null){const duration=now-motionPausedAt;moveAt+=duration;pulseAt+=duration;bumpAt+=duration;motionPausedAt=null;}game=C.reducer(game,{type:'resume'});}
function act(action){
 if(!game||menuOpen()||finished||game.mode==='paused')return;
 const now=Math.max(lastTime,performance.now());settled(now);
 const before=game;
 game=C.reducer(game,action);
 if(game===before){render();return;}
 // All accepted movement/turn inputs share one actual-execution-time cadence.
 if(walking&&(action.type==='move'||action.type==='turn'))nextWalk=now+WALK_MS;
 if(action.type==='move'&&game.feedback==='bump')bumpAt=now;
 if(action.type==='turn'||game.x!==before.x||game.y!==before.y){const angle=(before.heading-1)*Math.PI/2;visualFrom={x:before.x+.5,y:before.y+.5,angle};visualTo={x:game.x+.5,y:game.y+.5,angle:action.type==='turn'?angle+(action.dir==='left'?-1:1)*Math.PI/2:angle};moveDuration=action.type==='turn'?170:140;moveAt=now;}
 if(action.type==='pulse')pulseAt=now;
 if(game.mode==='won'&&before.mode!=='won'){
  clearKeys();
  if(!progress.completed.includes(game.levelId))progress.completed.push(game.levelId);
  progress.completed.sort((a,b)=>a-b);progress.unlockedLevel=Math.min(progress.completed.length,4);checkpoint();$('announcer').textContent=game.levelId===4?'五关完成，到家啦。':`第${game.levelId+1}关完成。`;
 }
 render();
}
function pause(){clearKeys();if(!game||finished)return;const now=performance.now();settled(now);if(game.mode!=='paused')motionPausedAt=now;game=C.reducer(game,{type:'pause'});render();}
function resume(){if(!game||menuOpen()||finished||game.mode!=='paused')return;clearKeys();const now=performance.now();settled(now);resumeState(now);render();canvas.focus({preventScroll:true});}
function render(){if(!game)return;document.body.dataset.gameState=game.mode;$('level-count').textContent=`${game.levelId+1} / 5`;$('heading-display').textContent='朝向 '+['北','东','南','西'][game.heading];$('pause-overlay').hidden=game.mode!=='paused'||menuOpen()||finished;$('finish-overlay').hidden=!finished;
 $('hint').textContent=finished?'':game.mode==='won'?(game.levelId===4?'五关完成':`第 ${game.levelId+1} 关完成 · 进入下一关`):game.levelId===0?'去金圈　↑↓按住走　←→转':'认朝向、记墙标，找到金圈';
 const controlsBlocked=finished||game.mode==='won'||game.mode==='paused';
 $('pulse-button').disabled=controlsBlocked;$('retry-button').disabled=finished;document.querySelectorAll('[data-dir]').forEach(b=>b.disabled=controlsBlocked);
 canvas.setAttribute('aria-label',`第${game.levelId+1}关，潜艇驾驶视角。`+(game.mode==='paused'?'已暂停。点继续探路或按 Escape 继续；方向键与照亮暂不可用。':'按住上前进、下后退，点按左右转向；鼠标左键照亮前方。'));levelButtons();draw(performance.now());}
function draw(now){if(!game||!ctx)return;const c=camera(now);V.draw(ctx,C.LEVELS[game.levelId],{camera:c,bob:c.bob,mode:game.mode,revealMs:game.revealMs,firstMove:game.firstMove,pulseAt,bumpAge:(motionPausedAt??now)-bumpAt,tutorial:C.tutorial(game),landmarkSeed:C.SEED^Math.imul(game.levelId+1,0x9e3779b1)}, {...progress.settings,reducedMotion:progress.settings.reducedMotion||motion.matches},motionPausedAt??now);}
function command(dir){return dir==='left'||dir==='right'?{type:'turn',dir}:{type:'move',dir:dir==='up'?'forward':'back'};}
function settings(){pause();applySettings();$('settings-feedback').textContent='';$('settings-dialog').showModal();render();}
function closeSettings(){$('settings-dialog').close();render();}
function confirm(title,copy,fn){pending=fn;$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;$('confirm-dialog').showModal();$('confirm-cancel').focus();}
function download(raw,name){if(typeof raw!=='string')return;try{const blob=new Blob([raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),15000);$('settings-feedback').textContent='已发起下载，请检查下载文件夹。';}catch{$('settings-feedback').textContent='未能下载，请保留当前页面。';}}
$('settings-button').addEventListener('click',settings);$('storage-warning').addEventListener('click',settings);$('settings-close').addEventListener('click',closeSettings);$('settings-dialog').addEventListener('close',()=>{generation++;render();});
$('home').addEventListener('click',e=>{e.preventDefault();start(0);});$('retry-button').addEventListener('click',()=>start(game.levelId));$('replay-button').addEventListener('click',()=>start(0));$('resume-button').addEventListener('click',resume);$('pulse-button').addEventListener('click',()=>act({type:'pulse'}));
canvas.addEventListener('click',()=>{act({type:'pulse'});canvas.focus({preventScroll:true});});
document.querySelectorAll('[data-dir]').forEach(b=>b.addEventListener('click',()=>act(command(b.dataset.dir))));
document.addEventListener('keydown',e=>{
 if(menuOpen()||['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable||e.altKey||e.ctrlKey||e.metaKey){clearKeys();return;}
 if(Object.hasOwn(keyDirections,e.key)){
  e.preventDefault();
  if(e.repeat||pressed.has(e.key)||finished||game.mode==='won'||game.mode==='paused')return;
  pressed.add(e.key);
  if(e.key==='ArrowUp'||e.key==='ArrowDown')walking=e.key;
  act(command(keyDirections[e.key]));
 }else if(e.key==='Escape'&&!e.repeat){e.preventDefault();game.mode==='paused'?resume():pause();}
});
document.addEventListener('keyup',e=>{
 pressed.delete(e.key);
 if(e.key!==walking)return;
 // Last pressed wins; releasing it can resume the other held direction, never immediately.
 const other=e.key==='ArrowUp'?'ArrowDown':'ArrowUp';
 walking=pressed.has(other)?other:null;nextWalk=walking?performance.now()+WALK_MS:Infinity;
});
document.addEventListener('focusin',e=>{if(['INPUT','TEXTAREA','SELECT'].includes(e.target?.tagName)||e.target?.isContentEditable)clearKeys();});
function walkHeld(){
 const now=Math.max(lastTime,performance.now());
 if(!walking||game.mode!=='playing'||menuOpen()||finished||now<nextWalk)return;
 // At most one step per frame. Slow/late frames never accumulate a replay queue.
 act(command(keyDirections[walking]));
}
for(const [id,key]of[['motion-setting','reducedMotion'],['contrast-setting','highContrast']])$(id).addEventListener('change',()=>{progress.settings[key]=$(id).checked;applySettings();checkpoint();draw(performance.now());});
$('export-button').addEventListener('click',()=>download(store.export(),'echo-trail-progress-v1.json'));$('original-button').addEventListener('click',()=>download(store.exportOriginal(),'echo-trail-preserved-original.json'));$('import-button').addEventListener('click',()=>{$('import-file').value='';$('import-file').click();});
$('import-file').addEventListener('change',async()=>{const token=++generation,file=$('import-file').files?.[0];if(!file)return;if(file.size>S.MAX){$('settings-feedback').textContent='文件太大，未导入。';return;}let raw,next;try{raw=await file.text();next=store.inspect(raw);}catch{if(token!==generation||!$('settings-dialog').open)return;$('settings-feedback').textContent='不是有效的本游戏存档。';return;}if(token!==generation||!$('settings-dialog').open)return;confirm('替换进度？',`存档已完成 ${next.completed.length} / 5 关。当前进度将被替换。`,()=>{saveStatus(store.import(raw,{confirmed:true}));applySettings();$('settings-dialog').close();start(progress.currentLevel);});});
$('reset-button').addEventListener('click',()=>confirm('重新开始？','将清除此游戏进度。需要保留的话，请先取消并导出。',()=>{const r=store.reset({confirmed:true});saveStatus(r);if(r.status==='reset'){applySettings();$('settings-dialog').close();start(0);}else $('settings-feedback').textContent=messages['reset-failed'];}));
$('confirm-cancel').addEventListener('click',()=>{pending=null;$('confirm-dialog').close();});$('confirm-ok').addEventListener('click',()=>{const fn=pending;pending=null;$('confirm-dialog').close();if(fn)fn();});$('confirm-dialog').addEventListener('cancel',()=>{pending=null;});
window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('storage',e=>{if(e.key===S.KEY||e.key===null){saveStatus(store.externalChange(e.newValue));pause();}});
function frame(stamp){const now=Math.max(lastTime,stamp,performance.now());settled(now);walkHeld();if(game.mode==='won'&&game.celebrateMs===0&&!menuOpen()){if(game.levelId<4){start(game.levelId+1);}else if(!finished){finished=true;render();$('replay-button').focus({preventScroll:true});}}if(now-lastDraw>=25){draw(now);lastDraw=now;}requestAnimationFrame(frame);}
saveStatus(saved);applySettings();start(progress.currentLevel);requestAnimationFrame(frame);
})();
