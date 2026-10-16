/* Bounded 120Hz simulation timeline. Render cadence never becomes game speed. */
(function(root){
'use strict';
const EPS=1e-6;
class Timeline {
  constructor({stepMs=1000/120,maxGapMs=250,maxSlices=64}={}){this.stepMs=stepMs;this.maxGapMs=maxGapMs;this.maxSlices=maxSlices;this.active=false;}
  start(now){this.active=true;this.time=now;this.nextTick=now+this.stepMs;this.lastObserved=now;}
  pause(){this.active=false;}
  advance(now,{step,nextEvent=()=>Infinity,onEvent=()=>true,flush=false}){
    const result={advancedMs:0,slices:0,events:0,stalled:false};
    if(!this.active)return result;
    if(!Number.isFinite(now)||now<this.lastObserved-EPS||now-this.lastObserved>this.maxGapMs+EPS){this.active=false;result.stalled=true;return result;}
    const from=this.time;this.lastObserved=now;
    const advanceStep=to=>{const dt=to-this.time;this.time=to;if(dt>EPS){result.slices++;if(step(dt/1000)===false)this.active=false;}};
    while(this.active){
      let eventAt=nextEvent();if(!Number.isFinite(eventAt))eventAt=Infinity;
      const boundary=Math.min(this.nextTick,eventAt);
      if(boundary>now+EPS)break;
      if(result.slices+result.events>=this.maxSlices||boundary<this.time-EPS){this.active=false;result.stalled=true;break;}
      advanceStep(Math.max(this.time,boundary));
      if(this.nextTick<=this.time+EPS)this.nextTick+=this.stepMs;
      if(!this.active)break;
      if(eventAt<=this.time+EPS){result.events++;if(onEvent(eventAt)===false)this.active=false;}
    }
    if(this.active&&flush&&now-this.time>EPS)advanceStep(now);
    result.advancedMs=this.time-from;
    return result;
  }
}
const api={Timeline};if(typeof module==='object'&&module.exports)module.exports=api;else root.PelicanClock=api;
})(typeof globalThis!=='undefined'?globalThis:this);
