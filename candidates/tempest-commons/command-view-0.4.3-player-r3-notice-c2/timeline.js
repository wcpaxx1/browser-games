/* Event-time 20 Hz clock. Keeps every elapsed simulation step; bounded work per RAF. */
(function(root){'use strict';
class Timeline{
 constructor(g,now=0){this.g=g;this.last=now;this.active=0;this.done=0;this.events=[];this.seq=0;this.paused=g.sim.paused;this.applied=0}
 accrue(now){if(!Number.isFinite(now))return;now=Math.max(this.last,now);if(!this.paused)this.active+=now-this.last;this.last=now}
 enqueue(c,now){this.accrue(now);if(this.paused||this.g.sim.status!=='playing')return false;this.events.push({at:Math.max(this.active,this.done),seq:++this.seq,c:JSON.parse(JSON.stringify(c))});return true}
 pause(now){this.accrue(now);this.paused=true;this.g.sim.paused=true}
 resume(now){this.last=Math.max(this.last,now);this.paused=false;this.g.sim.paused=false}
 apply(until,strict=false){while(this.events.length&&(strict?this.events[0].at<until:this.events[0].at<=until)){const e=this.events.shift();const p=this.g.sim.paused;this.g.sim.paused=false;root.CommandBattle.command(this.g,e.c);this.g.sim.paused=p;this.applied++}}
 drain(now,budget=10){this.accrue(now);let n=0;while(this.active-this.done>=50&&n<budget&&this.g.sim.status==='playing'){
   // A command takes effect at the first tick boundary strictly after its timestamp.
   // This is identical under regular RAFs or a delayed catch-up batch.
   this.apply(this.done+50,true);const p=this.g.sim.paused;this.g.sim.paused=false;root.CommandBattle.step(this.g);this.g.sim.paused=p;this.done+=50;n++;
  }
  if(this.g.sim.status!=='playing'){this.done=this.active;this.events=[]}
  else if(this.active-this.done<50)this.apply(this.active);
  return n;
 }
 get debt(){return Math.max(0,this.active-this.done)}
 get settled(){return this.debt<50&&!this.events.length}
}
root.CommandTimeline=Timeline;
})(globalThis);
