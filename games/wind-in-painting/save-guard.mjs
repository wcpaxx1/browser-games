// Coordinate this release's writers without overwriting an unacknowledged save.
export class SaveGuard {
 constructor({key,storage,locks,onChange=()=>{}}){
  this.key=key;this.onChange=onChange;this.area=null;this.locks=null;
  this.initial=null;this.readable=false;this.expected=null;
  this.block='';this.failure=false;this.pending=null;this.flight=false;this.epoch=0;
  try{this.area=storage();this.initial=this.area.getItem(key);this.expected=this.initial;this.readable=true;}
  catch{this.block='read';}
  try{this.locks=locks();if(typeof this.locks?.request!=='function'&&!this.block)this.block='locks';}
  catch{if(!this.block)this.block='locks';}
 }
 get status(){return this.block||(this.failure?'write':this.pending!==null||this.flight?'pending':'saved');}
 notify(){this.onChange(this.status);}
 protect(reason){this.epoch++;this.pending=null;this.block=reason;this.notify();}
 observe(event){
  if(!this.area||event.storageArea!==this.area||(event.key!==this.key&&event.key!==null))return false;
  // A clear or delayed ABA event matters even if the original bytes reappeared.
  this.protect('conflict');return true;
 }
 save(raw){
  if(this.block){this.notify();return false;}
  this.pending=raw;this.notify();this.pump();return true;
 }
 pump(){
  if(this.flight||this.block||this.pending===null)return;
  const epoch=this.epoch;this.flight=true;let task;
  try{task=this.locks.request(this.key+':save-guard-v1',{mode:'exclusive'},()=>{
   if(epoch!==this.epoch||this.block||this.pending===null)return;
   const raw=this.pending;this.pending=null;let actual;
   try{actual=this.area.getItem(this.key);}catch{this.protect('read');return;}
   if(actual!==this.expected){this.protect('conflict');return;}
   try{this.area.setItem(this.key,raw);this.expected=raw;this.failure=false;}
   catch{this.failure=true;}
   this.notify();
  });}catch{task=Promise.reject(Error('Save coordination unavailable'));}
  Promise.resolve(task).catch(()=>{if(epoch===this.epoch)this.protect('locks');})
   .finally(()=>{this.flight=false;this.notify();this.pump();});
 }
}
