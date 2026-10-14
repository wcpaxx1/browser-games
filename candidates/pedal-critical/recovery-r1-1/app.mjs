import * as original from './recovered-core.mjs';
import {attachSafeInput} from './input-boundary.mjs';
/** New recovery entry, not a reconstruction of the lost B4 source tree. */
export function createBrakeApp({document:doc=globalThis.document,window:win=globalThis.window,core=original,clock=()=>performance.now(),requestFrame=cb=>requestAnimationFrame(cb),loadImage,makeCanvas}={}){
 const $=id=>doc.getElementById(id),canvas=$('world');
 const manifest=core.createScenario('00000001','crossing'),audio=core.createGameAudio();
 let view=null,sim=null,current=null,previous=null,engine=null,adapter=null,timeline=null;
 let generation=0,ready=false,disposed=false,accumulator=0,lastTime=null,practice=false,practiceDone=false,practiceTouched=false,practiceReleased=false,practicePeak=0,incidentTime=null,incidentShown=false,recordedId=null;
 const disposers=[],listen=(target,type,fn)=>{target.addEventListener(type,fn);disposers.push(()=>target.removeEventListener(type,fn));};
 const names={safe:'平安',injured:'受伤',serious:'重伤',lost:'遇难'};
 const make=makeCanvas??((w,h)=>{const c=doc.createElement('canvas');c.width=w;c.height=h;return c;});
 const load=loadImage??(url=>new Promise((resolve,reject)=>{const image=new win.Image();image.onload=()=>resolve(image);image.onerror=()=>reject(Error('画面素材读取失败'));image.src=url.href;}));
 const prefix='pedal-critical/recovery-r1/v1/';
 const storage=(()=>{try{const s=win.localStorage;return s?{getItem:k=>s.getItem(prefix+k),setItem:(k,v)=>s.setItem(prefix+k,v),removeItem:k=>s.removeItem(prefix+k)}:null;}catch{return null;}})();
 const saves=new core.SaveStore(storage);let saved=saves.load();
 function show(title,copy,action='正式开始'){$('candidate-warning').hidden=current?.state!=='ready';$('card-title').textContent=title;$('card-copy').textContent=copy;$('start').textContent=action;$('start').disabled=!ready;$('overlay').hidden=false;}
 function showReady(){show('林间横穿 · '+(manifest.initialSpeedMps*3.6).toFixed(0)+' km/h',practiceDone?'车辆还没有移动。点击“正式开始”才进入危险场景。请及时制动，让小狗安全通过。':'先在静止世界试踩。抬手归零后，再明确开始这一程。',practiceDone?'正式开始':'开始试踩（不发车）');}
 function settings(){saved.settings={...saved.settings,muted:!$('sound').checked,reducedMotion:$('motion').checked};audio.setMuted(saved.settings.muted);saves.commit(saved);$('save-status').textContent=saves.status;}
 function applySettings(){$('sound').checked=!saved.settings.muted;$('motion').checked=saved.settings.reducedMotion;audio.setMuted(saved.settings.muted);$('save-status').textContent=saves.status;}
 function stopInput(){timeline?.clear();timeline=null;adapter?.dispose();adapter=null;engine?.cancel('transition',clock());engine=null;$('pedal').classList.remove('pressed');}
 function beginInput(){
  stopInput();timeline=practice?null:new core.InputTimeline(clock(),current.tick);
  engine=core.createInputEngine({windowPolicy:'experimentalConfidence100ms',onChange:event=>{if(practice)practicePeak=Math.max(practicePeak,event.forceN);timeline?.enqueue(event,event.source);}});
  adapter=attachSafeInput({element:$('pedal'),engine,windowObject:win,documentObject:doc,onChange:state=>{
   if(practice){if(state.contactActive)practiceTouched=true;else if(practiceTouched&&state.forceN===0)practiceReleased=true;}
   $('pedal').classList.toggle('pressed',state.contactActive);
   $('input-hint').textContent=state.pressure.mode==='pressure'?'观察到可变压力 · 调节虚构游戏力 · 抬手释放':state.inputConfidence==='limited-near-overload'?'接近过载，暂限安全脚力；更明确下滑可继续增加。':'按下轻刹 · 加速下滑加力 · 停手保持 · 上滑减力 · 抬手释放';
  },onPause:pause});
 }
 function draw(){if(disposed)return;try{drawUnsafe();}catch(error){fail(error);}}
 function drawUnsafe(){
  if(!ready||!view||!current||!previous)return;
  view.render(previous,current,Math.min(1,accumulator/core.DT),$('motion').checked);
  const input=engine?.getState(),force=practice?(input?.forceN??0):current.pedal.FfootN;
  $('speed').textContent=(Math.hypot(current.vehicle.vxMps,current.vehicle.vyMps)*3.6).toFixed(0);
  $('time').textContent=current.timeS.toFixed(2)+' s';$('force').textContent=Math.round(force)+' N';$('force-fill').style.width=force/40+'%';
  $('force-label').textContent=current.state==='complete'?'停稳时脚力（已停止输入）':'脚力 · 游戏输入';
  $('force').classList.toggle('danger',force>manifest.pedalMaterial.FsafeN);
  $('damage').textContent=current.pedal.state==='broken'?'踏板断裂 · 制动已失效':current.pedal.damage01>.01?'踏板损伤 '+Math.round(current.pedal.damage01*100)+'%':'踏板完好';
  $('damage').classList.toggle('danger',current.pedal.state==='broken'||force>manifest.pedalMaterial.FsafeN);
  $('people').textContent=current.seats.map(s=>s.label+' '+names[s.outcome]).join(' / ')+' · '+current.actors.map(a=>'小狗 '+names[a.outcome]).join(' / ');
  if(practice){
   if(practiceTouched&&input&&!input.contactActive&&input.forceN===0&&!input.pausedRequired)practiceReleased=true;
   $('practice-peak').textContent='本次试踩最高 '+Math.round(practicePeak)+' N';
   $('practice-go').disabled=!(practiceReleased&&input&&!input.contactActive&&input.forceN===0);
   $('practice-state').textContent=input?.contactActive?'可加力、停手保持、上滑减力；试完请完全抬手。':input&&input.forceN>0?'脚力正在释放，归零后可准备出发。':practiceReleased?'已经归零。可以准备出发，世界仍静止。':'先按下试踩。世界、危险、损伤都不会推进。';
  }
  canvas.dataset.tick=String(current.tick);canvas.dataset.state=current.state;canvas.dataset.vehicleX=String(current.vehicle.xM);
 }
 function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(1,1280/rect.width,800/rect.height);canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));draw();}
 function trial(){practice=true;practiceTouched=false;practiceReleased=false;practicePeak=0;$('overlay').hidden=true;$('practice-panel').hidden=false;beginInput();$('pedal').focus({preventScroll:true});resize();}
 function leaveTrial(){if(!practice||!engine||engine.getState().contactActive||engine.getState().forceN>0||!practiceReleased)return;practice=false;practiceDone=true;stopInput();$('practice-panel').hidden=true;show('准备好再开始。','车辆仍未移动。点击“正式开始”后，请重新踩下踏板。','正式开始');resize();}
 function pause(reason='manual'){
  if(practice){practice=false;stopInput();$('practice-panel').hidden=true;show('试踩已暂停。','世界没有推进。重新试踩时需要重新按下。','重新试踩');resize();return;}
  if(!sim||!current||!['active','resolving'].includes(current.state))return;
  sim.pause(reason);current=previous=sim.snapshot();accumulator=0;stopInput();audio.update(current,[]);
  show('先停一下。',reason==='performance'?'画面间隔超过250ms，世界已暂停，没有追赶快进。':'暂停不会推进危险或累计损伤。继续时请重新按下踏板。','继续本局');draw();
 }
 function fail(error){ready=false;pause('render');stopInput();view?.dispose();view=null;if(current)audio.update({...current,state:'paused'},[]);show('画面中断，世界已暂停。',String(error),'无法继续');}
 async function prepare(){
  if(disposed)return false;
  const token=++generation;ready=false;practice=false;stopInput();$('practice-panel').hidden=true;$('start').disabled=true;
  if(sim){sim.abort();audio.update(sim.snapshot(),[]);sim.dispose();}sim=null;
  try{
   const next=await core.createSimulation(manifest);if(disposed||token!==generation){next.dispose();return false;}sim=next;current=previous=next.snapshot();accumulator=0;lastTime=null;incidentTime=null;incidentShown=false;recordedId=null;$('restart').textContent='重新准备';
   if(!view){const art=await core.loadArt(load,new URL('./art/',doc.baseURI));if(disposed||token!==generation)return false;view=core.createDriveRenderer(canvas,make,art,manifest);}
   resize();view.render(current,current,1);ready=true;showReady();draw();return true;
  }catch(error){if(disposed||token!==generation)return false;ready=false;stopInput();view?.dispose();view=null;show('画面没有准备好。',String(error),'无法开始');return false;}
 }
 async function begin(){
  if(!ready||!sim||!view)return;
  if(current.state==='ready'&&!practiceDone){trial();return;}
  try{void Promise.resolve(audio.unlock()).catch(()=>{});}catch{}audio.setMuted(!$('sound').checked);
  if(current.state==='paused')sim.resume();else if(current.state==='ready')sim.start();else {if(!await prepare()||!ready||!sim||disposed)return;sim.start();}
  current=previous=sim.snapshot();saved.tutorialComplete=true;settings();$('overlay').hidden=true;accumulator=0;lastTime=null;beginInput();$('pedal').focus({preventScroll:true});
 }
 function record(){if(!current||current.state!=='complete'||!['protected','survived_with_harm','severe_loss'].includes(current.outcome)||recordedId===current.runId)return;recordedId=current.runId;saved.completedRuns++;saved.lastScenarioRef={seedHex:manifest.seedHex,templateId:manifest.templateId};saved.lastResult={...saved.lastScenarioRef,configHash:manifest.configHash,outcome:current.outcome,tick:current.tick,contacts:current.stats.contactCount,peakForceN:current.stats.peakForceN,seatOutcomes:current.seats.map(x=>x.outcome),actorOutcomes:current.actors.map(x=>x.outcome)};saves.commit(saved);$('save-status').textContent=saves.status;}
 function results(){const people=current.seats.map(s=>s.label+'：'+names[s.outcome]).join('，')+'。小狗：'+names[current.actors[0].outcome]+'。';return current.outcome==='protected'?'车辆已停稳，外部风险已清空。'+people:'当前真实后果：'+people+'本局未取得全部平安的结局。';}
 function frame(time){
  if(disposed)return;requestFrame(frame);const elapsed=lastTime===null?0:(time-lastTime)/1000;lastTime=time;if(!ready||!sim||!current||!view)return;
  if(practice){try{engine?.advanceTo(time);draw();}catch(e){fail(e);}return;}
  if(['active','resolving'].includes(current.state)){
   if(elapsed>.25||accumulator>.25){pause('performance');return;}accumulator+=elapsed;let steps=0;const events=[];
   while(accumulator>=core.DT&&steps<16){previous=current;const result=sim.step(timeline?.command(current.tick+1)??{tick:current.tick+1,sequence:current.tick+1,forceDeciN:0,contactActive:false,source:'drag'});current=result.snapshot;events.push(...result.events);accumulator-=core.DT;steps++;
    if(incidentTime===null&&result.events.some(e=>e.type==='contactStarted'))incidentTime=current.timeS;
    if(['complete','faulted'].includes(current.state)){record();stopInput();audio.update(current,events);show(current.outcome==='protected'?'这一程，全部平安。':'这一程的结果。',results(),'同场景重试');break;}
    if(!incidentShown&&incidentTime!==null&&current.timeS-incidentTime>=1){incidentShown=true;pause('incident');$('restart').textContent='结束本局并重试';show('刚才发生了接触。','小狗：'+names[current.actors[0].outcome]+'。'+current.seats.map(s=>s.label+'：'+names[s.outcome]).join('，')+'。当前车速 '+(Math.hypot(current.vehicle.vxMps,current.vehicle.vyMps)*3.6).toFixed(1)+' km/h，世界已暂停。继续观察会继续模拟；结束重试记为中止，不冒充安全停车。','继续观察');break;}
   }audio.update(current,events);
  }try{draw();}catch(e){fail(e);}
 }
 $('start').onclick=begin;$('practice-go').onclick=leaveTrial;$('pause').onclick=()=>pause();$('retry').onclick=prepare;$('restart').onclick=prepare;
 $('sound').onchange=()=>{try{void Promise.resolve(audio.unlock()).catch(()=>{});}catch{}settings();};$('motion').onchange=()=>{settings();draw();};
 $('save-export').onclick=()=>{$('save-text').value=saves.export();$('save-status').textContent=saves.status;};
 $('save-import').onclick=()=>{const raw=$('save-text').value,check=core.validateSave(raw);if(!check.ok){$('save-status').textContent=check.reason;return;}if(!win.confirm('导入会覆盖此恢复候选的设置和结算记录。确定继续？'))return;adapter?.resetForRestore(clock());pause('restore');stopInput();const result=saves.importConfirmed(raw);if(result.ok){saved=saves.payload();applySettings();draw();}else $('save-status').textContent=result.reason;};
 listen(win,'resize',()=>{try{resize();}catch(e){fail(e);}});listen(win,'blur',()=>pause('blur'));listen(doc,'visibilitychange',()=>{if(doc.hidden)pause('hidden');});
 listen(win,'pagehide',event=>{pause('hidden');stopInput();audio.setMuted(true);if(!event.persisted)dispose();});
 listen(win,'pageshow',event=>{if(!event.persisted||!ready||!current)return;audio.setMuted(!$('sound').checked);if(current.state==='paused')show('已暂停这一程。','页面恢复后不会自动踩踏板或推进世界。','继续本局');else if(current.state==='ready')showReady();else show(current.outcome==='protected'?'这一程，全部平安。':'这一程的结果。',results(),'同场景重试');resize();});
 function dispose(){if(disposed)return;disposed=true;generation++;ready=false;stopInput();disposers.forEach(fn=>fn());for(const id of ['start','practice-go','pause','retry','restart','sound','motion','save-export','save-import']){$(id).onclick=null;$(id).onchange=null;}view?.dispose();view=null;audio.dispose();sim?.dispose();sim=null;}
 applySettings();show('正在准备驾驶场景。','载入本地素材与120Hz物理。');const readyPromise=prepare();requestFrame(frame);
 return {ready:readyPromise,dispose};
}
