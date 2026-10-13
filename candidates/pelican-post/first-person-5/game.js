/* Original Canvas artwork and browser integration — Pelican Post. */
(() => {
  'use strict';
  const C = window.Pelican, $ = id => document.getElementById(id);
  const storage = {getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)};
  const loaded = C.load(storage,20261012);
  let state = loaded.state, route = C.map(state.seed,state.stage), saveLocked = !!loaded.error;
  let saveFailed = false, lastSave = 0, audio = null, toastTime = 0, confirmAction = null;
  let W = 960, H = 440, time = 0, frameTime = 0, visualLane = state.run.lane, flash = 0, pickupFlash = 0;
  const canvas = $('game'), ctx = canvas.getContext('2d');
  let displayedView=null, inputSequence=0, steerDirection=0, steerUntil=0, rawFrameMs=0, lastRafAt=null;
  const held=new window.PelicanInput.DirectionHold(140);
  const inputSamples=[];
  const timeline=new window.PelicanClock.Timeline();
  let saveDue=false,pendingHoldMark=null;
  let lastHudSignature=null;
  const palettes = [
    {sky:'#d4e7d5',sea:'#74b8b0',deep:'#569f9d',land:'#8eafa0',sand:'#e6d6ad',road:'#c3bfa1',green:'#7a9271',sun:'#fff2c1'},
    {sky:'#f5d7b6',sea:'#7eb9b2',deep:'#5eaaa6',land:'#b1b6a1',sand:'#f0d2a3',road:'#ccbb99',green:'#90946d',sun:'#fff4ce'},
    {sky:'#d9bdd0',sea:'#898db1',deep:'#696e96',land:'#9792a4',sand:'#d9c1b2',road:'#b4a2a8',green:'#757d89',sun:'#ffd3af'},
    {sky:'#324e68',sea:'#48778a',deep:'#315f75',land:'#3c6578',sand:'#b9bda7',road:'#839b9a',green:'#426c6c',sun:'#e7e4c6'}
  ];
  function persist() {
    if (saveLocked) { $('save-status').textContent = '临时旅程：原存档保留，请到手账导入或明确重置'; return false; }
    const ok = C.save(storage,state); saveFailed = !ok;
    $('save-status').textContent = ok ? '本机自动存档' : '临时模式：浏览器无法保存，请导出备份';
    return ok;
  }
  function notify(text) { $('toast').textContent=text; $('toast').classList.add('show'); toastTime=2.2; }
  function initAudio() { if (!state.settings.sound) return; try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume().catch(()=>{}); } catch { state.settings.sound=false; } }
  function note(type) { if (!audio || !state.settings.sound || audio.state!=='running') return; try { const o=audio.createOscillator(),g=audio.createGain(); o.type=type==='hit'?'triangle':'sine'; o.frequency.setValueAtTime(type==='stamp'?740:type==='jump'?360:120,audio.currentTime); o.frequency.exponentialRampToValueAtTime(type==='stamp'?1100:80,audio.currentTime+.14);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.2); } catch {} }
  function refreshRoute() { route=C.map(state.seed,state.stage);visualLane=state.run.lane;sync(); }
  function sync() {
    const r=state.run;
    $('progress').style.width=(r.x/C.LENGTH*100)+'%';
    const signature=[r.status,r.lane,r.hp,r.stamps,r.cooldown>0,state.stage,state.seed,state.settings.sound,Math.ceil(Math.max(0,C.LENGTH-r.x)/C.speed(state))].join('|');
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
    $('jump-ready').textContent=r.cooldown>0?'·':'↑';
    $('jump').disabled=r.status!=='riding'||r.cooldown>0;
    document.querySelectorAll('[data-lane]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.lane)===r.lane);b.setAttribute('aria-pressed',String(Number(b.dataset.lane)===r.lane));b.disabled=r.status!=='riding';});
    document.querySelectorAll('[data-direction]').forEach(b=>b.disabled=r.status!=='riding');
    $('pause').disabled=!['riding','paused'].includes(r.status);$('pause').textContent=r.status==='paused'?'继续':'暂停';$('pause').setAttribute('aria-label',r.status==='paused'?'继续游戏':'暂停游戏');
    $('overlay').hidden=r.status==='riding';
    $('card-tag').textContent=r.status==='cleared'?'✉ ✓':r.status==='failed'?'↻':'✉ → ⚑';
    $('mini-guide').hidden=!['ready','paused'].includes(r.status);
    $('retry').hidden=r.status!=='paused';
    if(r.status==='ready') { $('card-title').textContent=route.quota+' 枚邮票，送到灯塔';$('card-copy').textContent='';$('start').textContent='出发 ▶'; }
    if(r.status==='paused') { $('card-title').textContent='歇一下';$('card-copy').textContent='';$('start').textContent='继续 ▶'; }
    if(r.status==='failed') { $('card-title').textContent=r.hp===0?'再骑一次！':'还差 '+Math.max(0,route.quota-r.stamps)+' 枚';$('card-copy').textContent='';$('start').textContent='马上重试 ↻'; }
    if(r.status==='cleared') { $('card-title').textContent=r.hp===3?'完美投递 ✦':'送到啦！';$('card-copy').textContent='✉ '+r.stamps+'    '+Array.from({length:r.hp},()=> '♥').join('');$('start').textContent='下一站 →'; }
  }
  function pause() { const wasRiding=state.run.status==='riding';if(wasRiding)advanceWorld(performance.now(),true);held.clear();timeline.pause();if(wasRiding){if(state.run.status==='riding')state.run.status='paused';persist();saveDue=false;sync();draw(0);finishInput(pendingHoldMark);pendingHoldMark=null;} }
  function begin(present=true) { if($('journal').open||$('confirm').open)return;held.clear();initAudio();if(state.run.status==='cleared'){C.next(state);refreshRoute();}else if(state.run.status==='failed'){state.run=C.newRun();visualLane=1;}state.run.status='riding';frameTime=performance.now();timeline.start(frameTime);pendingHoldMark=null;lastSave=1;sync();if(present)draw(0);canvas.focus({preventScroll:true}); }
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
  function ask(title,copy,fn){pause();$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;confirmAction=fn;$('confirm').showModal();}
  function restart(){held.clear();timeline.pause();pendingHoldMark=null;state.run=C.newRun();visualLane=1;persist();sync();}
  function closeJournal(){$('journal').close();sync();}
  function replaceState(value){held.clear();timeline.pause();pendingHoldMark=null;state=value;if(state.run.status==='riding')state.run.status='paused';saveLocked=false;persist();refreshRoute();closeJournal();}
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
  function askRestart(){ask('重骑这一站？','将重新开始本站，保留种子、设置和历史投递记录。',()=>{restart();closeJournal();});}
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
      if(['ready','failed','cleared'].includes(state.run.status)&&k.startsWith('arrow'))begin(false);
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
  $('settings').addEventListener('click',()=>{pause();$('journal-info').textContent='正在第 '+state.stage+' 站 · 最远投递第 '+state.best+' 站 · 累计 '+state.total+' 枚邮票';$('reduced').checked=state.settings.reduced;$('seed').value=state.seed;$('journal-status').textContent=saveLocked?'原存档无法读取，已保留。导出可备份原始数据；重置或导入将替换它。':saveFailed?'当前无法使用浏览器存储，请导出备份。':'';$('journal').showModal();});
  $('close-journal').addEventListener('click',closeJournal);
  $('reduced').addEventListener('change',()=>{state.settings.reduced=$('reduced').checked;persist();});
  $('new-seed').addEventListener('click',()=>{const raw=$('seed').value.trim(),n=Number(raw);if(!/^\d{1,10}$/.test(raw)||!Number.isInteger(n)||n<0||n>4294967295){$('journal-status').textContent='请输入 0–4294967295 的整数种子。';return;}ask('开始一条新海岸？','将以种子 '+n+' 从第一站开始，替换现有旅程。可先取消并导出备份。',()=>{const s=C.fresh(n);s.settings={...state.settings};replaceState(s);});});
  $('reset').addEventListener('click',()=>ask('重置全部旅程？','将清除本游戏的进度与设置，从默认种子重新出发。不会删除其他网站或游戏的数据。',()=>replaceState(C.fresh())));
  $('cancel').addEventListener('click',()=>{$('confirm').close();confirmAction=null;});$('confirm').addEventListener('cancel',()=>{confirmAction=null;});
  $('confirm-ok').addEventListener('click',()=>{const fn=confirmAction;confirmAction=null;$('confirm').close();if(fn)fn();});
  $('export').addEventListener('click',()=>{try{let original=null;try{if(saveLocked)original=storage.getItem(C.KEY);}catch{}const data=original||C.encode(state),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=original?'pelican-post-recovery.json':'pelican-post-direct-save-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('journal-status').textContent=original?'已导出原始存档，便于保留或恢复。':'已导出当前旅程备份。';}catch{$('journal-status').textContent='无法导出存档；浏览器可能禁止下载。';}});
  $('import').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{const f=$('import-file').files[0];$('import-file').value='';if(!f)return;try{if(f.size>65536)throw Error('存档文件过大');const incoming=C.decode(await f.text());ask('导入这份旅程？','将恢复第 '+incoming.stage+' 站（种子 '+incoming.seed+'），并替换当前存档。',()=>replaceState(incoming));}catch{$('journal-status').textContent='导入失败：文件损坏、版本不支持或格式无效。当前旅程保持不变。';}});
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
        const events=C.step(state,dt,route);
        for(const e of events){
          if(e==='stamp'){note('stamp');pickupFlash=.5;notify(state.run.stamps>=route.quota?'✉ ✓ → ⚑':'✉ +1');}
          if(e==='hit'){flash=.65;note('hit');notify('♥ −1');}
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
    if(result.stalled){state.run.status='paused';held.clear();timeline.pause();saveDue=true;notify('画面暂停，点继续');}
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
  $('save-status').textContent=loaded.notice;if(saveLocked)persist();resize();sync();requestAnimationFrame(frame);
})();
