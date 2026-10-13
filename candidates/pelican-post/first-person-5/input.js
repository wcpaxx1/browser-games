/* Game-owned held-direction cadence. Browser auto-repeat is intentionally ignored. */
(function(root){
'use strict';
class DirectionHold {
  constructor(interval=140){this.interval=interval;this.clear();}
  clear(){this.keys=new Map();this.active=null;this.nextAt=Infinity;}
  press(key,direction,now){
    if(this.keys.has(key)||!['up','down'].includes(direction)||!Number.isFinite(now))return false;
    this.keys.set(key,direction);this.active=key;this.nextAt=now+this.interval;return true;
  }
  release(key,now){
    this.keys.delete(key);
    if(this.active===key){this.active=[...this.keys.keys()].pop()||null;this.nextAt=this.active?now+this.interval:Infinity;}
  }
  poll(now){
    if(!this.active||now<this.nextAt||!Number.isFinite(now))return null;
    const direction=this.keys.get(this.active);this.nextAt+=this.interval;
    if(this.nextAt<=now)this.nextAt=now+this.interval; // At most one step per frame; never replay a stalled backlog.
    return direction||null;
  }
}
const api={DirectionHold};if(typeof module==='object'&&module.exports)module.exports=api;else root.PelicanInput=api;
})(typeof globalThis!=='undefined'?globalThis:this);
