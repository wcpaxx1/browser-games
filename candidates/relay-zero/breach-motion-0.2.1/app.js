import {createLocalSave} from './local-save.mjs';
// BEGIN MOTION CONTROLLER
function createMotionController(C) {
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)), ease=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
  let m, cues=[];
  function reset(game){m={time:game.elapsed,x:game.player.x,y:game.player.y,speed:0,phase:0,distance:0,stepDistance:0,stride:1.12,side:0,moving:false,stance:'idle',aim:0,lookX:0,lookY:0,brakeAge:10,shotAge:10,shotPending:false,hurtAge:10,reload:game.player.reload,reloadSerial:0,reloadStage:'ready',guards:game.enemies.map(e=>({x:e.x,y:e.y,hp:e.hp,phase:0,speed:0,distance:0,shotAge:10,shotPending:false,hitAge:10,deathAge:e.hp>0?10:1,mode:e.mode}))};cues=[];}
  function cue(type,extra={}){cues.push({type,time:m.time,...extra});}
  function look(dx,dy){m.lookX=clamp(m.lookX+dx*.014,-5,5);m.lookY=clamp(m.lookY+dy*.012,-3,3);}
  function reloadStage(value){const t=1-clamp(value/1.05,0,1);return value<=0?'ready':t<.16?'raise':t<.40?'detach':t<.58?'fetch':t<.80?'reseat':'settle';}
  function observe(game,dt=0,input={}){
    const p=game.player;m.time=game.elapsed;
    if(dt>0){for(const key of ['brakeAge','shotAge','hurtAge'])m[key]=Math.min(10,m[key]+dt);m.lookX*=Math.exp(-20*dt);m.lookY*=Math.exp(-20*dt);m.aim+=(Number(!!input.aim)-m.aim)*(1-Math.exp(-22*dt));}
    const distance=Math.hypot(p.x-m.x,p.y-m.y),moving=dt>0&&distance>1e-9,speed=dt>0?distance/dt:m.speed;
    if(dt>0){if(m.moving&&!moving)m.brakeAge=0;m.moving=moving;m.speed=speed;m.distance+=distance;const stride=input.aim?.82:1.12;if(stride!==m.stride)m.stepDistance=m.stepDistance/m.stride*stride;m.stride=stride;m.phase+=distance/stride*Math.PI;m.stepDistance+=distance;
      while(moving&&m.stepDistance>=stride&&p.hp>0){m.stepDistance-=stride;m.side=1-m.side;cue('footstep',{side:m.side,surface:'stone',speed});}
      m.stance=input.aim?(moving?'walk':'brace'):(moving?'run':'idle');
    }
    m.x=p.x;m.y=p.y;
    if(p.reload>0&&m.reload===0){m.reloadSerial++;cue('reload-start');}
    if(p.reload>0){const old=m.reload>0?1-m.reload/1.05:0,now=1-p.reload/1.05;for(const [at,type]of[[.16,'mag-out'],[.80,'mag-in'],[.90,'bolt']])if(old<at&&now>=at)cue(type);}
    m.reload=p.reload;m.reloadStage=reloadStage(p.reload);
    game.enemies.forEach((e,i)=>{const g=m.guards[i],d=Math.hypot(e.x-g.x,e.y-g.y);if(dt>0){g.phase+=d/.68*Math.PI;g.distance+=d;g.speed=d/dt;g.shotAge=Math.min(10,g.shotAge+dt);g.hitAge=Math.min(10,g.hitAge+dt);g.deathAge=Math.min(10,g.deathAge+dt);}if(e.hp<g.hp){g.hitAge=0;if(e.hp===0)g.deathAge=0;}g.x=e.x;g.y=e.y;g.hp=e.hp;g.mode=e.mode;});
  }
  function events(events){for(const e of events){if(e.type==='shot'){m.shotAge=0;m.shotPending=true;}if(e.type==='hurt')m.hurtAge=0;if(e.type==='enemy-shot'){const g=m.guards[e.id];if(g){g.shotAge=0;g.shotPending=true;}}}}
  function playerPose(p,{reduced=false}={}){
    const ads=m.aim,walk=m.moving&&!reduced?Math.sin(m.phase):0,run=m.stance==='run'?1:.45,brake=reduced?0:Math.exp(-m.brakeAge*24),shot=Math.max(Math.exp(-m.shotAge*36),m.shotPending?.9:0),t=p.reload>0?1-p.reload/1.05:0;
    const raise=p.reload>0?ease(t/.16)*(1-ease((t-.86)/.14)):0;
    // Shared weapon-local attachment space. A held magazine is a child of the
    // same grip anchor used for the palm; insertion finishes along the well axis.
    const seat={x:-3,y:-151},grip={x:0,y:48},rest={x:-42,y:-186};
    let magX=seat.x,magY=seat.y,magVisible=true,gripLocked=false,hand={...rest};
    const lerp=(a,b,q)=>a+(b-a)*q;
    if(t>0&&t<.16){const q=ease(t/.16);hand={x:lerp(rest.x,seat.x+grip.x,q),y:lerp(rest.y,seat.y+grip.y,q)};}
    else if(t>=.16&&t<.40){const q=ease((t-.16)/.24);magX=seat.x-34*q;magY=seat.y+145*q;gripLocked=true;}
    else if(t>=.40&&t<.58){magX=seat.x-34;magY=seat.y+145;magVisible=false;hand={x:magX+grip.x,y:magY+grip.y};}
    else if(t>=.58&&t<.80){const q=(t-.58)/.22;if(q<.40){const u=ease(q/.40);magX=lerp(seat.x-34,seat.x,u);magY=lerp(seat.y+145,seat.y+88,u);}else{magX=seat.x;magY=lerp(seat.y+88,seat.y,ease((q-.40)/.60));}gripLocked=true;}
    else if(t>=.80){const q=clamp((t-.80)/.20,0,1);if(q<.48){const u=ease(q/.48);hand={x:lerp(seat.x+grip.x,34,u),y:lerp(seat.y+grip.y,-182,u)};}else{const u=ease((q-.48)/.52);hand={x:lerp(34,rest.x,u),y:lerp(-182,rest.y,u)};}}
    if(gripLocked)hand={x:magX+grip.x,y:magY+grip.y};
    const magazine={x:magX,y:magY,angle:0,visible:magVisible},magazineGrip={x:magX+grip.x,y:magY+grip.y},handGrip={...hand},magWell={...seat};
    return {stance:m.stance,ads,phase:m.phase,x:walk*3.5*run+m.lookX,y:Math.abs(walk)*3*run+brake*4,roll:walk*.006*run+brake*.012,shot,kickAngle:shot*.042+p.recoil*.30,kickBack:shot*7,brace:ads*(1-Math.min(1,m.speed/1.2)),reloadStage:m.reloadStage,reloadProgress:t,reloadRoll:raise*.35,reloadLift:raise*55,handX:hand.x-rest.x,handY:hand.y-rest.y,magY:magY-seat.y,magVisible,magazine,magazineGrip,handGrip,magWell,gripLocked,gripError:gripLocked?Math.hypot(hand.x-magazineGrip.x,hand.y-magazineGrip.y):0,bolt:t>.80?Math.sin(clamp((t-.80)/.16,0,1)*Math.PI)*16:0};
  }
  function guardPose(e){const g=m.guards[e.id],moving=g.speed>.035&&e.hp>0,leg=moving?Math.sin(g.phase)*.48:0,fire=Math.max(Math.exp(-g.shotAge*28),g.shotPending?1:0),hit=Math.exp(-g.hitAge*22),death=e.hp<=0?ease(g.deathAge/.25):0;return {mode:e.mode,moving,leg,leftLeg:leg,rightLeg:-leg,bob:moving?Math.abs(Math.sin(g.phase))*.025:0,kneel:e.mode==='defuse'?.34:0,fire,hit,death,aim:e.mode==='aim',phase:g.phase,speed:g.speed};}
  function presented(){m.shotPending=false;for(const g of m.guards)g.shotPending=false;}
  function takeCues(){const result=cues;cues=[];return result;}
  function inspect(){return {...m,guards:m.guards.map(g=>({...g})),cues:cues.length};}
  return {reset,observe,events,look,playerPose,guardPose,presented,takeCues,inspect,cue};
}
// END MOTION CONTROLLER
const C=window.RelayBreach,$=id=>document.getElementById(id),canvas=$('game'),outputCtx=canvas.getContext('2d',{alpha:false});let ctx=outputCtx;
const store=createLocalSave({key:C.KEY,version:C.VERSION,defaults:C.defaults(),validate:C.validProfile,storage:()=>window.localStorage,maxChars:28000});
let loaded=store.load(),profile=loaded.data,game=profile.round||C.create(),keys={},held=false,aimHeld=false,dragLook=false,lastPointer=null,presses=[],timeline=[],viewYaw=game.player.a,viewPitch=game.player.pitch,last=performance.now(),saveClock=0,audio=null,pending=null,importGeneration=0,conflict=false,hadLock=false,hurt=0,hurtSource=null,flashUntil=0,flashFirst=false,hitUntil=0,hitFirst=false,visuals=[],toast='',toastUntil=0,rawFrames=[],inputSamples=[],latestInput=null,simDroppedMs=0,lastRenderCostMs=0,frameCounter=0;
const motion=createMotionController(C);motion.reset(game);const audioHistory=[],audioNoiseCache={};
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches,HUD={};
function text(id,value){if(HUD[id]!==value){$(id).textContent=value;HUD[id]=value;}}
function notice(status){const messages={'unavailable':'浏览器无法保存。进度仅留在本次页面，可在设置中导出。','memory-only':'保存失败。进度仅留在本次页面，可在设置中导出。','unreadable-preserved':'存档无法读取，原数据已保留。可继续玩，或到设置中导入／重置。','replacement-confirmation-required':'原存档已保留，自动保存暂停。可在设置中导入／重置。','invalid':'本次进度未能保存，可继续游玩。','conflict':'另一页面更新了存档。此页已暂停保存，请刷新以载入最新进度。'};if(messages[status]){text('storageNotice',messages[status]);$('storageNotice').hidden=false;}else if(['loaded','empty','saved','reset'].includes(status))$('storageNotice').hidden=true;}
notice(loaded.status);
function persist(){profile.round=C.snapshot(game);if(!conflict)notice(store.save(profile).status);}
function invalidateImports(){importGeneration++;if(pending?.kind==='import'){pending=null;if($('confirmDialog').open)$('confirmDialog').close();}return importGeneration;}
function audioStart(){if(profile.muted)return;try{audio=audio||new(window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});}catch{}}
function sound(type,details={}){
 audioHistory.push({type,time:game.elapsed,...details});if(audioHistory.length>80)audioHistory.shift();
 if(profile.muted||!audio)return;
 try{const t=audio.currentTime,volume=type==='footstep'?.022:type==='shot'?.045:.025;
  const clicks={'mag-out':[180,.045],'mag-in':[280,.045],bolt:[410,.06],empty:[650,.025],'reload-start':[160,.02],reload:[530,.035]};
  if(type==='shot'||type==='enemy-shot'||type==='footstep'){
   const duration=type==='footstep'?.085:.11,key=type==='footstep'?'step':'gun';let buffer=audioNoiseCache[key];if(!buffer){buffer=audio.createBuffer(1,Math.ceil(audio.sampleRate*duration),audio.sampleRate);const data=buffer.getChannelData(0);let seed=key==='gun'?7919:3571;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*Math.exp(-i/data.length*(key==='step'?9:6));}audioNoiseCache[key]=buffer;}
   const source=audio.createBufferSource(),filter=audio.createBiquadFilter(),gain=audio.createGain();source.buffer=buffer;filter.type=type==='footstep'?'lowpass':'bandpass';filter.frequency.value=type==='footstep'?700:1800;filter.Q.value=.65;gain.gain.value=type==='enemy-shot'?.018:volume;source.connect(filter);filter.connect(gain);gain.connect(audio.destination);source.start(t);source.stop(t+duration);
  }
  const tones={shot:[95,.032,.09],hit:[880,.03,.05],down:[270,.025,.14],hurt:[60,.035,.12],won:[790,.04,.45],lost:[110,.03,.3],planted:[620,.03,.18],...Object.fromEntries(Object.entries(clicks).map(([k,[hz,d]])=>[k,[hz,.022,d]]))};const v=tones[type];if(!v)return;
  const o=audio.createOscillator(),gain=audio.createGain();o.type=type==='shot'?'triangle':'sine';o.frequency.setValueAtTime(v[0],t);o.frequency.exponentialRampToValueAtTime(v[0]*.55,t+v[2]);gain.gain.setValueAtTime(v[1],t);gain.gain.exponentialRampToValueAtTime(.001,t+v[2]);o.connect(gain);gain.connect(audio.destination);o.start(t);o.stop(t+v[2]+.01);
 }catch{}
}
function release(){keys={};held=false;aimHeld=false;dragLook=false;lastPointer=null;presses=[];timeline=[];viewYaw=game.player.a;viewPitch=game.player.pitch;}
function markInput(kind){latestInput={kind,at:performance.now()};}
function queueInput(type,data={}){timeline.push({type,at:performance.now(),...data});}
function previewLook(dx,dy){if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>4000||Math.abs(dy)>4000)return;viewYaw=Math.atan2(Math.sin(viewYaw+dx*.0023),Math.cos(viewYaw+dx*.0023));viewPitch=Math.max(-.62,Math.min(.62,viewPitch-dy*.0023));queueInput('look',{dx,dy});}
function showOverlay(){let state=game.state;$('overlay').hidden=state==='active';if(state==='active')return;text('resultIcon',state==='won'?'✓':state==='lost'?'↻':state==='paused'?'Ⅱ':'A');text('resultTitle',state==='won'?'回合胜利':state==='lost'?'回合结束':state==='paused'?'已暂停':'石城爆破');text('resultDetail',state==='won'||state==='lost'?game.reason:state==='paused'?'回合已保存，接着打':'到 A 点停下安包，然后守住');text('resume',state==='ready'?'点击开战':state==='paused'?'继续':'再来一局');$('retry').hidden=state!=='paused';$('startControls').hidden=state==='won'||state==='lost';}
function requestLock(){if(game.state!=='active')return;canvas.focus();if(document.pointerLockElement===canvas)return;try{const result=canvas.requestPointerLock?.();if(!canvas.requestPointerLock)throw Error();if(result?.catch)result.catch(showFallback);}catch{showFallback();}}
function showFallback(){text('inputNotice','鼠标未锁定：按住右键拖动转向，左键射击。');$('inputNotice').hidden=false;text('rightHelp','按住右键转向');}
function pause(){if(game.state!=='active')return;C.pause(game);release();if(document.pointerLockElement===canvas)document.exitPointerLock?.();persist();showOverlay();}
function resume(){if(artStatus==='loading'||artStatus==='error')return;invalidateImports();release();C.resume(game);last=performance.now();$('overlay').hidden=true;audioStart();requestLock();persist();}
function newRound(){if(artStatus==='loading'||artStatus==='error')return;invalidateImports();game=C.create();motion.reset(game);profile.attempts++;C.resume(game);release();visuals=[];hurt=0;hurtSource=null;flashUntil=hitUntil=0;flashFirst=hitFirst=false;toastUntil=0;last=performance.now();$('overlay').hidden=true;audioStart();requestLock();persist();}
function ask(kind,raw,fileName='',generation=null){if(kind!=='import')invalidateImports();else if(generation!==importGeneration||!$('settingsDialog').open)return;pending={kind,raw,fileName,generation};$('confirmTitle').textContent=kind==='reset'?'重置新版进度？':kind==='import'?'替换新版进度？':'重开本局？';$('confirmText').textContent=kind==='reset'?'新版记录与未完成回合将被清除。旧版存档不受影响。':kind==='import'?`导入「${fileName}」将替换新版记录和未完成回合。旧版存档不受影响。`:'本局会从头开始，累计记录保留。';if(!$('confirmDialog').open)$('confirmDialog').showModal();}
$('resume').onclick=()=>game.state==='paused'?resume():newRound();$('retry').onclick=()=>ask('retry');$('pause').onclick=()=>{if(game.state==='active')pause();else if(game.state==='paused'&&!$('settingsDialog').open)resume();};
$('mute').onclick=()=>{profile.muted=!profile.muted;updateSound();if(!profile.muted)audioStart();persist();};
function updateSound(){$('soundIcon').textContent=profile.muted?'♪̸':'♫';$('mute').setAttribute('aria-label',profile.muted?'开启声音':'关闭声音');$('mute').classList.toggle('active',!profile.muted);}updateSound();
$('settings').onclick=()=>{invalidateImports();pause();$('record').textContent=`完成 ${profile.wins} 局${profile.best!==null?' · 最快 '+Math.round(profile.best)+' 秒':''}`;$('settingsStatus').textContent='';$('settingsDialog').showModal();};
$('settingsDialog').addEventListener('close',invalidateImports);$('settingsDialog').addEventListener('cancel',invalidateImports);
$('reset').onclick=()=>ask('reset');$('cancel').onclick=()=>{invalidateImports();pending=null;$('confirmDialog').close();};$('confirmDialog').addEventListener('cancel',()=>{invalidateImports();pending=null;});
$('confirm').onclick=()=>{const action=pending;if(action?.kind==='import'&&(action.generation!==importGeneration||!$('settingsDialog').open)){invalidateImports();return;}pending=null;invalidateImports();$('confirmDialog').close();if(!action)return;if(action.kind==='retry'){newRound();return;}let r=action.kind==='reset'?store.reset({confirmed:true}):store.import(action.raw,{confirmed:true});if(['reset','saved','memory-only'].includes(r.status)){conflict=false;profile=r.data;game=profile.round||C.create();motion.reset(game);release();updateSound();notice(r.status);$('settingsDialog').close();showOverlay();}else{$('settingsStatus').textContent=r.status==='invalid-import'?'文件格式无效，原存档未改动。':'无法重置，原存档未改动。';}};
$('export').onclick=()=>{persist();let a=document.createElement('a');a.href=URL.createObjectURL(new Blob([store.export(profile)],{type:'application/json'}));a.download='relay-zero-breach-save.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000);$('settingsStatus').textContent='进度文件已生成。';};
$('import').onchange=async e=>{const generation=invalidateImports(),file=e.target.files?.[0];e.target.value='';if(!$('settingsDialog').open)return;$('settingsStatus').textContent='';if(!file)return;const fileName=typeof file.name==='string'?file.name.slice(0,180):'进度文件';const current=()=>generation===importGeneration&&$('settingsDialog').open;if(file.size>28000){$('settingsStatus').textContent='文件过大，原存档未改动。';return;}$('settingsStatus').textContent=`正在读取「${fileName}」…`;try{const raw=await file.text();if(!current())return;const decoded=JSON.parse(raw);if(raw.length>28000||decoded.version!==C.VERSION||!C.validProfile(decoded.data))throw Error();$('settingsStatus').textContent=`已选择「${fileName}」`;ask('import',raw,fileName,generation);}catch{if(!current())return;$('settingsStatus').textContent='文件格式无效，原存档未改动。';}};

$('lock').onclick=requestLock;
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'||game.state!=='active')return;e.preventDefault();canvas.focus();audioStart();markInput(e.button===0?'fire':'aim');lastPointer={x:e.clientX,y:e.clientY};if(e.button===0&&game.player.hp>0)queueInput('down');if(e.button===2){if(document.pointerLockElement===canvas)queueInput('aim',{value:true});else dragLook=true;}try{canvas.setPointerCapture(e.pointerId);}catch{}});
window.addEventListener('pointerup',e=>{if(e.button===0&&game.state==='active')queueInput('up');if(e.button===2){if(game.state==='active')queueInput('aim',{value:false});dragLook=false;lastPointer=null;}});
window.addEventListener('pointermove',e=>{if(game.state!=='active')return;let locked=document.pointerLockElement===canvas;if(!locked&&!dragLook)return;let dx=locked?(e.movementX||0):lastPointer?e.clientX-lastPointer.x:0,dy=locked?(e.movementY||0):lastPointer?e.clientY-lastPointer.y:0;lastPointer={x:e.clientX,y:e.clientY};previewLook(dx,dy);markInput('look');});
window.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',()=>{if(game.state==='active'){queueInput('up');queueInput('aim',{value:false});}dragLook=false;});canvas.addEventListener('contextmenu',e=>e.preventDefault());
const arrows=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];window.addEventListener('keydown',e=>{if(e.code==='Escape'){if(!$('settingsDialog').open&&!$('confirmDialog').open)pause();return;}if(!arrows.includes(e.code)||game.state!=='active'||$('settingsDialog').open||$('confirmDialog').open)return;e.preventDefault();queueInput('key',{code:e.code,value:true});markInput('move');});window.addEventListener('keyup',e=>{if(arrows.includes(e.code)&&game.state==='active'){queueInput('key',{code:e.code,value:false});markInput('move-release');}});
document.addEventListener('pointerlockchange',()=>{let locked=document.pointerLockElement===canvas;if(hadLock&&!locked)pause();hadLock=locked;lastPointer=null;if(locked){$('inputNotice').hidden=true;text('rightHelp','右键 精瞄');}else if(game.state==='active')showFallback();});document.addEventListener('pointerlockerror',showFallback);
window.addEventListener('blur',()=>{release();pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){release();pause();}});window.addEventListener('pagehide',()=>{release();pause();persist();});window.addEventListener('storage',e=>{if(e.key===C.KEY){conflict=true;pause();notice('conflict');}});
function resize(){const rect=canvas.getBoundingClientRect(),dpr=Math.min(1.5,window.devicePixelRatio||1);canvas.width=Math.max(1,Math.min(1440,Math.round(rect.width*dpr)));canvas.height=Math.max(1,Math.round(canvas.width*620/960));}new ResizeObserver(resize).observe(canvas);resize();
function consume(now){motion.observe(game,0);motion.events(game.events);for(const e of game.events){sound(e.type);if(e.type==='shot'){flashUntil=now+65;flashFirst=true;}if(e.type==='hit'){hitUntil=now+85;hitFirst=true;}if(e.type==='hurt'){hurt=.38;const enemy=game.enemies[e.id];if(enemy)hurtSource={x:enemy.x,y:enemy.y,until:now+420};}if(e.type==='down'){toast='守卫倒下';toastUntil=now+1000;}if(e.type==='planted'){toast='安包完成，守住';toastUntil=now+2000;}}game.events=[];for(const e of game.effects)visuals.push({...e,until:now+e.life*1000,first:true});game.effects=[];for(const cue of motion.takeCues())sound(cue.type,cue);if(visuals.length>48)visuals=visuals.slice(-48);}
function hud(now){const p=game.player,b=game.bomb,seconds=Math.ceil(b.state==='planted'?b.timer:game.time);text('clock',`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`);text('enemyCount',`守卫 ${3-game.kills}`);text('objective',b.state==='planted'?'A 点 · 守住':'A 点 · 安包');text('health',String(p.hp));if(HUD.hp!==p.hp){$('healthBar').style.width=p.hp+'%';HUD.hp=p.hp;}text('ammo',String(p.ammo));text('ammoLabel',p.reload>0?'换弹中…':'自动换弹');let direction=Math.atan2(C.SITE.y-p.y,C.SITE.x-p.x)-p.a;direction=Math.atan2(Math.sin(direction),Math.cos(direction));const arrow=Math.abs(direction)<.25?'↑':direction>0?'→':'←';text('compass',`A ${arrow} ${Math.round(Math.hypot(C.SITE.x-p.x,C.SITE.y-p.y)*2)}m`);
let progress=b.state==='planting'?b.plant/C.PLANT_TIME:b.defuser>=0?b.defuse/C.DEFUSE_TIME:0;let hint=p.hp===0?'已倒下 · 等待爆破结果':b.state==='planting'?'正在安包 · 移动取消':b.defuser>=0?'敌人在拆包！':b.state!=='planted'&&Math.hypot(p.x-C.SITE.x,p.y-C.SITE.y)<C.SITE.r?'停下安包':now<toastUntil?toast:'';text('centerHint',hint);$('progressWrap').hidden=progress===0;if(progress!==HUD.progress){$('progressBar').style.width=(progress*100).toFixed(1)+'%';HUD.progress=progress;}text('roundHint',b.state==='planted'?'守住 A 点':p.reload>0?'自动换弹…':'绕过石楼，前往 A 点');$('hurt').style.opacity=hurt;$('hitmark').hidden=!(now<hitUntil||hitFirst);}
// BEGIN MOTION DRAW
function guardLayout(e,pose,relative,screenScale=0){
 const quadrant=((Math.floor((relative+Math.PI/4)/(Math.PI/2))%4)+4)%4,front=quadrant===0;
 let name=['guard-front','guard-right','guard-back','guard-left'][quadrant];
 if(front&&pose.moving)name=Math.sin(pose.phase)>=0?'guard-walk-a':'guard-walk-b';else if(front&&pose.aim)name='guard-aim';if(front&&pose.hit>.35&&e.hp>0)name='guard-hit';
 if(screenScale*1.70>230&&art[name+'-512'])name+='-512';
 const s=1.70/242,x=-128*s,y=.9-252*s;
 const multiply=(a,b)=>[a[0]*b[0]+a[2]*b[1],a[1]*b[0]+a[3]*b[1],a[0]*b[2]+a[2]*b[3],a[1]*b[2]+a[3]*b[3],a[0]*b[4]+a[2]*b[5]+a[4],a[1]*b[4]+a[3]*b[5]+a[5]];
 const around=(angle,cx=0,cy=0,dx=0,dy=0)=>{const c=Math.cos(angle),sn=Math.sin(angle);return[c,sn,-sn,c,cx-c*cx+sn*cy+dx,cy-sn*cx-c*cy+dy];};
 const death=around(pose.death*1.46,0,.9),base=[s,0,0,s,x,y],parts=[];
 for(const right of[false,true]){const hipX=((right?145:112)-128)*s,hipY=y+145*s,limb=around((right?pose.rightLeg:pose.leftLeg)*.24,hipX,hipY);parts.push({r:[right?128:0,140,128,116],m:multiply(death,multiply(limb,base))});}
 parts.push({r:[0,0,256,145],m:multiply(death,multiply(around(-pose.hit*.025-pose.fire*.013,0,0,pose.hit*.025,pose.bob+pose.kneel*.55),base))});
 return {name,front,parts,death,scale:s};
}
function guardVisibleBounds(e,pose,relative,screenScale=0){
 const layout=guardLayout(e,pose,relative,screenScale),alpha=artBounds[layout.name]||{minX:0,minY:0,maxX:256,maxY:256},points=[[-.34,.83],[.34,.95],[-.28,-.92],[.28,-.86]];
 for(const {r,m}of layout.parts){const left=Math.max(r[0],alpha.minX),right=Math.min(r[0]+r[2],alpha.maxX),top=Math.max(r[1],alpha.minY),bottom=Math.min(r[1]+r[3],alpha.maxY);if(right<left||bottom<top)continue;for(const [x,y]of[[left,top],[right,top],[right,bottom],[left,bottom]])points.push([m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);}
 // Muzzle and aim indicators are also included without changing the hit cylinder.
 for(const [x,y]of[[.2,-.53],[.48,-.32],[-.24,-.87],[.24,-.37]]){const m=layout.death;points.push([m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);}
 return {minX:Math.min(...points.map(p=>p[0]))-.012,maxX:Math.max(...points.map(p=>p[0]))+.012,minY:Math.min(...points.map(p=>p[1]))-.012,maxY:Math.max(...points.map(p=>p[1]))+.012};
}
function drawArtGuard(g,e,pose,relative,screenScale=0){
 const layout=guardLayout(e,pose,relative,screenScale),image=courtyardRenderer&&courtyardRenderer.sampleLight(e.x,e.y)<.8&&artShadow[layout.name]?artShadow[layout.name]:art[layout.name],k=(image.width||256)/256;
 g.save();g.fillStyle='#192e3c40';g.beginPath();g.ellipse(0,.885,.33,.045,0,0,Math.PI*2);g.fill();
 for(const {r,m}of layout.parts){g.save();g.transform(...m);g.drawImage(image,r[0]*k,r[1]*k,r[2]*k,r[3]*k,...r);g.restore();}
 g.transform(...layout.death);
 if(pose.fire>.3&&layout.front){const mx=(174-128)*layout.scale,my=.9+(58-252)*layout.scale;g.fillStyle='#ffe2a4';g.beginPath();g.moveTo(mx-.025,my);g.lineTo(mx+.11,my-.035);g.lineTo(mx+.055,my+.01);g.lineTo(mx+.13,my+.08);g.lineTo(mx-.02,my+.04);g.closePath();g.fill();}
 if(e.windup>0){g.strokeStyle='#ffb365';g.lineWidth=.025;g.beginPath();g.arc(0,-.62,.21,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.windup/.48));g.stroke();}g.restore();
}

function drawMotionGuard(g,e,p,relative,screenScale=0){
  if(artStatus==='ready'){drawArtGuard(g,e,p,relative,screenScale);return;}
  const side=Math.abs(Math.sin(relative)),back=Math.cos(relative)<-.5,hip=.23+p.kneel,bodyWidth=.24-side*.085;
  g.save();g.fillStyle='#20344150';g.beginPath();g.ellipse(0,.87,.32,.06,0,0,Math.PI*2);g.fill();
  if(p.death>0){g.translate(0,.86);g.rotate(p.death*1.43);g.scale(1,1-p.death*.12);g.translate(0,-.86);}
  function limb(x,phase){const thigh=.30,shin=.31,kneeX=x+Math.sin(phase)*thigh,kneeY=hip+Math.cos(phase)*thigh,footX=x-Math.sin(phase)*.16,footY=.81;
    g.strokeStyle='#253c46';g.lineWidth=.145;g.lineCap='round';g.beginPath();g.moveTo(x,hip);g.lineTo(kneeX,kneeY-p.kneel*.28);g.lineTo(footX,footY);g.stroke();g.strokeStyle='#172934';g.lineWidth=.13;g.beginPath();g.moveTo(x,hip);g.lineTo(kneeX,kneeY-p.kneel*.28);g.stroke();g.fillStyle='#b3a581';g.fillRect(kneeX-.072,kneeY-.055-p.kneel*.28,.14,.12);g.fillStyle='#14252d';g.beginPath();g.ellipse(footX+.025,.83,.12,.055,0,0,Math.PI*2);g.fill();}
  limb(-.12,p.leftLeg);limb(.12,p.rightLeg);
  g.translate(p.hit*.035,p.bob+p.kneel);g.rotate(-p.hit*.08);
  const coat=g.createLinearGradient(-.3,-.4,.3,.2);coat.addColorStop(0,'#526a70');coat.addColorStop(.45,'#2b4655');coat.addColorStop(1,'#172e3c');g.fillStyle=coat;g.beginPath();g.moveTo(-bodyWidth,-.42);g.lineTo(bodyWidth,-.42);g.lineTo(bodyWidth*.9,.27);g.lineTo(-bodyWidth*.9,.27);g.closePath();g.fill();
  g.fillStyle=back?'#5a6256':'#9a9576';g.fillRect(-bodyWidth*.81,-.3,bodyWidth*1.62,.42);g.strokeStyle='#c2b69a';g.lineWidth=.012;for(let row=0;row<3;row++)g.strokeRect(-bodyWidth*.7,-.26+row*.12,bodyWidth*1.4,.08);
  g.fillStyle='#ce7451';g.fillRect(-bodyWidth-.035,-.30,.06,.17);
  g.fillStyle='#a77a5c';g.beginPath();g.ellipse(0,-.54,.14-side*.035,.16,0,0,Math.PI*2);g.fill();g.fillStyle='#283c44';g.beginPath();g.ellipse(0,-.64,.172-side*.025,.115,0,Math.PI,Math.PI*2);g.fill();g.fillRect(-.17+side*.025,-.65,.34-side*.05,.075);if(!back){g.fillStyle='#17272a';g.fillRect(-.11,-.566,.22,.045);g.fillStyle='#ad9675';g.fillRect(side>.6?.08:-.04,-.514,.07,.023);}
  g.save();g.translate(0,-p.fire*.035);g.rotate(p.fire*-.035);
  const lift=p.aim?-.04:.045;g.strokeStyle='#38515a';g.lineWidth=.115;g.beginPath();g.moveTo(-bodyWidth,-.24);g.lineTo(-.25,.025+lift);g.lineTo(.04,-.025+lift);g.moveTo(bodyWidth,-.24);g.lineTo(.29,-.005+lift);g.lineTo(.12,.015+lift);g.stroke();g.fillStyle='#b4a27a';g.fillRect(-.015,-.015+lift,.11,.075);g.fillRect(.12,-.005+lift,.10,.07);
  g.fillStyle='#14242d';g.fillRect(-.03,-.065+lift,.43,.08);g.fillStyle='#607278';g.fillRect(.1,-.09+lift,.19,.035);g.fillStyle='#1c3038';g.fillRect(.09,.012+lift,.08,.14);g.fillStyle='#89948d';g.fillRect(.37,-.055+lift,.075,.03);
  if(p.fire>.3){g.fillStyle='#ffe1a0';g.beginPath();g.moveTo(.44,-.065+lift);g.lineTo(.61,-.10+lift);g.lineTo(.55,-.035+lift);g.lineTo(.66,.035+lift);g.lineTo(.45,.005+lift);g.closePath();g.fill();}g.restore();
  if(e.windup>0){g.strokeStyle='#ffb365';g.lineWidth=.027;g.beginPath();g.arc(0,-.56,.23,-Math.PI/2,-Math.PI/2+Math.PI*2*(1-e.windup/.48));g.stroke();}
  g.restore();
}
function drawMotionWeapon(g,p,pose,flash,aimY){
 const ads=pose.ads,originX=575-ads*87+pose.x,originY=665-ads*27+pose.brace*5+pose.y+pose.kickBack-pose.reloadLift;
 g.save();g.translate(originX,originY);g.rotate(pose.roll+pose.kickAngle+pose.reloadRoll);g.scale(1+pose.brace*.035,1-pose.brace*.025);
 function shape(points,fill,stroke){g.fillStyle=fill;g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fill();if(stroke){g.strokeStyle=stroke;g.lineWidth=1.4;g.stroke();}}
 function sleeve(x,y,right=false){const from={x:right?178:-180,y:45},dx=x-from.x,dy=y-from.y,len=Math.hypot(dx,dy),nx=-dy/len,ny=dx/len,shade=g.createLinearGradient(from.x,from.y,x,y);shade.addColorStop(0,'#1c3038');shade.addColorStop(.45,'#425959');shade.addColorStop(.8,'#6b7770');shade.addColorStop(1,'#34494d');shape([[from.x+nx*45,from.y+ny*45],[x+nx*23,y+ny*23],[x-nx*23,y-ny*23],[from.x-nx*45,from.y-ny*45]],shade,'#7c8a7f');g.strokeStyle='#172c34';g.lineWidth=3;for(let k=1;k<4;k++){const t=k/5,cx=from.x+dx*t,cy=from.y+dy*t;g.beginPath();g.moveTo(cx+nx*25,cy+ny*25);g.quadraticCurveTo(cx+dx*.055,cy+dy*.055,cx-nx*27,cy-ny*27);g.stroke();}g.strokeStyle='#b5b19a';g.lineWidth=1;g.beginPath();g.moveTo(from.x+nx*31,from.y+ny*31);g.lineTo(x+nx*15,y+ny*15);g.stroke();}
 function glove(x,y,gripping=true){g.save();g.translate(x,y);const shade=g.createLinearGradient(-30,-28,28,25);shade.addColorStop(0,'#c0af87');shade.addColorStop(.45,'#8f886b');shade.addColorStop(1,'#4c584d');g.fillStyle=shade;g.strokeStyle='#394d47';g.lineWidth=1.2;g.beginPath();g.moveTo(-27,15);g.bezierCurveTo(-33,-8,-27,-26,-13,-29);g.bezierCurveTo(3,-34,24,-22,28,-4);g.bezierCurveTo(32,17,13,30,-8,29);g.closePath();g.fill();g.stroke();
  // Four curled fingers overlap the held part at this shared palm anchor.
  for(let i=0;i<4;i++){const fy=-21+i*11;g.fillStyle=i%2?'#b2a27c':'#a79a75';g.beginPath();g.roundRect(-15,fy,36-i*2,10,4);g.fill();g.strokeStyle='#56614f';g.beginPath();g.moveTo(2,fy+1);g.lineTo(3,fy+8);g.stroke();}g.fillStyle='#b8a883';g.beginPath();g.moveTo(-26,-17);g.bezierCurveTo(-9,-20,6,-11,9,-3);g.bezierCurveTo(10,7,2,12,-4,5);g.lineTo(-22,-1);g.closePath();g.fill();g.stroke();g.fillStyle='#556052';g.beginPath();g.roundRect(-24,18,42,10,3);g.fill();g.restore();}
 sleeve(pose.handGrip.x-15,pose.handGrip.y+28);sleeve(58,-90,true);
 const metal=g.createLinearGradient(-60,-240,80,-110);metal.addColorStop(0,'#9ba59b');metal.addColorStop(.22,'#576a6d');metal.addColorStop(.55,'#22363e');metal.addColorStop(.85,'#667978');metal.addColorStop(1,'#a5b09c');
 shape([[-54,-119],[-47,-208],[-10,-258],[37,-250],[62,-142],[40,-105]],metal,'#a9b5a5');
 shape([[-15,-239],[-13,-309],[11,-315],[23,-242]],'#1c3139','#a5b2a8');g.fillStyle='#869b94';g.fillRect(-15,-309,32,7);g.fillStyle='#203039';g.fillRect(-22,-216,50,24);g.fillStyle='#162a31';g.fillRect(-25,-194,44,35);
 g.strokeStyle='#a0aca0';g.lineWidth=2;for(let i=0;i<6;i++){g.beginPath();g.moveTo(-27,-229+i*7);g.lineTo(16,-228+i*7);g.stroke();}g.fillStyle='#101f27';for(const [x,y]of[[-32,-190],[30,-167],[18,-214]]){g.beginPath();g.arc(x,y,3.6,0,Math.PI*2);g.fill();g.strokeStyle='#9aa69a';g.lineWidth=1;g.beginPath();g.moveTo(x-2,y);g.lineTo(x+2,y);g.stroke();}
 // The well remains visible as a recessed seat after the magazine is removed.
 const well=pose.magWell;shape([[well.x-24,well.y-8],[well.x+24,well.y-8],[well.x+19,well.y+9],[well.x-20,well.y+9]],'#08171e','#bdbaa2');shape([[well.x-17,well.y-5],[well.x+17,well.y-5],[well.x+14,well.y+3],[well.x-14,well.y+3]],'#000b10');
 if(pose.magazine.visible){g.save();g.translate(pose.magazine.x,pose.magazine.y);g.rotate(pose.magazine.angle);const magShade=g.createLinearGradient(-20,0,23,80);magShade.addColorStop(0,'#a2a38a');magShade.addColorStop(.3,'#637365');magShade.addColorStop(.7,'#273b3c');magShade.addColorStop(1,'#142b31');shape([[-18,0],[18,0],[21,74],[12,83],[-13,80]],magShade,'#9fa992');g.fillStyle='#172930';g.fillRect(-17,3,33,8);g.strokeStyle='#a4aa8f';g.lineWidth=1.5;for(let i=0;i<4;i++){g.beginPath();g.moveTo(-12+i*7,18);g.lineTo(-8+i*6,69);g.stroke();}g.fillStyle='#0f2630';g.fillRect(-13,75,31,7);g.restore();}
 glove(pose.handGrip.x,pose.handGrip.y);glove(52,-121);
 g.fillStyle='#bdbaa0';g.fillRect(24,-202+pose.bolt,8,26);g.fillStyle='#142831';g.fillRect(-2,-160,38,10);g.strokeStyle='#c1cec0';g.lineWidth=2;g.beginPath();g.moveTo(-9,-318);g.lineTo(-9,-328);g.lineTo(14,-328);g.lineTo(14,-318);g.stroke();
 if(flash){g.fillStyle='#ffe6aa';g.beginPath();g.moveTo(-14,-314);g.lineTo(-30,-347);g.lineTo(-3,-333);g.lineTo(4,-365);g.lineTo(16,-334);g.lineTo(40,-349);g.lineTo(21,-313);g.closePath();g.fill();g.fillStyle='#fff5ce';g.beginPath();g.ellipse(4,-325,8,18,0,0,Math.PI*2);g.fill();}
 g.restore();
}
// END MOTION DRAW
const VW=960,VH=620,RAYS=480,zbuffer=new Float32Array(RAYS),sceneCanvas=document.createElement('canvas');sceneCanvas.width=480;sceneCanvas.height=310;const sceneCtx=sceneCanvas.getContext('2d',{alpha:false});
function texture(kind){let c=document.createElement('canvas');c.width=c.height=64;let g=c.getContext('2d');g.fillStyle='#d9c6a5';g.fillRect(0,0,64,64);g.strokeStyle='#b8a78d';g.lineWidth=1;for(let y=0;y<65;y+=16){g.beginPath();g.moveTo(0,y);g.lineTo(64,y);g.stroke();for(let x=(y%32?16:0);x<64;x+=32){g.beginPath();g.moveTo(x,y);g.lineTo(x,y+16);g.stroke();}}let seed=13;for(let i=0;i<130;i++){seed=(seed*16807)%2147483647;let x=seed%64;seed=(seed*16807)%2147483647;g.fillStyle=i%2?'#f7e9d520':'#594c3812';g.fillRect(x,seed%64,1,1);}g.fillStyle='#b79569';g.fillRect(0,57,64,7);if(kind==='blue'){g.fillStyle='#375c74';g.beginPath();g.roundRect(15,18,34,36,[15,15,0,0]);g.fill();g.fillStyle='#204257';for(let x=20;x<48;x+=7)g.fillRect(x,20,2,34);g.fillStyle='#d9cdb4';g.fillRect(12,52,40,4);}if(kind==='mark'){g.fillStyle='#3d6683';g.font='bold 22px sans-serif';g.textAlign='center';g.fillText('A',32,35);g.font='bold 15px sans-serif';g.fillText('←  →',32,49);}return c;}
const textures=[texture('stone'),texture('blue'),texture('mark')];
function sampleTexture(image){const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');g.drawImage(image,0,0,256,256);const data=g.getImageData(0,0,256,256)?.data;if(data)return data;const fallback=new Uint8ClampedArray(256*256*4);for(let i=0;i<fallback.length;i+=4){fallback[i]=217;fallback[i+1]=198;fallback[i+2]=165;fallback[i+3]=255;}return fallback;}
let textureData=textures.map(sampleTexture);const wallLayer=document.createElement('canvas');wallLayer.width=480;wallLayer.height=310;const wallCtx=wallLayer.getContext('2d'),wallImage=wallCtx.createImageData(480,310)||{data:new Uint8ClampedArray(480*310*4)},wallPixels=wallImage.data,wallPixels32=new Uint32Array(wallPixels.buffer,wallPixels.byteOffset,wallPixels.byteLength/4);

// BEGIN COURTYARD WORLD
// Lightweight original near-field architecture attached to the unchanged grid building.
// Every face is a real world-space quad. No full-screen concept image is used.
function courtyardArchitecture(){
 const q=[];const face=(p,t='limestone',shade=0,doubleSided=false)=>q.push({p,t,shade,doubleSided});
 function box(x0,y0,z0,x1,y1,z1,t='limestone'){
  face([[x0,y0,z0],[x1,y0,z0],[x1,y0,z1],[x0,y0,z1]],t,.03);
  face([[x0,y1,z0],[x0,y0,z0],[x0,y0,z1],[x0,y1,z1]],t,.25);
  face([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],t,.14);
  face([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],t,0);
 }
 // West doorway: two projecting jambs and a segmented stone arch with real reveals.
 box(5.84,4.54,.08,5.98,4.72,1.63);box(5.84,5.78,.08,5.98,5.96,1.63);
 const center=5.25,spring=1.63,inner=.53,outer=.72;
 for(let i=0;i<8;i++){
  const a=i*Math.PI/8,b=(i+1)*Math.PI/8;
  const point=(x,r,t)=>[x,center+Math.cos(t)*r,spring+Math.sin(t)*r];
  face([point(5.84,inner,a),point(5.84,outer,a),point(5.84,outer,b),point(5.84,inner,b)],'limestone',.12+(i%2)*.045,true);
  face([point(5.84,inner,a),point(5.98,inner,a),point(5.98,inner,b),point(5.84,inner,b)],'limestone',.30,true);
 }
 box(5.52,4.52,.015,5.99,5.99,.075,'paving');
 // North-facing narrow shutter window: outer frame and deep projecting sill.
 box(6.69,3.86,.78,6.80,3.995,2.13);box(7.59,3.86,.78,7.70,3.995,2.13);
 box(6.68,3.86,2.09,7.71,3.995,2.22);box(6.61,3.70,.69,7.78,4.01,.82);
 // True cornice return on both visible faces, plus one chimney to break the box skyline.
 box(5.92,3.91,2.38,11.01,4.02,2.46);
 box(5.91,3.99,2.38,6.03,9.01,2.46);
 box(7.12,4.47,2.45,7.41,4.79,3.09);
 box(7.07,4.42,3.07,7.46,4.84,3.15);
 // Two narrow original diagonal wood braces, visibly attached to the awning and wall.
 for(const y of [4.58,6.42]){const a=[5.94,y,1.72],b=[4.99,y,2.065],w=.024;
  for(const side of [-1,1])q.push({p:[[a[0],y+side*w,a[2]-w],[b[0],y+side*w,b[2]-w],[b[0],y+side*w,b[2]+w],[a[0],y+side*w,a[2]+w]],t:'limestone',color:[79,88,75],shade:side===-1?.1:.3,doubleSided:true});
  q.push({p:[[a[0],y-w,a[2]+w],[b[0],y-w,b[2]+w],[b[0],y+w,b[2]+w],[a[0],y+w,a[2]+w]],t:'limestone',color:[126,123,96],shade:.08,doubleSided:true});
 }
 return q;
}

// Adapted from frozen original Stone Light art handoff v0.3. World-only layer; core unchanged.
function createCourtyardRenderer({canvas,createCanvas,assets:A,core:C,rays=480,floorWidth=480}){
 const { abs: M_abs, atan: M_atan, ceil: M_ceil, cos: M_cos, floor: M_floor, hypot: M_hypot, max: M_max, min: M_min, round: M_round, sin: M_sin, tan: M_tan, PI: M_PI }=Math;
 const W=960,H=620,g=canvas.getContext('2d'),COL=W/rays,zbuffer=new Float32Array(rays),wallTops=new Float32Array(rays),architecture=courtyardArchitecture();
 const floorHeight=M_round(floorWidth*H/W),floor=createCanvas(floorWidth,floorHeight),fg=floor.getContext('2d');
 const frame=fg.createImageData(floorWidth,floorHeight),pixels=frame.data,depthPixels=new Float32Array(floorWidth*floorHeight);
 const sampleCanvas=createCanvas(256,256),sampleCtx=sampleCanvas.getContext('2d');sampleCtx.drawImage(A.paving,0,0,256,256);
 const paving=sampleCtx.getImageData(0,0,256,256).data;
 const wallPixels={};for(const key of ['limestone','facade-window','facade-arched-door','facade-shutters','facade-grille']){const c=createCanvas(512,512),ctx=c.getContext('2d');ctx.drawImage(A[key],0,0,512,512);wallPixels[key]=ctx.getImageData(0,0,512,512).data;}
 sampleCtx.clearRect(0,0,256,256);sampleCtx.drawImage(A.limestone,0,0,256,256);const materials={paving,limestone:sampleCtx.getImageData(0,0,256,256).data};
 const lightW=272,lightH=208,light=new Float32Array(lightW*lightH),sunA=-.85;
 function buildingHeight(mx,my){return mx>=6&&mx<=10&&my>=4&&my<=8?2.45:mx===0||my===0||mx===16||my===12?3.15:2.25;}
 // Stationary world-space light map, computed once. The light is shared by floor, actors and architecture.
 for(let y=0;y<lightH;y++)for(let x=0;x<lightW;x++){
  const wx=(x+.5)*C.W/lightW,wy=(y+.5)*C.H/lightH;
  const hit=C.cast(wx,wy,sunA,6),shadow=hit.d<buildingHeight(hit.mx,hit.my)/1.65;
  let l=shadow?.58:1;
  // The single attached cloth awning casts a restrained real-world footprint.
  if(wx>4.25&&wx<5.85&&wy>4.35&&wy<6.65)l=M_min(l,.68);
  light[y*lightW+x]=l;
 }
 const sampleLight=(x,y)=>light[M_max(0,M_min(lightH-1,M_floor(y/C.H*lightH)))*lightW+M_max(0,M_min(lightW-1,M_floor(x/C.W*lightW)))];
 let draws=0,nearClipped=0;
 function draw(state,{hud=true,showGuard=true,time=0,weapon=true,fov=76,zoom=1,eye=C.EYE,horizonRatio=.49}={}){
  const p=state.player,ca=M_cos(p.a),sa=M_sin(p.a),plane=W/(2*M_tan(fov*M_PI/360))*zoom;
  const horizon=H*horizonRatio+M_tan(p.pitch||0)*plane;draws=0;nearClipped=0;
  g.setTransform(canvas.width/W,0,0,canvas.height/H,0,0);g.imageSmoothingEnabled=true;g.imageSmoothingQuality='medium';g.clearRect(0,0,W,H);
  const sky=g.createLinearGradient(0,0,0,H*.65);sky.addColorStop(0,'#87abbf');sky.addColorStop(.75,'#c8d8d9');sky.addColorStop(1,'#eef0dc');g.fillStyle=sky;g.fillRect(0,0,W,H);
  function camera(x,y){const dx=x-p.x,dy=y-p.y;return {f:dx*ca+dy*sa,r:-dx*sa+dy*ca};}
  function project(x,y,z){const q=camera(x,y);return q.f>.06?{x:W/2+q.r/q.f*plane,y:horizon+(eye-z)/q.f*plane,d:q.f,scale:plane/q.f}:null;}
  function clipDepth(d,fn){g.save();g.beginPath();let run=-1;for(let i=0;i<=rays;i++){const visible=i<rays&&zbuffer[i]>d-.06;if(visible&&run<0)run=i;if(!visible&&run>=0){g.rect(run*COL,0,(i-run)*COL+.05,H);run=-1;}}g.clip();fn();g.restore();}
  function rasterQuad(item){
   const length=(a,b)=>M_hypot(...a.map((v,i)=>v-b[i])),uw=M_max(8,length(item.p[0],item.p[1])*190),uh=M_max(8,length(item.p[1],item.p[2])*190),uv=[[0,0],[uw,0],[uw,uh],[0,uh]],tex=materials[item.t];
   // Clip in camera space, interpolating texture coordinates at the near plane.
   let poly=item.p.map((q,i)=>({...camera(q[0],q[1]),z:q[2],u:uv[i][0],v:uv[i][1]})),clipped=[];
   for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ain=a.f>=.06,bin=b.f>=.06;if(ain)clipped.push(a);if(ain!==bin){const t=(.06-a.f)/(b.f-a.f),q={};for(const key of ['r','z','u','v'])q[key]=a[key]+(b[key]-a[key])*t;q.f=.06;clipped.push(q);}}
   if(clipped.length<3)return;if(poly.some(q=>q.f<.06))nearClipped++;draws++;
   const v=clipped.map(q=>({x:(W/2+q.r/q.f*plane)/wScale,y:(horizon+(eye-q.z)/q.f*plane)/hScale,iz:1/q.f,u:q.u/q.f,v:q.v/q.f}));
   for(let ti=1;ti<v.length-1;ti++){const ids=[0,ti,ti+1];
    const a=v[ids[0]],b=v[ids[1]],c=v[ids[2]],den=(b.y-c.y)*(a.x-c.x)+(c.x-b.x)*(a.y-c.y);if(M_abs(den)<.001)continue;
    const x0=M_max(0,M_floor(M_min(a.x,b.x,c.x))),x1=M_min(floorWidth-1,M_ceil(M_max(a.x,b.x,c.x))),y0=M_max(0,M_floor(M_min(a.y,b.y,c.y))),y1=M_min(floorHeight-1,M_ceil(M_max(a.y,b.y,c.y))),shade=item.shade||0;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
     const w0=((b.y-c.y)*(x+.5-c.x)+(c.x-b.x)*(y+.5-c.y))/den,w1=((c.y-a.y)*(x+.5-c.x)+(a.x-c.x)*(y+.5-c.y))/den,w2=1-w0-w1;if(w0<-.0001||w1<-.0001||w2<-.0001)continue;
     const iz=w0*a.iz+w1*b.iz+w2*c.iz,d=1/iz,at=y*floorWidth+x;if(d>depthPixels[at]+.018)continue;
     const u=M_floor((w0*a.u+w1*b.u+w2*c.u)/iz)&255,tv=M_floor((w0*a.v+w1*b.v+w2*c.v)/iz)&255,t=(tv*256+u)*4,out=at*4,tint=item.stripe?((M_floor((w0*a.u+w1*b.u+w2*c.u)/iz/47)&1)?.88:1.05):1;
     pixels[out]=(item.color?item.color[0]*tint:tex[t])*(1-shade)+29*shade;pixels[out+1]=(item.color?item.color[1]*tint:tex[t+1])*(1-shade)+49*shade;pixels[out+2]=(item.color?item.color[2]*tint:tex[t+2])*(1-shade)+66*shade;pixels[out+3]=255;depthPixels[at]=d;
    }
   }
  }
  // Perspective floor casting: texture is sampled in world space, never slid as a screen wallpaper.
  pixels.fill(0);depthPixels.fill(Infinity);const hScale=H/floorHeight,wScale=W/floorWidth;
  for(let yy=M_max(0,M_ceil(horizon/hScale));yy<floorHeight;yy++){
   const screenY=(yy+.5)*hScale,d=(eye*plane)/(screenY-horizon);if(d>80)continue;
   const left=-W/2/plane*d,step=wScale/plane*d;
   let wx=p.x+ca*d-sa*left,wy=p.y+sa*d+ca*left;
   for(let xx=0;xx<floorWidth;xx++,wx-=sa*step,wy+=ca*step){
    const u=M_floor(wx*148)&255,v=M_floor(wy*148)&255,idx=(v*256+u)*4,at=(yy*floorWidth+xx)*4;
    const l=sampleLight(wx,wy),fog=M_min(.34,d*.012),edge=M_min(wx%1,1-wx%1,wy%1,1-wy%1),contact=edge<.04?.95:1;
    pixels[at]=(paving[idx]*(l*.97+.03)*contact)*(1-fog)+180*fog;
    pixels[at+1]=(paving[idx+1]*(l*.83+.17)*contact)*(1-fog)+188*fog;
    pixels[at+2]=(paving[idx+2]*(l*.64+.36)*contact)*(1-fog)+190*fog;
    pixels[at+3]=255;depthPixels[yy*floorWidth+xx]=d;
   }
  }
  // Walls are rasterized into this same low-resolution world buffer below.
  // Texture slices use continuous world coordinates across cells, eliminating 1-cell-scale doors.
  const facadeKeys=['facade-window','facade-arched-door','facade-shutters','facade-grille'];
  for(let i=0;i<rays;i++){
   const sx=i*COL,offset=M_atan((sx+COL*.5-W/2)/plane),r=C.cast(p.x,p.y,p.a+offset),d=M_max(.04,r.d*M_cos(offset));zbuffer[i]=d;
   const wallH=buildingHeight(r.mx,r.my),top=horizon-(wallH-eye)*plane/d,bottom=horizon+eye*plane/d,height=bottom-top;wallTops[i]=top;
   const along=r.side?r.x:r.y,central=r.mx>=6&&r.mx<=10&&r.my>=4&&r.my<=8,pillar=!central&&r.mx>0&&r.mx<16&&r.my>0&&r.my<12;
   const module=central?2.5:2.75,origin=central?(r.side?6:4):1,index=M_floor((along-origin)/module),u=(((along-origin)/module)%1+1)%1;
   const key=pillar?'limestone':central?facadeKeys[(index+(r.side?0:1))%4]:facadeKeys[((index+(r.side?1:0))%4+4)%4];
   const data=wallPixels[key],texX=M_min(511,M_floor(u*512));
   const nx=r.side?0:(r.x>p.x?-1:1),ny=r.side?(r.y>p.y?-1:1):0,lit=nx*M_cos(sunA)+ny*M_sin(sunA),shade=lit<0?.32:.06,fog=M_min(.18,d*.009);
   const x0=M_max(0,M_floor(sx/wScale)),x1=M_min(floorWidth,M_ceil((sx+COL)/wScale)),y0=M_max(0,M_floor(top/hScale)),y1=M_min(floorHeight,M_ceil(bottom/hScale));
   for(let yy=y0;yy<y1;yy++){
    const v=M_min(.9999,M_max(0,((yy+.5)*hScale-top)/height)),texY=M_floor(v*512),t=(texY*512+texX)*4,ao=M_max(0,(v-.845)/.155)*.19;
    let cr=data[t],cg=data[t+1],cb=data[t+2];if(v<.013){cr=155;cg=121;cb=91;}else if(v<.039){cr=225;cg=212;cb=183;}else if(v<.052){cr*=.6;cg*=.6;cb*=.6;}
    cr=cr*(1-shade-ao)+39*shade;cg=cg*(1-shade-ao)+62*shade;cb=cb*(1-shade-ao)+82*shade;
    for(let xx=x0;xx<x1;xx++){const at=(yy*floorWidth+xx)*4;pixels[at]=cr*(1-fog)+124*fog;pixels[at+1]=cg*(1-fog)+151*fog;pixels[at+2]=cb*(1-fog)+163*fog;pixels[at+3]=255;depthPixels[yy*floorWidth+xx]=d;}
   }
  }
  const faces=architecture.filter(item=>{if(item.doubleSided)return true;const [a,b,c]=item.p,u=b.map((v,i)=>v-a[i]),v=c.map((x,i)=>x-a[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];return n[0]*(p.x-a[0])+n[1]*(p.y-a[1])+n[2]*(eye-a[2])>0;}).map(item=>({...item,depth:item.p.reduce((sum,q)=>sum+camera(q[0],q[1]).f,0)/4})).filter(item=>item.depth>0&&item.depth<14).sort((a,b)=>b.depth-a.depth);
  // The awning shares the per-pixel depth buffer, so it cannot paint over actors behind it.
  faces.push({p:[[5.96,4.52,2.32],[5.96,6.48,2.32],[4.96,6.48,2.08],[4.96,4.52,2.08]],t:'limestone',color:[188,177,145],stripe:true,shade:.04},{p:[[4.96,4.52,2.08],[4.96,6.48,2.08],[4.96,6.48,2.02],[4.96,4.52,2.02]],t:'limestone',color:[156,153,130],stripe:true,shade:.12});
  for(const item of faces)rasterQuad(item);
  fg.clearRect(0,0,floorWidth,floorHeight);fg.putImageData(frame,0,0);g.drawImage(floor,0,0,W,H);draws++;
  return {rays,floorPixels:floorWidth*floorHeight,drawCalls:draws,architectureQuads:faces.length,nearClippedQuads:nearClipped,width:canvas.width,height:canvas.height};
 }
 return {draw,zbuffer,depthPixels,sampleLight,lightMap:light,dimensions:{width:W,height:H,rays,floorWidth,floorHeight}};
}
// END COURTYARD WORLD
let courtyardRenderer=null;
// BEGIN ART LOADER
const artNames=['paving','limestone','facade-window','facade-arched-door','facade-shutters','facade-grille','guard-front','guard-right','guard-back','guard-left','guard-walk-a','guard-walk-b','guard-aim','guard-hit',...['front','right','back','left','walk-a','walk-b','aim','hit'].map(n=>'guard-'+n+'-512')];
const art={},artBounds={},artShadow={};let artStatus=typeof Image==='undefined'?'procedural-test':'loading',artError='',assetGeneration=0;
function loadAssets(){if(typeof Image==='undefined')return Promise.resolve();const generation=++assetGeneration,decoded={};artStatus='loading';$('resume').disabled=true;$('reloadAssets').hidden=true;
 return Promise.all(artNames.map(name=>new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{decoded[name]=image;resolve();};image.onerror=()=>reject(Error(name));image.src='assets/'+name+'.png';}))).then(()=>{if(generation!==assetGeneration)return;Object.assign(art,decoded);for(const name of artNames.filter(n=>n.startsWith('guard-'))){const image=art[name],size=image.width||256,c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');g.drawImage(image,0,0,size,size);const data=g.getImageData(0,0,size,size)?.data;let minX=size,minY=size,maxX=0,maxY=0;if(data)for(let y=0;y<size;y++)for(let x=0;x<size;x++)if(data[(y*size+x)*4+3]>0){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+1);maxY=Math.max(maxY,y+1);}if(data){const shade=document.createElement('canvas');shade.width=shade.height=size;const sg=shade.getContext('2d');sg.drawImage(image,0,0,size,size);sg.globalCompositeOperation='source-atop';sg.fillStyle='rgba(32,62,88,.28)';sg.fillRect(0,0,size,size);artShadow[name]=shade;}artBounds[name]=data?{minX:minX*256/size,minY:minY*256/size,maxX:maxX*256/size,maxY:maxY*256/size}:{minX:0,minY:0,maxX:256,maxY:256};}textureData=[sampleTexture(art.limestone),sampleTexture(art['facade-window']),sampleTexture(textures[2]),...['facade-arched-door','facade-shutters','facade-grille'].map(n=>sampleTexture(art[n]))];if(art.paving.width>0)courtyardRenderer=createCourtyardRenderer({canvas:sceneCanvas,createCanvas:(w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;},assets:art,core:C,rays:RAYS,floorWidth:480});artStatus='ready';artError='';$('resume').disabled=false;$('reloadAssets').hidden=true;}).catch(error=>{if(generation!==assetGeneration)return;artStatus='error';artError=String(error.message);$('resume').disabled=true;$('reloadAssets').hidden=false;text('resultDetail','画面加载失败，请重试');});
}
$('reloadAssets').onclick=loadAssets;
// END ART LOADER
function draw(now){ctx=sceneCtx;if(ctx.reset)ctx.reset();else ctx.clearRect(0,0,sceneCanvas.width,sceneCanvas.height);ctx.setTransform(sceneCanvas.width/VW,0,0,sceneCanvas.height/VH,0,0);const p=game.player,a=viewYaw,ca=Math.cos(a),sa=Math.sin(a),zoom=aimHeld?1.22:1,plane=VW/(2*Math.tan(82*Math.PI/360))*zoom,eye=p.hp>0?C.EYE:.72,recoil=p.recoil,horizon=VH*.5+Math.tan(viewPitch)*plane;
function camera(x,y){let dx=x-p.x,dy=y-p.y;return {f:dx*ca+dy*sa,r:-dx*sa+dy*ca};}function project(x,y,z){let q=camera(x,y);return q.f>.04?{x:VW/2+q.r/q.f*plane,y:horizon+(eye-z)/q.f*plane,d:q.f,scale:plane/q.f}:null;}
function worldLine(ax,ay,az,bx,by,bz,color,width=1){let qa=camera(ax,ay),qb=camera(bx,by);if(qa.f<=.05&&qb.f<=.05)return;if(qa.f<=.05){let t=(.05-qa.f)/(qb.f-qa.f);qa={f:.05,r:qa.r+(qb.r-qa.r)*t};az+=(bz-az)*t;}if(qb.f<=.05){let t=(.05-qb.f)/(qa.f-qb.f);qb={f:.05,r:qb.r+(qa.r-qb.r)*t};bz+=(az-bz)*t;}ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(VW/2+qa.r/qa.f*plane,horizon+(eye-az)/qa.f*plane);ctx.lineTo(VW/2+qb.r/qb.f*plane,horizon+(eye-bz)/qb.f*plane);ctx.stroke();}
const col=VW/RAYS;if(courtyardRenderer){courtyardRenderer.draw({...game,player:{...p,a:viewYaw,pitch:viewPitch}},{weapon:false,showGuard:false,hud:false,fov:82,zoom,eye,horizonRatio:.5});zbuffer.set(courtyardRenderer.zbuffer);}else{
let sky=ctx.createLinearGradient(0,0,0,Math.max(1,horizon));sky.addColorStop(0,'#7baac0');sky.addColorStop(1,'#dce8df');ctx.fillStyle=sky;ctx.fillRect(0,0,VW,VH);ctx.fillStyle='#f8e6b9';ctx.beginPath();ctx.arc(800,80+Math.tan(viewPitch)*plane,32,0,Math.PI*2);ctx.fill();let floor=ctx.createLinearGradient(0,horizon,0,VH);floor.addColorStop(0,'#d1baa0');floor.addColorStop(1,'#907863');ctx.fillStyle=floor;ctx.fillRect(0,horizon,VW,VH-horizon);
for(let x=1;x<17;x++)worldLine(x,1,0,x,12,0,'#78655233');for(let y=1;y<13;y++)worldLine(1,y,0,16,y,0,'#78655233');
let site=[];for(let n=0;n<=32;n++){let q=project(C.SITE.x+Math.cos(n/32*Math.PI*2)*C.SITE.r,C.SITE.y+Math.sin(n/32*Math.PI*2)*C.SITE.r,.012);if(q)site.push(q);}if(site.length===33){ctx.fillStyle=game.bomb.state==='planted'?'#e66d4d26':'#edb24730';ctx.strokeStyle='#f3d185';ctx.lineWidth=4;ctx.beginPath();site.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath();ctx.fill();ctx.stroke();}
wallPixels.fill(0);for(let i=0;i<RAYS;i++){let sx=i*col,offset=Math.atan((sx+col/2-VW/2)/plane),r=C.cast(p.x,p.y,a+offset),d=Math.max(.035,r.d*Math.cos(offset)),height=C.WALL_H*plane/d,top=horizon-(C.WALL_H-eye)*plane/d;zbuffer[i]=d;let along=r.side?r.x:r.y,central=r.mx>=6&&r.mx<=10&&r.my>=4&&r.my<=8,pillar=!central&&r.mx>0&&r.mx<16&&r.my>0&&r.my<12,module=central?2.5:2.75,origin=central?(r.side?6:4):1,coord=artStatus==='ready'&&!pillar?((along-origin)/module)%1:along%1;if(coord<0)coord+=1;const facade=[1,3,4,5],index=Math.floor((along-origin)/module),textureIndex=artStatus==='ready'?(pillar?0:facade[((index+(r.side?0:1))%4+4)%4]):r.mx===6&&r.my===6?2:(r.mx+r.my)%7===0?1:0,data=textureData[textureIndex],tx=Math.min(255,Math.floor(coord*256)),shade=Math.min(.62,(r.side?.15:.03)+d*.014),x0=Math.floor(sx*.5),x1=Math.min(480,Math.floor((sx+col)*.5)),y0=Math.max(0,Math.floor(top*.5)),y1=Math.min(310,Math.ceil((top+height)*.5));for(let yy=y0;yy<y1;yy++){let ty=(((yy+.5)*2-top)/height*256)|0;if(ty<0)ty=0;else if(ty>255)ty=255;const at=(ty*256+tx)*4,red=(data[at]*(1-shade)+25*shade)|0,green=(data[at+1]*(1-shade)+42*shade)|0,blue=(data[at+2]*(1-shade)+54*shade)|0,color=(255<<24)|(blue<<16)|(green<<8)|red,target=yy*480+x0;wallPixels32[target]=color;if(x1>x0+1)wallPixels32[target+1]=color;}}wallCtx.putImageData(wallImage,0,0);ctx.drawImage(wallLayer,0,0,VW,VH);}
ctx=outputCtx;if(ctx.reset)ctx.reset();else{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);}ctx.setTransform(canvas.width/VW,0,0,canvas.height/VH,0,0);ctx.imageSmoothingEnabled=true;ctx.drawImage(sceneCanvas,0,0,VW,VH);
function clipSprite(q,halfWidth,drawFn){if(!q||q.d<=.08)return;const box=typeof halfWidth==='number'?{minX:-halfWidth,maxX:halfWidth,minY:-halfWidth,maxY:halfWidth}:halfWidth;ctx.save();ctx.beginPath();
 if(courtyardRenderer){const d=courtyardRenderer.depthPixels,ww=480,hh=310,x0=Math.max(0,Math.floor((q.x+box.minX*q.scale)/2)),x1=Math.min(ww-1,Math.ceil((q.x+box.maxX*q.scale)/2)),y0=Math.max(0,Math.floor((q.y+(box.minY??-2)*q.scale)/2)),y1=Math.min(hh-1,Math.ceil((q.y+(box.maxY??2)*q.scale)/2));
  // Merge equal row intervals into rectangles. Every rectangle is tested against the exact world depth buffer.
  let previous=new Map();for(let y=y0;y<=y1+1;y++){const current=new Map();let start=-1;for(let x=x0;x<=x1+1;x++){const visible=y<=y1&&x<=x1&&d[y*ww+x]>q.d-.025;if(visible&&start<0)start=x;if(!visible&&start>=0){const key=start+':'+x,old=previous.get(key);current.set(key,old||{x:start,y,w:x-start,h:0});current.get(key).h++;previous.delete(key);start=-1;}}for(const r of previous.values())ctx.rect(r.x*2,r.y*2,r.w*2,r.h*2);previous=current;}
 }else{let l=Math.max(0,Math.floor((q.x+box.minX*q.scale)/col)),r=Math.min(RAYS-1,Math.ceil((q.x+box.maxX*q.scale)/col)),run=-1;for(let i=l;i<=r+1;i++){const visible=i<=r&&zbuffer[i]>q.d-.08;if(visible&&run<0)run=i;if(!visible&&run>=0){ctx.rect(run*col,0,(i-run)*col+.5,VH);run=-1;}}}
 ctx.clip();drawFn();ctx.restore();}
// Site markers are clipped against the same world geometry; no through-wall target ring.
if(courtyardRenderer)for(let n=0;n<40;n++){const t=(n+.5)/40*Math.PI*2,q=project(C.SITE.x+Math.cos(t)*C.SITE.r,C.SITE.y+Math.sin(t)*C.SITE.r,.025);clipSprite(q,.07,()=>{ctx.fillStyle=game.bomb.state==='planted'?'#f2965d':'#f3d185';ctx.fillRect(q.x-2,q.y-1,4,2);});}
let actors=game.enemies.map(e=>({kind:'enemy',e,d:camera(e.x,e.y).f}));if(game.bomb.state==='planted'||game.bomb.state==='planting')actors.push({kind:'bomb',e:{x:C.SITE.x,y:C.SITE.y},d:camera(C.SITE.x,C.SITE.y).f});actors.sort((a,b)=>b.d-a.d);
for(const actor of actors){const e=actor.e,q=project(e.x,e.y,actor.kind==='bomb'?.12:.9);clipSprite(q,actor.kind==='bomb'?.32:artStatus==='ready'?guardVisibleBounds(e,motion.guardPose(e),Math.atan2(p.y-e.y,p.x-e.x)-e.a,q?.scale):.7,()=>{ctx.save();ctx.translate(q.x,q.y);ctx.scale(q.scale,q.scale);if(actor.kind==='bomb'){ctx.fillStyle='#4b5149';ctx.fillRect(-.24,-.07,.48,.19);ctx.strokeStyle='#e9c980';ctx.lineWidth=.035;ctx.strokeRect(-.24,-.07,.48,.19);ctx.fillStyle=Math.floor(now/180)%2?'#ff895d':'#794b32';ctx.fillRect(-.1,-.12,.2,.065);if(game.bomb.defuser>=0){ctx.strokeStyle='#ffdda1';ctx.lineWidth=.04;ctx.beginPath();ctx.arc(0,-.3,.24,-Math.PI/2,-Math.PI/2+Math.PI*2*game.bomb.defuse/C.DEFUSE_TIME);ctx.stroke();}}
else{drawMotionGuard(ctx,e,motion.guardPose(e),Math.atan2(p.y-e.y,p.x-e.x)-e.a,q.scale);if(e.hp>0){ctx.fillStyle='#203e4a';ctx.fillRect(-.27,-.9,.54,.04);ctx.fillStyle='#f1a286';ctx.fillRect(-.27,-.9,.54*e.hp/80,.04);}}ctx.restore();});}
for(const e of visuals){if(!(e.first||now<e.until))continue;if(e.type==='enemy-trace'&&!C.sight(p,{x:e.x,y:e.y}))continue;if(e.type==='trace'||e.type==='enemy-trace'){let end=project(e.tx,e.ty,e.tz);if(end){ctx.strokeStyle=e.type==='trace'?'#ffe2a49a':'#ff8b5855';ctx.lineWidth=e.type==='trace'?1.3:1.6;ctx.beginPath();let start=project(e.x,e.y,e.z);ctx.moveTo(start?.x??VW*.56,start?.y??VH*.68);ctx.lineTo(end.x,end.y);ctx.stroke();}}else{let q=project(e.x,e.y,e.z);clipSprite(q,.18,()=>{ctx.strokeStyle='#ffe0ad';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,Math.min(14,q.scale*.12),0,Math.PI*2);ctx.stroke();});}}
// Independent local viewmodel animation never changes the camera or hit timing.
if(p.hp>0)drawMotionWeapon(ctx,p,motion.playerPose(p,{reduced}),now<flashUntil||flashFirst,VH/2);
// Small route radar aids navigation without a text tutorial or enemy x-ray.
ctx.fillStyle='#163747b8';ctx.fillRect(22,65,109,85);for(let y=0;y<C.H;y++)for(let x=0;x<C.W;x++){ctx.fillStyle=C.MAP[y][x]?'#afbdaf':'#335364';ctx.fillRect(26+x*6,69+y*6,5.5,5.5);}ctx.fillStyle='#f6cc7a';ctx.fillRect(26+C.SITE.x*6-3,69+C.SITE.y*6-3,6,6);ctx.save();ctx.translate(26+p.x*6,69+p.y*6);ctx.rotate(p.a);ctx.fillStyle='#b3f0d5';ctx.beginPath();ctx.moveTo(5,0);ctx.lineTo(-3,-3);ctx.lineTo(-3,3);ctx.closePath();ctx.fill();ctx.restore();
if(hurtSource&&now<hurtSource.until){let bearing=Math.atan2(hurtSource.y-p.y,hurtSource.x-p.x)-p.a;ctx.save();ctx.translate(VW/2+Math.sin(bearing)*180,VH/2-Math.cos(bearing)*135);ctx.rotate(bearing);ctx.fillStyle='#e7694cd9';ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(-8,8);ctx.lineTo(8,8);ctx.closePath();ctx.fill();ctx.restore();}
if(p.hp>0){let ballisticSpread=.002+p.recoil*.08+(p.moveSpeed>.1?.009:0),spread=3+Math.tan(ballisticSpread/2)*plane,aimY=VH/2+(Math.tan(viewPitch)-Math.tan(viewPitch+p.recoil))*plane;ctx.strokeStyle='#f3f9e8';ctx.lineWidth=1.7;ctx.beginPath();for(const [dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){ctx.moveTo(VW/2+dx*spread,aimY+dy*spread);ctx.lineTo(VW/2+dx*(spread+6),aimY+dy*(spread+6));}ctx.stroke();}
}
// Frame simulation is partitioned at stamped input edges and live internal deadlines.
// Raw look previews only presentation; authoritative yaw changes at its own event time.
function tryFire(at,renderNow){while(presses.length&&presses[0].attempted&&at-presses[0].at>200)presses.shift();if(presses.length){const press=presses[0],fired=C.fire(game,press);press.attempted=true;if(fired){presses.shift();consume(renderNow);}return;}if(held&&C.fire(game))consume(renderNow);}
function applyInput(event,at,renderNow){if(game.state!=='active')return;if(event.type==='look'){C.look(game,event.dx,event.dy);motion.look(event.dx,event.dy);}if(event.type==='key')keys[event.code]=event.value;if(event.type==='aim')aimHeld=event.value;if(event.type==='up')held=false;if(event.type==='down'){held=true;if(game.player.ammo===0){motion.cue('empty');consume(renderNow);}presses.push({a:game.player.a,pitch:game.player.pitch+game.player.recoil,at});if(presses.length>6)presses.shift();tryFire(at,renderNow);}}
// A positive countdown is pending, however small. Advance to it instead of
// treating it as either already ready or too small to schedule. C.step clamps
// a reached countdown to exactly zero before world events and then firing.
function nextDeadline(limit){let next=limit;const consider=n=>{if(Number.isFinite(n)&&n>0)next=Math.min(next,n);},p=game.player,b=game.bomb;consider(p.cool);consider(p.reload);for(const e of game.enemies)if(e.hp>0){consider(e.windup);consider(e.cool);consider(e.cover);}if(b.state==='planted'){consider(b.timer);if(b.defuser>=0)consider(C.DEFUSE_TIME-b.defuse);}else{consider(game.time);if(b.state==='planting')consider(C.PLANT_TIME-b.plant);}return next;}
function simulateInterval(from,to,budget,renderNow){let cursor=from,remaining=Math.max(0,to-from);while(remaining>0&&budget.ms>0&&game.state==='active'){tryFire(cursor,renderNow);if(game.state!=='active')break;let dt=nextDeadline(Math.min(.04,remaining/1000,budget.ms/1000));if(!(dt>0))break;C.step(game,{forward:(keys.ArrowUp?1:0)-(keys.ArrowDown?1:0),strafe:(keys.ArrowRight?1:0)-(keys.ArrowLeft?1:0),fire:held,fireHandled:true,aim:aimHeld},dt);motion.observe(game,dt,{aim:aimHeld});consume(renderNow);const used=dt*1000;cursor+=used;remaining=Math.max(0,remaining-used);budget.ms=Math.max(0,budget.ms-used);
// Settle readiness at this exact endpoint, including the final presentation.
// Existing world terminal events have already resolved inside C.step, so an
// exact tie cannot be rescued by a buffered player shot.
tryFire(cursor,renderNow);}return to;}
function frame(stamp){const now=Math.max(stamp,performance.now()),frameStart=last,raw=Math.max(0,(now-frameStart)/1000);last=now;rawFrames.push(raw*1000);if(rawFrames.length>180)rawFrames.shift();if(game.state==='active'){
const sim=Math.min(.1,raw),budget={ms:sim*1000};simDroppedMs+=Math.max(0,raw-sim)*1000;let cursor=frameStart;const events=timeline;timeline=[];for(const event of events){if(event.at>now){timeline.push(event);continue;}const at=Math.max(cursor,Math.min(now,event.at));simulateInterval(cursor,at,budget,now);cursor=at;if(game.state!=='active')break;applyInput(event,at,now);}if(game.state==='active')simulateInterval(cursor,now,budget,now);viewYaw=game.player.a;viewPitch=game.player.pitch;
if(game.state!=='active'){if(game.state==='won'){profile.wins++;profile.best=profile.best===null?game.elapsed:Math.min(profile.best,game.elapsed);}release();if(document.pointerLockElement===canvas)document.exitPointerLock?.();persist();showOverlay();}else{saveClock+=sim;if(saveClock>1.5){saveClock=0;persist();}}}
hurt=Math.max(0,hurt-raw*1.5);let began=performance.now();draw(now);lastRenderCostMs=performance.now()-began;hud(now);if(latestInput){inputSamples.push({kind:latestInput.kind,ms:Math.max(0,now-latestInput.at)});if(inputSamples.length>120)inputSamples.shift();latestInput=null;}visuals=visuals.filter(e=>{e.first=false;return now<e.until;});flashFirst=false;hitFirst=false;motion.presented();frameCounter++;requestAnimationFrame(frame);}

function stats(values){let a=[...values].sort((a,b)=>a-b);return {last:values.at(-1)||0,median:a[Math.floor(a.length*.5)]||0,p95:a[Math.floor(a.length*.95)]||0,max:a.at(-1)||0};}
window.relayDiagnostics=()=>({release:'breach-motion-0.2.1',art:{status:artStatus,error:artError,loaded:Object.keys(art).length,world:courtyardRenderer?'courtyard-v0.3-adapted':'logic-fallback',worldResolution:[480,310],rays:RAYS},motion:motion.inspect(),pose:motion.playerPose(game.player,{reduced}),audioEvents:audioHistory.slice(-20),state:game.state,player:{...game.player,a:viewYaw,pitch:viewPitch},enemies:game.enemies.map(e=>({...e})),bomb:{...game.bomb},time:game.time,elapsed:game.elapsed,kills:game.kills,shots:game.shots,hits:game.hits,queuedPresses:presses.length+timeline.filter(e=>e.type==='down').length,queuedInputs:timeline.length,pointerLocked:document.pointerLockElement===canvas,frameRawMs:stats(rawFrames),inputToRenderMs:stats(inputSamples.map(e=>e.ms)),lastRenderCostMs,simulationCatchupDroppedMs:simDroppedMs,frameCounter,storageWarning:!$('storageNotice').hidden,checkpointValid:C.snapshot(game)===null||C.validRound(C.snapshot(game)),profile:{wins:profile.wins,attempts:profile.attempts,best:profile.best},viewport:[canvas.width,canvas.height]});
showOverlay();window.relayAssetsReady=loadAssets();requestAnimationFrame(frame);
