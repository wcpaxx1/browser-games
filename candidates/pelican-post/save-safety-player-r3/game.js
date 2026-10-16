/* Original Canvas artwork and browser integration — Pelican Post. */
(() => {
  'use strict';
  const C = window.Pelican, F = window.PelicanFeedback, $ = id => document.getElementById(id);
  const guard = new window.PelicanSave.SaveGuard({key:C.KEY,storage:()=>window.localStorage,locks:()=>window.navigator?.locks,onChange:syncSaveStatus,onConflict:storageConflict,localSnapshot:()=>C.encode(state)});
  const loaded = C.load({getItem:()=>{if(!guard.initialReadable)throw Error('Storage unavailable');return guard.initial;}},20261012);
  let state = loaded.state, route = C.map(state.seed,state.stage);
  let lastSave = 0, audio = null, toastTime = 0, confirmAction = null, operation = 0;
  const ownedConfirmCloses=[],ownedJournalCloses=[];
  let W = 960, H = 440, time = 0, frameTime = 0, visualLane = state.run.lane, flash = 0, pickupFlash = 0;
  const canvas = $('game'), ctx = canvas.getContext('2d');
  let displayedView=null, inputSequence=0, steerDirection=0, steerUntil=0, rawFrameMs=0, lastRafAt=null;
  const held=new window.PelicanInput.DirectionHold(140);
  const inputSamples=[];
  const timeline=new window.PelicanClock.Timeline();
  let saveDue=false,pendingHoldMark=null;
  let lastHudSignature=null;
  let recoveryPreview={item:null,raw:null,text:''};
  const palettes = [
    {sky:'#d4e7d5',sea:'#74b8b0',deep:'#569f9d',land:'#8eafa0',sand:'#e6d6ad',road:'#c3bfa1',green:'#7a9271',sun:'#fff2c1'},
    {sky:'#f5d7b6',sea:'#7eb9b2',deep:'#5eaaa6',land:'#b1b6a1',sand:'#f0d2a3',road:'#ccbb99',green:'#90946d',sun:'#fff4ce'},
    {sky:'#d9bdd0',sea:'#898db1',deep:'#696e96',land:'#9792a4',sand:'#d9c1b2',road:'#b4a2a8',green:'#757d89',sun:'#ffd3af'},
    {sky:'#324e68',sea:'#48778a',deep:'#315f75',land:'#3c6578',sand:'#b9bda7',road:'#839b9a',green:'#426c6c',sun:'#e7e4c6'}
  ];
  function persist() {try{return guard.save(C.encode(state));}catch{$('save-status').textContent='临时模式：存档校验失败，请保留本页';return false;}}
  function syncSaveStatus() {
    const messages={'replacement-failed':'未替换：保存失败，原存档保留，请导出后再试',conflict:'检测到其他页面变更：本页已停止保存。请点右上角⚙“设置与存档”，先导出再选择恢复',invalid:'原始存档受保护。请点右上角⚙“设置与存档”，导出或明确恢复','locks-unavailable':'临时模式：安全存档协调不可用，请导出备份','storage-unavailable':'临时模式：浏览器存储不可读，请导出备份','write-failed':'临时模式：保存失败，请导出备份',pending:'正在保存，请勿立即关闭页面',ready:'本机自动存档'};
    $('save-status').textContent=messages[guard.status];
    const protectedSave=guard.blocked||guard.failure;
    const journalSave=protectedSave?'存档状态：'+(guard.status==='conflict'?'本页已停止保存。请先导出双方材料，再明确选择恢复。':messages[guard.status]):'';
    if($('journal-save-status').textContent!==journalSave)$('journal-save-status').textContent=journalSave;
    $('journal-save-status').hidden=!protectedSave;
    syncRecovery();
  }
  function recoverySummary(item){
    if(!item)return '未选择可预览的恢复材料；读取失败时内容未知。';
    if(item.raw===null)return '所选材料：当时确认没有存档，不能恢复进度。';
    try{
      const value=C.decode(item.raw),r=value.run,quota=C.map(value.seed,value.stage).quota;
      const seconds=Math.ceil(Math.max(0,C.LENGTH-r.x)/C.speed(value));
      const status={ready:'准备出发',riding:'进行中（恢复后暂停）',paused:'暂停',cleared:'本站已送达',failed:'本站失败'}[r.status];
      return '所选材料预览：第 '+value.stage+' 站 · 剩余约 '+seconds+' 秒 · '+['左道','中道','右道'][r.lane]+' · 车况 '+r.hp+'/3 · 本站邮票 '+r.stamps+'/'+quota+' · '+status+'。';
    }catch{return '所选材料无法预览：不是可恢复的当前版本旅程；仍可导出原文保留。';}
  }
  function syncRecovery(){
    const select=$('recovery-choice'),previous=select.value;
    $('recovery').hidden=!guard.recovery.some(x=>x.raw!==null)&&!guard.protection&&!guard.unreadableObserved;
    $('recovery-note').textContent='保留的恢复材料仅在此页内存中，关闭或刷新前请导出。空缺表示当时确认没有存档；损坏原文也可导出。'+(guard.unreadableObserved?' 有一次存储读取失败，内容未知，不能当作无存档；该次未读取的原文没有备份。':'');
    select.innerHTML=guard.recovery.map(x=>'<option value="'+x.id+'">'+x.label+(x.raw===null?'（无存档）':'')+'</option>').join('');
    select.value=guard.recovery.some(x=>x.id===previous)?previous:guard.recovery[0]?.id||'';
    const selected=guard.recovery.find(x=>x.id===select.value);$('export-recovery').disabled=!selected||selected.raw===null;$('restore-recovery').disabled=!selected||selected.raw===null;
    if(selected!==recoveryPreview.item||selected?.raw!==recoveryPreview.raw)recoveryPreview={item:selected,raw:selected?.raw,text:recoverySummary(selected)};
    if($('recovery-preview').textContent!==recoveryPreview.text)$('recovery-preview').textContent=recoveryPreview.text;
  }
  function closeConfirm(){if($('confirm').open){ownedConfirmCloses.push(operation);$('confirm').close();}}
  function cancelOperation(save=true){operation++;confirmAction=null;$('confirm-ok').disabled=false;$('import-file').value='';closeConfirm();guard.resume();if(save)persist();}
  function startOperation(){cancelOperation(false);guard.suspend();saveDue=true;return operation;}
  function storageConflict(){cancelOperation(false);pause();syncSaveStatus();}
  function notify(text) { $('toast').textContent=text; $('toast').classList.add('show'); toastTime=2.2; }
  function clearToast() { toastTime=0;$('toast').textContent='';$('toast').classList.remove('show');flash=0;pickupFlash=0; }
  function initAudio() { if (!state.settings.sound) return; try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume().catch(()=>{}); } catch { state.settings.sound=false; } }
  function note(type) { if (!audio || !state.settings.sound || audio.state!=='running') return; try { const o=audio.createOscillator(),g=audio.createGain(); o.type=type==='hit'?'triangle':'sine'; o.frequency.setValueAtTime(type==='stamp'?740:type==='jump'?360:120,audio.currentTime); o.frequency.exponentialRampToValueAtTime(type==='stamp'?1100:80,audio.currentTime+.14);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.2); } catch {} }
  function refreshRoute() { route=C.map(state.seed,state.stage);visualLane=state.run.lane;sync(); }
  function sync() {
    const r=state.run;
    $('progress').style.width=(r.x/C.LENGTH*100)+'%';
    const feedback=F.live(state,route);
    const signature=[r.status,r.lane,r.hp,r.stamps,r.cooldown>0,feedback.text,state.stage,state.seed,state.settings.sound,Math.ceil(Math.max(0,C.LENGTH-r.x)/C.speed(state))].join('|');
    if(signature===lastHudSignature)return;
    lastHudSignature=signature;
    $('route').textContent=String(state.stage).padStart(2,'0')+' · '+C.THEMES[route.theme];
    $('stamps').textContent=Array.from({length:route.quota},(_,i)=>i<r.stamps?'✉':'▱').join(' ');
    $('stamps').setAttribute('aria-label',r.stamps+' 枚邮票，目标 '+route.quota+' 枚');
    $('stamps').classList.toggle('complete',r.stamps>=route.quota);
    $('stamp-count').textContent=r.stamps+' / '+route.quota;
    $('health').textContent=Array.from({length:3},(_,i)=>i<r.hp?'♥':'♡').join('');
    $('health').setAttribute('aria-label',r.hp+' 点车况');
    $('distance').textContent=Math.ceil(Math.max(0,C.LENGTH-r.x)/C.speed(state))+' s';
    $('progress').style.width=(r.x/C.LENGTH*100)+'%';
    $('sound').textContent=state.settings.sound?'♫':'♪';
    $('sound').setAttribute('aria-pressed',String(state.settings.sound));
    $('sound').setAttribute('aria-label',state.settings.sound?'关闭音效':'打开音效');
    $('jump-ready').textContent=feedback.jump.symbol;
    $('jump-state').textContent=feedback.jump.label;
    $('jump').dataset.state=feedback.jump.key;
    $('jump').setAttribute('aria-label',feedback.jump.label);
    $('riding-feedback').hidden=r.status!=='riding';
    $('riding-feedback').textContent=feedback.text;
    $('jump').disabled=r.status!=='riding'||r.cooldown>0;
    document.querySelectorAll('[data-lane]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.lane)===r.lane);b.setAttribute('aria-pressed',String(Number(b.dataset.lane)===r.lane));b.disabled=r.status!=='riding';});
    document.querySelectorAll('[data-direction]').forEach(b=>b.disabled=r.status!=='riding');
    $('pause').disabled=!['riding','paused'].includes(r.status);$('pause').textContent=r.status==='paused'?'继续':'暂停';$('pause').setAttribute('aria-label',r.status==='paused'?'继续游戏':'暂停游戏');
    $('overlay').hidden=r.status==='riding';
    $('card-tag').textContent=r.status==='cleared'?'✉ ✓':r.status==='failed'?'↻':'✉ → ⚑';
    $('overlay').dataset.state=r.status;
    $('mini-guide').hidden=r.status!=='ready';
    $('card-tip').hidden=r.status!=='failed';
    $('card-tip').textContent='';
    $('retry').hidden=r.status!=='paused';
    if(r.status==='ready') { $('card-title').textContent=route.quota+' 枚邮票，送到灯塔';$('card-copy').textContent=F.preparation(state,route);$('start').textContent='出发 ▶'; }
    if(r.status==='paused') { $('card-title').textContent='歇一下';$('card-copy').textContent='';$('start').textContent='继续 ▶'; }
    if(r.status==='failed') { const result=F.failure(state,route,C.speed(state));$('card-title').textContent=result.title;$('card-copy').textContent=result.copy;$('card-tip').textContent=result.tip;$('start').textContent='马上重试 ↻'; }
    if(r.status==='cleared') { $('card-title').textContent=r.hp===3?'完美投递 ✦':'送到啦！';$('card-copy').textContent='✉ '+r.stamps+'    '+Array.from({length:r.hp},()=> '♥').join('');$('start').textContent='下一站 →'; }
  }
  function pause() { const wasRiding=state.run.status==='riding';if(wasRiding)advanceWorld(performance.now(),true);held.clear();timeline.pause();if(wasRiding){if(state.run.status==='riding')state.run.status='paused';clearToast();persist();saveDue=false;sync();draw(0);finishInput(pendingHoldMark);pendingHoldMark=null;} }
  function begin(present=true) { if($('journal').open||$('confirm').open)return;held.clear();clearToast();if(state.run.status==='cleared'){C.next(state);timeline.pause();pendingHoldMark=null;refreshRoute();persist();saveDue=false;lastSave=0;if(present)draw(0);return;}initAudio();if(state.run.status==='failed'){state.run=C.newRun();visualLane=1;}state.run.status='riding';frameTime=performance.now();timeline.start(frameTime);pendingHoldMark=null;lastSave=1;sync();if(present)draw(0);canvas.focus({preventScroll:true}); }
  function inputMark(event,source){
    const handledAt=performance.now(),raw=Number(event?.timeStamp);
    let eventAt=Number.isFinite(raw)?raw:handledAt,eventClock=Number.isFinite(raw)?'dom-relative':'handler-fallback';
    if(eventAt>1e12&&Number.isFinite(performance.timeOrigin)){eventAt-=performance.timeOrigin;eventClock='epoch-normalized';}
    if(eventAt<0||eventAt>handledAt+1000){eventAt=handledAt;eventClock='handler-fallback';}
    return {sequence:++inputSequence,source,eventTimestamp:Number.isFinite(raw)?raw:null,eventAt,eventClock,handledAt};
  }
  function inputAction(action,mark,render=true,clearHold=false){
    if(render)advanceWorld(performance.now(),true);
    if(clearHold)held.clear();
    const previous=state.run.lane,accepted=C.act(state,action);
    if(action==='jump'&&accepted)note('jump');
    if(state.run.lane!==previous){steerDirection=Math.sign(state.run.lane-previous);steerUntil=performance.now()+80;}
    if(mark){mark.appliedAt=performance.now();mark.lane=state.run.lane;mark.accepted=accepted||previous!==state.run.lane;}
    sync();
    if(render){draw(0);finishInput(mark);pendingHoldMark=null;}
    return mark;
  }
  function finishInput(mark){
    if(!mark)return;
    mark.drawCompleteAt=performance.now();mark.eventToDrawMs=mark.eventClock==='handler-fallback'?null:Math.max(0,mark.drawCompleteAt-mark.eventAt);
    mark.handlerToDrawMs=Math.max(0,mark.drawCompleteAt-mark.handledAt);mark.rawFrameMs=rawFrameMs;
    // One bounded, local-only response sample. Draw completion is not display/input-to-photon timing.
    canvas.dataset.inputResponse=JSON.stringify(mark);
    inputSamples.push({...mark});if(inputSamples.length>16)inputSamples.shift();
    canvas.dataset.inputSamples=JSON.stringify(inputSamples);
  }
  function jump(event){inputAction('jump',inputMark(event,'jump'));}
  function ask(title,copy,fn,token=null){
    if(token===null)token=startOperation();if(token!==operation)return;
    pause();const observed=guard.inspect(),epoch=guard.epoch;
    if(guard.capability||!observed.readable)copy+=' 仅在本页临时打开，原存档不变；关闭前请导出。';
    else if(observed.raw!==guard.expected)copy+=' 存储内容与此页不同，确认会替换它；请先导出恢复材料。';
    $('confirm-title').textContent=title;$('confirm-copy').textContent=copy;
    const context={token,epoch,expected:observed.raw,readable:observed.readable,valid:()=>token===operation};
    confirmAction={token,run:()=>fn(context)};$('confirm-ok').disabled=false;$('confirm').showModal();
  }
  function closeJournal(save=true){cancelOperation(save);if($('journal').open){ownedJournalCloses.push(operation);$('journal').close();}sync();}
  function replaceState(value,context){
    if(!context.valid())return;
    const next=C.validate(value);if(next.run.status==='riding')next.run.status='paused';
    return guard.replace(C.encode(next),{...context,commit:()=>{
      clearToast();held.clear();timeline.pause();pendingHoldMark=null;state=next;visualLane=state.run.lane;
      refreshRoute();closeJournal(false);saveDue=false;lastSave=0;draw(0);
    }}).then(result=>{if(context.valid()&&['failed','conflict'].includes(result)){cancelOperation(false);saveDue=false;lastSave=0;$('journal-status').textContent='未替换：存档写入失败或已变化，当前旅程保持不变。请导出备份后再试。';}});
  }
  $('start').addEventListener('click',begin);
  $('pause').addEventListener('click',()=>state.run.status==='riding'?pause():begin());
  $('jump').addEventListener('click',jump);
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.button!==2)return;
    e.preventDefault();canvas.focus({preventScroll:true});
    if(state.run.status!=='riding')return;
    if(e.button===2){jump(e);return;}
    const rect=canvas.getBoundingClientRect();
    const lane=window.PelicanView.pickPointer(e.clientX,e.clientY,rect,displayedView);
    if(lane!==null)inputAction(lane,inputMark(e,'pointer-road'),true,true);
  });
  document.querySelectorAll('[data-lane]').forEach(b=>b.addEventListener('click',e=>{inputAction(Number(b.dataset.lane),inputMark(e,'lane-button'),true,true);}));
  document.querySelectorAll('[data-direction]').forEach(b=>b.addEventListener('click',e=>{inputAction(b.dataset.direction,inputMark(e,'direction-button'),true,true);}));
  function askRestart(){ask('重骑这一站？','将重新开始本站，保留种子、设置和历史投递记录。',context=>replaceState({...state,run:C.newRun()},context));}
  $('retry').addEventListener('click',askRestart);$('restart').addEventListener('click',askRestart);
  document.addEventListener('keydown',e=>{
    if($('journal').open||$('confirm').open||/INPUT|TEXTAREA/.test(e.target.tagName))return;
    const k=e.key.toLowerCase();
    if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','s','a','d','p','escape','r'].includes(k)){
      if(k===' '&&e.target.tagName==='BUTTON')return;
      e.preventDefault();if(e.repeat)return;
      const mark=inputMark(e,'keyboard'),wasRiding=state.run.status==='riding';
      if(wasRiding)advanceWorld(performance.now(),true);
      if(wasRiding&&state.run.status!=='riding'){mark.appliedAt=performance.now();mark.lane=state.run.lane;mark.accepted=false;mark.blockedBy=state.run.status;sync();draw(0);finishInput(mark);pendingHoldMark=null;return;}
      if(state.run.status==='cleared'&&k.startsWith('arrow')){begin();return;}
      if(state.run.status==='ready'&&k.startsWith('arrow'))begin(false);
      if(['arrowleft','a','arrowright','d'].includes(k)){
        if(state.run.status!=='riding')return;
        const direction=['arrowleft','a'].includes(k)?'up':'down';
        if(held.press(k,direction,performance.now()))inputAction(direction,mark);
      }
      else if(['arrowup','w',' '].includes(k))inputAction('jump',mark);
      else if(['arrowdown','s'].includes(k))inputAction(1,mark,true,true);
      else if(k==='r')askRestart();
      else if(k==='p'||k==='escape'){if(state.run.status==='riding')pause();else if(state.run.status==='paused')begin();}
    }
  });
  document.addEventListener('keyup',e=>{if(state.run.status==='riding')advanceWorld(performance.now(),true);held.release(e.key.toLowerCase(),performance.now());sync();draw(0);finishInput(pendingHoldMark);pendingHoldMark=null;});
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{pause();persist();});
  $('sound').addEventListener('click',()=>{state.settings.sound=!state.settings.sound;initAudio();if(state.settings.sound)note('stamp');persist();sync();});
  $('settings').addEventListener('click',()=>{pause();$('journal-info').textContent='正在第 '+state.stage+' 站 · 最远投递第 '+state.best+' 站 · 累计 '+state.total+' 枚邮票';$('reduced').checked=state.settings.reduced;$('seed').value=state.seed;$('journal-status').textContent='';syncSaveStatus();$('journal').showModal();});
  $('close-journal').addEventListener('click',()=>closeJournal());
  $('journal').addEventListener('cancel',e=>{e.preventDefault();closeJournal();});
  $('journal').addEventListener('close',()=>{if(ownedJournalCloses.length){ownedJournalCloses.shift();return;}cancelOperation();});
  $('reduced').addEventListener('change',()=>{state.settings.reduced=$('reduced').checked;persist();});
  $('new-seed').addEventListener('click',()=>{const token=startOperation(),raw=$('seed').value.trim(),n=Number(raw);if(!/^\d{1,10}$/.test(raw)||!Number.isInteger(n)||n<0||n>4294967295){cancelOperation();$('journal-status').textContent='请输入 0–4294967295 的整数种子。';return;}ask('开始一条新海岸？','将以种子 '+n+' 从第一站开始，替换现有旅程。可先取消并导出备份。',context=>{const next=C.fresh(n);next.settings={...state.settings};return replaceState(next,context);},token);});
  $('reset').addEventListener('click',()=>ask('重置全部旅程？','将替换本游戏的进度与设置，从默认种子重新出发。不会删除其他网站或游戏的数据。',context=>replaceState(C.fresh(),context)));
  $('cancel').addEventListener('click',()=>cancelOperation());
  $('confirm').addEventListener('cancel',e=>{e.preventDefault();cancelOperation();});
  $('confirm').addEventListener('close',()=>{if(ownedConfirmCloses.length){ownedConfirmCloses.shift();return;}cancelOperation();});
  $('confirm-ok').addEventListener('click',()=>{const action=confirmAction;confirmAction=null;if(action&&action.token===operation){$('confirm-ok').disabled=true;action.run();}});
  function download(raw,filename,message){try{const snapshot={raw,filename},blob=new Blob([snapshot.raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=snapshot.filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('journal-status').textContent=message+' 请在下载位置确认文件已保存。';}catch{$('journal-status').textContent='无法导出存档；浏览器可能禁止下载。';}}
  $('export').addEventListener('click',()=>{try{download(C.encode(state),'pelican-post-direct-save-v1.json','已请求导出此页旅程。');}catch{$('journal-status').textContent='此页旅程校验失败，未导出。';}});
  $('recovery-choice').addEventListener('change',syncRecovery);
  function wellFormed(text){for(let i=0;i<text.length;i++){const c=text.charCodeAt(i);if(c>=0xd800&&c<=0xdbff){const n=text.charCodeAt(++i);if(!(n>=0xdc00&&n<=0xdfff))return false;}else if(c>=0xdc00&&c<=0xdfff)return false;}return true;}
  $('export-recovery').addEventListener('click',()=>{const item=guard.recovery.find(x=>x.id===$('recovery-choice').value);if(!item||item.raw===null)return;
    if(wellFormed(item.raw))download(item.raw,'pelican-post-recovery-'+item.id+'.json','已请求导出所选原文。');
    else download(JSON.stringify({format:'pelican-post-raw-recovery',version:1,source:item.id,raw:item.raw}),'pelican-post-recovery-'+item.id+'-utf16.json','原文含不完整Unicode，已请求导出保留全部字符的恢复包；它不是普通旅程导入文件。');
  });
  $('restore-recovery').addEventListener('click',()=>{const token=startOperation(),item=guard.recovery.find(x=>x.id===$('recovery-choice').value);try{if(!item||item.raw===null)throw Error('No snapshot');const incoming=C.decode(item.raw);ask('恢复这份保留材料？','来源：'+item.label+'。将恢复第 '+incoming.stage+' 站（种子 '+incoming.seed+'），并替换当前存档。',context=>replaceState(incoming,context),token);}catch{if(token===operation){cancelOperation();$('journal-status').textContent='这份原文不能作为当前版本旅程恢复；仍可导出保留。当前旅程不变。';}}});
  $('import').addEventListener('click',()=>{startOperation();$('import-file').click();});
  $('import-file').addEventListener('cancel',()=>cancelOperation());
  $('import-file').addEventListener('change',async()=>{
    const f=$('import-file').files[0],token=startOperation();$('import-file').value='';if(!f){cancelOperation();return;}
    try{if(f.size>65536)throw Error('存档文件过大');const text=await f.text();if(token!==operation)return;const incoming=C.decode(text);if(token!==operation)return;ask('导入这份旅程？','将恢复第 '+incoming.stage+' 站（种子 '+incoming.seed+'），并替换当前存档。',context=>replaceState(incoming,context),token);}
    catch{if(token!==operation)return;cancelOperation();$('journal-status').textContent='导入失败：文件损坏、版本不支持或格式无效。当前旅程保持不变。';}
  });
  window.addEventListener('storage',event=>guard.observe(event));
  function resize(){displayedView=null;const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(b.width*dpr);canvas.height=Math.round(b.height*dpr);W=Math.max(480,b.width);H=440;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
  new ResizeObserver(resize).observe(canvas);
  function draw(dt){
    const r=state.run;
    if(r.status==='riding')time+=dt;
    visualLane=r.lane;
    window.PelicanView.draw(ctx,W,H,state,route,palettes[route.theme],time,visualLane,flash,pickupFlash,(steerDirection*Math.max(0,(steerUntil-performance.now())/80))||0);
    displayedView={width:W,height:H,cameraLane:visualLane,jump:window.PelicanView.jumpHeight(r.jump)};
  }
  function advanceWorld(now,flush=false){
    if(state.run.status!=='riding'){timeline.pause();return;}
    const result=timeline.advance(now,{
      flush,
      step:dt=>{
        const wasAirborne=state.run.jump>0;
        const events=C.step(state,dt,route);
        for(const e of events){
          if(e==='stamp'){note('stamp');pickupFlash=.5;notify(state.run.stamps>=route.quota?'✉ ✓ → ⚑':'✉ +1');}
          if(e==='hit'){flash=.65;note('hit');notify(F.hitText(state,route,wasAirborne&&state.run.jump<=0));}
          if(e==='cleared')notify('✉ ✓');
        }
        if(events.length)saveDue=true;
        if(state.run.status!=='riding'){held.clear();return false;}
        return true;
      },
      nextEvent:()=>held.active?held.nextAt:Infinity,
      onEvent:at=>{
        const action=held.poll(at);
        if(action){const mark=inputMark(null,'held-direction');mark.scheduledAt=at;pendingHoldMark=inputAction(action,mark,false);}
        return state.run.status==='riding';
      }
    });
    lastSave+=result.advancedMs/1000;
    if(result.stalled){state.run.status='paused';held.clear();timeline.pause();saveDue=true;clearToast();}
  }
  function frame(now){
    rawFrameMs=lastRafAt===null?0:Math.max(0,now-lastRafAt);lastRafAt=now;
    const wallNow=performance.now(),dt=Math.min(.25,Math.max(0,wallNow-frameTime)/1000);frameTime=wallNow;
    canvas.dataset.rawFrameMs=String(rawFrameMs);
    advanceWorld(wallNow);
    sync();
    flash=Math.max(0,flash-dt);pickupFlash=Math.max(0,pickupFlash-dt);toastTime=Math.max(0,toastTime-dt);
    if(!toastTime)$('toast').classList.remove('show');
    draw(dt);finishInput(pendingHoldMark);pendingHoldMark=null;
    if(saveDue||lastSave>1){persist();lastSave=0;saveDue=false;}
    requestAnimationFrame(frame);
  }
  if(loaded.error||guard.initial==='')guard.protectInvalid();syncSaveStatus();resize();sync();requestAnimationFrame(frame);
})();
