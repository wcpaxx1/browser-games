/* One monotonic timeline, advanced at event receipt BEFORE mutating input.
   RAF timestamps and OS repeat never become a simulation clock. */
(function(root){'use strict';
class Timeline {
 constructor(step,maxGap=250){this.step=step;this.maxGap=maxGap;this.last=0;this.active=false;this.held=Object.create(null);this.lastStep=0;}
 start(now){this.last=now;this.active=true;this.clear();}
 clear(){this.held=Object.create(null);}
 pause(){this.active=false;this.clear();}
 advance(now){if(!this.active)return false;if(!Number.isFinite(now)||now<this.last)return false;const gap=now-this.last;if(gap>this.maxGap){this.pause();return 'stall';}let left=gap/1000;while(left>1e-9){const dt=Math.min(left,1/120);this.step(dt,this.held);left-=dt;}this.last=now;return true;}
 key(key,down,now,repeat=false){if(!this.active)return false;if(down&&(repeat||this.held[key]))return false;const ok=this.advance(now);if(ok!==true)return ok;if(down)this.held[key]=true;else delete this.held[key];return true;}
 edge(now,fn){if(!this.active)return false;const ok=this.advance(now);if(ok!==true)return ok;fn();return true;}
}
const api={Timeline};if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperInput=api;
})(typeof globalThis!=='undefined'?globalThis:this);
