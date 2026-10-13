/* Original Canvas artwork and browser integration — Pelican Post. */
(() => {
  'use strict';
  const C = window.Pelican, $ = id => document.getElementById(id);
  const storage = {getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)};
  const loaded = C.load(storage,20261012);
  let state = loaded.state, route = C.map(state.seed,state.stage), saveLocked = !!loaded.error;
  let saveFailed = false, lastSave = 0, audio = null, toastTime = 0, confirmAction = null;
  let W = 960, H = 440, time = 0, frameTime = 0, visualLane = state.run.lane, flash = 0;
  const canvas = $('game'), ctx = canvas.getContext('2d');
  const palettes = [
    {sky:'#d4e7d5',sea:'#74b8b0',deep:'#569f9d',land:'#8eafa0',sand:'#e6d6ad',road:'#c3bfa1',green:'#7a9271',sun:'#fff2c1'},
    {sky:'#f5d7b6',sea:'#7eb9b2',deep:'#5eaaa6',land:'#b1b6a1',sand:'#f0d2a3',road:'#ccbb99',green:'#90946d',sun:'#fff4ce'},
    {sky:'#d9bdd0',sea:'#898db1',deep:'#696e96',land:'#9792a4',sand:'#d9c1b2',road:'#b4a2a8',green:'#757d89',sun:'#ffd3af'},
    {sky:'#324e68',sea:'#48778a',deep:'#315f75',land:'#3c6578',sand:'#b9bda7',road:'#839b9a',green:'#426c6c',sun:'#e7e4c6'}
  ];
  function persist() {
    if (saveLocked) { $('save-status').textContent = '临时旅程：原存档保留，请到手账导入或明确重置'; return false; }
    const ok = C.save(storage,state); saveFailed = !ok;
    $('save-status').textContent = ok ? '旅程已自动保存 · 仅此浏览器' : '临时模式：浏览器无法保存，请导出备份';
    return ok;
  }
  function notify(text) { $('toast').textContent=text; $('toast').classList.add('show'); toastTime=2.2; }
  function initAudio() { if (!state.settings.sound) return; try { audio ||= new (window.AudioContext||window.webkitAudioContext)(); audio.resume().catch(()=>{}); } catch { state.settings.sound=false; } }
  function note(type) { if (!audio || !state.settings.sound || audio.state!=='running') return; try { const o=audio.createOscillator(),g=audio.createGain(); o.type=type==='hit'?'triangle':'sine'; o.frequency.setValueAtTime(type==='stamp'?740:type==='jump'?360:120,audio.currentTime); o.frequency.exponentialRampToValueAtTime(type==='stamp'?1100:80,audio.currentTime+.14);g.gain.setValueAtTime(.045,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.18);o.connect(g).connect(audio.destination);o.start();o.stop(audio.currentTime+.2); } catch {} }
  function refreshRoute() { route=C.map(state.seed,state.stage);visualLane=state.run.lane;sync(); }
  function sync() {
    const r=state.run;
    $('route').textContent=String(state.stage).padStart(2,'0')+' / '+C.THEMES[route.theme];
    $('stamps').textContent=r.stamps+' / '+route.quota;
    $('health').textContent=Array.from({length:3},(_,i)=>i<r.hp?'●':'○').join(' '); $('health').setAttribute('aria-label',r.hp+' 点车况');
    $('distance').textContent='距灯塔 '+Math.ceil(C.LENGTH-r.x)+' m';$('progress').style.width=(r.x/C.LENGTH*100)+'%';
    $('wind').textContent=route.wind<0?'↜ 轻轻的逆风':route.wind>0?'↝ 顺风，向前！':'〰 海风恰好';
    $('sound').textContent='音效 '+(state.settings.sound?'开':'关');$('sound').setAttribute('aria-pressed',String(state.settings.sound));
    $('jump-ready').textContent=r.cooldown>0?r.cooldown.toFixed(1)+' s':'就绪 ↗';
    $('jump').disabled=r.status!=='riding'||r.cooldown>0;
    document.querySelectorAll('[data-lane]').forEach(b=>{b.classList.toggle('selected',Number(b.dataset.lane)===r.lane);b.setAttribute('aria-pressed',String(Number(b.dataset.lane)===r.lane));b.disabled=r.status!=='riding';});
    $('pause').disabled=!['riding','paused'].includes(r.status);$('pause').textContent=r.status==='paused'?'▶':'Ⅱ';$('pause').setAttribute('aria-label',r.status==='paused'?'继续游戏':'暂停游戏');
    $('overlay').hidden=r.status==='riding';
    $('card-tag').textContent='POSTCARD NO. '+String(state.stage).padStart(3,'0');
    $('mini-guide').hidden=!['ready','paused'].includes(r.status);
    $('retry').hidden=!['paused','cleared'].includes(r.status);
    if(r.status==='ready') { $('card-title').textContent=state.stage===1?'今天，骑到灯塔去。':'下一站，新的海风。';$('card-copy').innerHTML='收集至少 '+route.quota+' 枚邮票，平安到达终点。<br>换道绕开螃蟹与浮木，或轻轻一跃。';$('start').textContent=state.stage===1?'开始第一封投递 ↗':'出发，第 '+state.stage+' 站 ↗'; }
    if(r.status==='paused') { $('card-title').textContent='在海风里歇一会儿。';$('card-copy').textContent='旅程已暂停。准备好后继续，前面的灯塔还在等你。';$('start').textContent='继续骑行 ↗'; }
    if(r.status==='failed') { $('card-title').textContent=r.hp===0?'单车需要歇一歇。':'还差几枚邮票。';$('card-copy').textContent=r.hp===0?'换条车道绕开路障，或在接近时跳跃。邮票不用全部收集。':'这站需要 '+route.quota+' 枚，你带回了 '+r.stamps+' 枚。沿途共有 14 枚，再试一次吧。';$('start').textContent='重骑这一站 ↻'; }
    if(r.status==='cleared') { $('card-title').textContent='海风，把信送到了。';$('card-copy').textContent='第 '+state.stage+' 站投递完成 · '+r.stamps+' 枚邮票 · '+r.hp+' 点车况。下一段海岸已为你展开。';$('start').textContent='骑向下一站 ↗'; }
  }
  function pause() { if(state.run.status==='riding'){state.run.status='paused';persist();sync();} }
  function begin() { if($('journal').open||$('confirm').open)return;initAudio();if(state.run.status==='cleared'){C.next(state);refreshRoute();}else if(state.run.status==='failed'){state.run=C.newRun();}state.run.status='riding';frameTime=performance.now();persist();sync();canvas.focus({preventScroll:true}); }
  function jump(){if(C.act(state,'jump'))note('jump');sync();}
  function ask(title,copy,fn){pause();$('confirm-title').textContent=title;$('confirm-copy').textContent=copy;confirmAction=fn;$('confirm').showModal();}
  function restart(){state.run=C.newRun();visualLane=1;persist();sync();}
  function closeJournal(){$('journal').close();sync();}
  function replaceState(value){state=value;if(state.run.status==='riding')state.run.status='paused';saveLocked=false;persist();refreshRoute();closeJournal();}
  $('start').addEventListener('click',begin);
  $('pause').addEventListener('click',()=>state.run.status==='riding'?pause():begin());
  $('jump').addEventListener('click',jump);canvas.addEventListener('pointerdown',e=>{if(e.button===0){jump();canvas.focus({preventScroll:true});}});
  document.querySelectorAll('[data-lane]').forEach(b=>b.addEventListener('click',()=>{C.act(state,Number(b.dataset.lane));sync();}));
  function askRestart(){ask('重骑这一站？','将重新开始本站，保留种子、设置和历史投递记录。',()=>{restart();closeJournal();});}
  $('retry').addEventListener('click',askRestart);$('restart').addEventListener('click',askRestart);
  document.addEventListener('keydown',e=>{
    if($('journal').open||$('confirm').open||/INPUT|TEXTAREA/.test(e.target.tagName))return;
    const k=e.key.toLowerCase();
    if(['arrowup','arrowdown','arrowleft','arrowright',' ','w','s','a','d','p','escape','r'].includes(k)){
      if(k===' '&&e.target.tagName==='BUTTON')return;
      e.preventDefault();if(e.repeat)return;
      if(['arrowup','arrowleft','w','a'].includes(k))C.act(state,'up');
      else if(['arrowdown','arrowright','s','d'].includes(k))C.act(state,'down');
      else if(k===' ')jump();else if(k==='r')askRestart();
      else if(k==='p'||k==='escape'){if(state.run.status==='riding')pause();else if(state.run.status==='paused')begin();}
      sync();
    }
  });
  window.addEventListener('blur',pause);document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',()=>{pause();persist();});
  $('sound').addEventListener('click',()=>{state.settings.sound=!state.settings.sound;initAudio();if(state.settings.sound)note('stamp');persist();sync();});
  $('settings').addEventListener('click',()=>{pause();$('journal-info').textContent='正在第 '+state.stage+' 站 · 最远投递第 '+state.best+' 站 · 累计 '+state.total+' 枚邮票';$('reduced').checked=state.settings.reduced;$('seed').value=state.seed;$('journal-status').textContent=saveLocked?'原存档无法读取，已保留。导出可备份原始数据；重置或导入将替换它。':saveFailed?'当前无法使用浏览器存储，请导出备份。':'';$('journal').showModal();});
  $('close-journal').addEventListener('click',closeJournal);
  $('reduced').addEventListener('change',()=>{state.settings.reduced=$('reduced').checked;persist();});
  $('new-seed').addEventListener('click',()=>{const raw=$('seed').value.trim(),n=Number(raw);if(!/^\d{1,10}$/.test(raw)||!Number.isInteger(n)||n<0||n>4294967295){$('journal-status').textContent='请输入 0–4294967295 的整数种子。';return;}ask('开始一条新海岸？','将以种子 '+n+' 从第一站开始，替换现有旅程。可先取消并导出备份。',()=>{const s=C.fresh(n);s.settings={...state.settings};replaceState(s);});});
  $('reset').addEventListener('click',()=>ask('重置全部旅程？','将清除本游戏的进度与设置，从默认种子重新出发。不会删除其他网站或游戏的数据。',()=>replaceState(C.fresh())));
  $('cancel').addEventListener('click',()=>{$('confirm').close();confirmAction=null;});$('confirm').addEventListener('cancel',()=>{confirmAction=null;});
  $('confirm-ok').addEventListener('click',()=>{const fn=confirmAction;confirmAction=null;$('confirm').close();if(fn)fn();});
  $('export').addEventListener('click',()=>{try{let original=null;try{if(saveLocked)original=storage.getItem(C.KEY);}catch{}const data=original||C.encode(state),blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=original?'pelican-post-recovery.json':'pelican-post-save-v1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);$('journal-status').textContent=original?'已导出原始存档，便于保留或恢复。':'已导出当前旅程备份。';}catch{$('journal-status').textContent='无法导出存档；浏览器可能禁止下载。';}});
  $('import').addEventListener('click',()=>$('import-file').click());
  $('import-file').addEventListener('change',async()=>{const f=$('import-file').files[0];$('import-file').value='';if(!f)return;try{if(f.size>65536)throw Error('存档文件过大');const incoming=C.decode(await f.text());ask('导入这份旅程？','将恢复第 '+incoming.stage+' 站（种子 '+incoming.seed+'），并替换当前存档。',()=>replaceState(incoming));}catch{$('journal-status').textContent='导入失败：文件损坏、版本不支持或格式无效。当前旅程保持不变。';}});
  function resize(){const b=canvas.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2);canvas.width=Math.round(b.width*dpr);canvas.height=Math.round(b.height*dpr);W=Math.max(480,b.width);H=440;ctx.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);}
  new ResizeObserver(resize).observe(canvas);
  function ellipse(x,y,rx,ry,color){ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();}
  function path(points,fill,stroke,width=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(...p):ctx.moveTo(...p));if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.stroke();}}
  function line(points,color,width=2){path(points,null,color,width);}
  function lighthouse(x,y,scale=1){ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);path([[-14,0],[14,0],[10,-75],[-9,-75]],'#f9f1d2');path([[-11,-30],[12,-30],[11,-43],[-10,-43]],'#d77e66');ctx.fillStyle='#3f6966';ctx.fillRect(-13,-82,27,10);ctx.fillStyle='#f3ca77';ctx.fillRect(-8,-96,17,14);path([[-16,-96],[17,-96],[0,-108]],'#355c5b');ctx.fillStyle='#356362';ctx.fillRect(-3,-15,7,15);ctx.restore();}
  function cloud(x,y,s){ellipse(x,y,32*s,10*s,'#fffbe28c');ellipse(x-14*s,y-6*s,16*s,13*s,'#fffbe28c');ellipse(x+9*s,y-10*s,20*s,16*s,'#fffbe28c');}
  function background(p,t){
    ctx.fillStyle=p.sky;ctx.fillRect(0,0,W,H);ellipse(W*.77,63,26,26,p.sun);
    if(route.theme===3){for(let i=0;i<28;i++){const x=(i*117+33)%W,y=16+(i*47)%105;ellipse(x,y,1,1,'#f0ebd3');}}
    cloud(W*.2-(state.run.x*.035%W),65,1);cloud(W*.62-(state.run.x*.02%W),43,.65);cloud(W*.95,94,.8);
    path([[0,145],[W*.11,133],[W*.2,143],[W*.35,113],[W*.48,141],[W*.63,124],[W*.83,141],[W,123],[W,175],[0,175]],p.land);
    ctx.fillStyle=p.sea;ctx.fillRect(0,151,W,106);
    for(let j=0;j<6;j++){const y=163+j*16;ctx.strokeStyle=j%2?'#eaf4d633':p.deep;ctx.lineWidth=1.5;ctx.beginPath();for(let x=-20;x<W+20;x+=10){const yy=y+Math.sin(x*.025+t*.65+j)*2; x===-20?ctx.moveTo(x,yy):ctx.lineTo(x,yy);}ctx.stroke();}
    const rockX=W*.79-state.run.x*.045;path([[rockX-90,207],[rockX-55,188],[rockX-34,192],[rockX-13,178],[rockX+35,201],[rockX+87,213]],p.land);lighthouse(rockX,191,.6);
    ctx.save();ctx.translate(W*.44-state.run.x*.07,172);path([[0,0],[19,0],[10,6],[4,6]],'#486e6a');line([[9,-27],[9,0]],'#4b7067',1);path([[7,-25],[-4,-3],[7,-3]],'#fff3d2');ctx.restore();
    for(let i=0;i<3;i++){const bx=(W*.3+i*42+t*4)%W,by=95+Math.sin(i+t*.3)*8;ctx.beginPath();ctx.moveTo(bx-6,by+2);ctx.quadraticCurveTo(bx-3,by-3,bx,by);ctx.quadraticCurveTo(bx+4,by-3,bx+8,by);ctx.strokeStyle='#3f76716e';ctx.lineWidth=1.5;ctx.stroke();}
    ctx.beginPath();ctx.moveTo(0,228);for(let x=0;x<=W+20;x+=20)ctx.lineTo(x,225+Math.sin((x+state.run.x*.12)*.008)*10);ctx.lineTo(W,H);ctx.lineTo(0,H);ctx.closePath();ctx.fillStyle=p.sand;ctx.fill();
    ctx.beginPath();for(let x=0;x<=W+20;x+=15){const y=228+Math.sin((x+state.run.x*.12)*.008)*10; x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.strokeStyle='#fff5dd';ctx.lineWidth=4;ctx.stroke();
    ctx.fillStyle=p.road;ctx.fillRect(0,251,W,166);ctx.fillStyle='#fff5d338';ctx.fillRect(0,250,W,3);ctx.fillRect(0,416,W,3);
    ctx.setLineDash([18,19]);ctx.lineDashOffset=state.run.x;line([[0,302],[W,302]],'#fff4d147',1);line([[0,357],[W,357]],'#fff4d147',1);ctx.setLineDash([]);
    ctx.fillStyle=p.green;ctx.fillRect(0,420,W,20);
    for(let i=0;i<Math.ceil(W/120)+2;i++){const x=i*120-(state.run.x*.8%120);line([[x,435],[x-7,419],[x+2,430],[x+7,414]],'#51775b77',2);ellipse(x+44,436,15,3,'#3e735432');}
    if(!state.settings.reduced){for(let i=0;i<6;i++){const x=(i*187-t*90)%(W+100);line([[x,117+i%2*23],[x+30,116+i%2*23],[x+44,119+i%2*23]],'#f3f7e17a',1);}}
  }
  const laneY = lane => 277+lane*55;
  function stamp(x,y){ctx.save();ctx.translate(x,y-19);ctx.rotate(-.12);ctx.fillStyle='#fff6d9';ctx.strokeStyle='#dba260';ctx.lineWidth=2;ctx.fillRect(-16,-15,32,29);ctx.strokeRect(-12,-11,24,21);for(let i=-12;i<=12;i+=8){ellipse(i,-15,2,2,'#dbbf8c');ellipse(i,14,2,2,'#dbbf8c');}path([[-9,-5],[9,-5],[9,6],[-9,6]],'#e4a465');line([[-9,-5],[0,1],[9,-5]],'#fff4d5',1.5);ctx.restore();}
  function obstacle(o,x,y){ellipse(x,y+5,24,6,'#47584f25');if(o.type==='wood'){ctx.save();ctx.translate(x,y-9);ctx.rotate(-.1);ctx.fillStyle='#a77750';ctx.fillRect(-26,-8,52,17);ellipse(-26,.5,5,8.5,'#c09767');ellipse(26,.5,5,8.5,'#8e6848');line([[-19,-3],[20,-3]],'#d0a67a',2);line([[-12,3],[16,3]],'#825e45',1);ctx.restore();}else{ellipse(x,y-5,15,10,'#d36f50');for(const side of [-1,1]){line([[x+side*9,y-2],[x+side*21,y+2],[x+side*26,y-2]],'#ad5f45',2);line([[x+side*10,y-8],[x+side*21,y-17]],'#c8684f',3);ellipse(x+side*22,y-19,6,5,'#e8825a');line([[x+side*5,y-12],[x+side*7,y-20]],'#bd6249',3);ellipse(x+side*7,y-21,2.5,3,'#fcf0ce');ellipse(x+side*7,y-22,1,1.5,'#264b46');}}}
  function pelican(x,y,t){
    const r=state.run,jumpY=r.jump>0?Math.sin((1-r.jump/.85)*Math.PI)*70:0;ellipse(x,y+7,49-jumpY*.18,9,'#355a4930');
    ctx.save();ctx.translate(x,y-jumpY);if(flash>0&&Math.floor(flash*12)%2)ctx.globalAlpha=.5;
    const pedal=t*9, wheel=t*4;
    for(const wx of [-32,36]){ellipse(wx,-15,21,21,'#254c49');ellipse(wx,-15,17,17,'#e6d7b5');ellipse(wx,-15,14.5,14.5,'#bdc8af');for(let i=0;i<8;i++){const a=wheel+i*Math.PI/4;line([[wx,-15],[wx+Math.cos(a)*15,-15+Math.sin(a)*15]],'#52796b',1);}ellipse(wx,-15,3,3,'#fff3d2');}
    line([[-32,-15],[-12,-48],[7,-15],[-32,-15]],'#e48657',4);line([[-12,-48],[23,-48],[7,-15]],'#df7650',4);line([[36,-15],[22,-58],[30,-61]],'#2f6761',4);line([[-12,-48],[-15,-58]],'#41655b',3);line([[-23,-59],[-8,-59]],'#284d49',5);
    ellipse(7,-15,5,5,'#52776a');line([[7,-15],[7+Math.cos(pedal)*10,-15+Math.sin(pedal)*10]],'#3c6358',3);line([[9,-44],[1,-34],[7+Math.cos(pedal)*10,-15+Math.sin(pedal)*10]],'#e0a350',5);
    path([[-35,-71],[-55,-87],[-44,-62],[-27,-57]],'#fff4d4');ellipse(-15,-68,29,22,'#fff7df');ellipse(-22,-65,17,12,'#e5dfc1');line([[-35,-67],[-15,-58]],'#c8c9ad',2);
    ctx.beginPath();ctx.moveTo(-1,-57);ctx.bezierCurveTo(18,-63,4,-91,12,-105);ctx.bezierCurveTo(23,-118,40,-106,31,-96);ctx.bezierCurveTo(21,-87,24,-65,8,-53);ctx.fillStyle='#fff8e0';ctx.fill();ellipse(23,-105,13,13,'#fff8e0');
    path([[31,-104],[69,-98],[32,-94]],'#eaa853');ctx.beginPath();ctx.moveTo(32,-97);ctx.quadraticCurveTo(56,-77,68,-98);ctx.closePath();ctx.fillStyle='#f1c477';ctx.fill();line([[32,-99],[68,-98]],'#bd8849',1);ellipse(27,-108,2.3,2.3,'#254c49');ellipse(28,-109,0.7,.7,'#fff');
    ctx.beginPath();ctx.ellipse(21,-116,14,8,.05,Math.PI,Math.PI*2);ctx.fillStyle='#48796d';ctx.fill();line([[7,-117],[34,-117]],'#295b54',3);line([[22,-117],[23,-125]],'#89ac85',2);
    path([[7,-87],[20,-85],[17,-79],[5,-81]],'#df7959');path([[9,-83],[-18,-89],[-25,-83],[-10,-82],[-20,-77],[7,-78]],'#e58b64');
    line([[2,-61],[24,-59],[28,-61]],'#eceacb',7);ctx.fillStyle='#aa7c53';ctx.fillRect(-38,-61,21,24);line([[-38,-54],[-18,-54]],'#735b42',2);path([[-34,-64],[-20,-64],[-20,-51],[-34,-51]],'#fff2cc');line([[-34,-64],[-27,-59],[-20,-64]],'#d49c67',1);ctx.restore();
  }
  function draw(dt){const r=state.run,p=palettes[route.theme];const moving=r.status==='riding';if(moving){time+=dt;visualLane+=(r.lane-visualLane)*Math.min(1,dt*15);}background(p,state.settings.reduced?0:time);const px=W<600?95:150;const things=route.items.filter(o=>o.x-r.x+px>-50&&o.x-r.x+px<W+50);for(let lane=0;lane<3;lane++){for(const o of things.filter(o=>o.lane===lane)){const x=o.x-r.x+px,y=laneY(lane);if(o.type==='stamp'){if(!r.taken.includes(o.id))stamp(x,y);}else obstacle(o,x,y);}if(Math.round(visualLane)===lane)pelican(px,laneY(visualLane),time);}const finish=C.LENGTH-r.x+px;if(finish<W+80){line([[finish,244],[finish,418]],'#fff7d699',4);lighthouse(finish+40,264,.8);ctx.fillStyle='#214e4e';ctx.font='bold 12px sans-serif';ctx.fillText('灯塔邮局',finish-25,231);} }
  function frame(now){const dt=Math.min(.05,Math.max(0,(now-frameTime)/1000));frameTime=now;const before=state.run.status;const events=C.step(state,dt,route);for(const e of events){if(e==='stamp'){note('stamp');notify(state.run.stamps>=route.quota?'邮票够啦，骑到灯塔！':'收到一枚海岸邮票 +1');}if(e==='hit'){flash=.65;note('hit');notify('小心路障！车况 −1');}if(e==='cleared')notify('投递完成！');}if(events.length||before!==state.run.status){persist();sync();}if(state.run.status==='riding'){lastSave+=dt;if(lastSave>1){persist();lastSave=0;}sync();}flash=Math.max(0,flash-dt);toastTime=Math.max(0,toastTime-dt);if(!toastTime)$('toast').classList.remove('show');draw(dt);requestAnimationFrame(frame);}
  $('save-status').textContent=loaded.notice;if(saveLocked)persist();resize();sync();requestAnimationFrame(frame);
})();
