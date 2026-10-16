/* Pelican Post — local-only save ownership and recovery. MIT licensed. */
(function(root){
  'use strict';
  class SaveGuard {
    constructor({key,storage,locks,onChange=()=>{},onConflict=()=>{},localSnapshot=()=>null}) {
      this.key=key;this.storage=storage;this.locks=locks;this.onChange=onChange;this.onConflict=onConflict;this.localSnapshot=localSnapshot;
      this.epoch=0;this.storageIdentity=null;this.expected=null;this.expectedReadable=false;this.initial=null;this.initialReadable=false;this.unreadableObserved=false;this.protection=null;this.capability=null;this.failure=false;this.suspended=false;this.pending=null;this.flight=false;this.replacementEpoch=null;this.recovery=[];this.conflictCaptured=false;this.eventCaptured=false;this.replacementCaptured=false;
      try {const area=this.storage();this.storageIdentity=area;this.initial=area.getItem(this.key);this.expected=this.initial;this.expectedReadable=true;this.initialReadable=true;this.capture('startup','启动时原始存档',this.initial);} catch {this.capability='storage-unavailable';this.unreadableObserved=true;}
      try {if(!this.locks()||typeof this.locks().request!=='function')this.capability='locks-unavailable';} catch {this.capability='locks-unavailable';}
    }
    capture(id,label,raw) {if(!this.recovery.some(x=>x.id===id))this.recovery.push({id,label,raw:raw===null?null:String(raw)});}
    snapshot() {try{return this.localSnapshot();}catch{return null;}}
    changed() {this.onChange(this);}
    get status(){return this.protection==='conflict'?'conflict':this.capability||this.protection||(this.failure?'write-failed':this.pending||this.flight||this.replacementEpoch===this.epoch?'pending':'ready');}
    get blocked(){return !!(this.protection||this.capability);}
    protectInvalid(){this.protection='invalid';this.changed();}
    invalidate(){this.epoch++;this.pending=null;this.replacementEpoch=null;}
    suspend(){this.invalidate();this.suspended=true;}
    resume(){this.invalidate();this.suspended=false;}
    inspect(){try{return {readable:true,raw:this.storage().getItem(this.key)};}catch{return {readable:false,raw:null};}}
    conflict(kind,raw,event=null,readable=true){
      if(!this.conflictCaptured){
        this.conflictCaptured=true;this.capture('local','首次冲突前本页旅程',this.snapshot());
        if(this.expectedReadable)this.capture('acknowledged','首次冲突时本页已确认的原文',this.expected);
        if(readable)this.capture('external','首次检测时存储中的原始数据',raw);
      }
      if(event&&!this.eventCaptured){
        this.eventCaptured=true;
        if(event.key!==null)this.capture('event-before','首次外部事件之前的原始存档',event.oldValue);
        this.capture('event-after',event.key===null?'首次外部事件：存储被清空（未提供清空前原文）':'首次外部事件之后的原始存档',event.newValue);
      }
      if(!readable)this.unreadableObserved=true;
      this.invalidate();this.protection='conflict';this.failure=false;this.conflictKind=kind;this.changed();this.onConflict();
    }
    observe(event){
      if(event.key!==this.key&&event.key!==null)return false;
      if(!this.storageIdentity||event.storageArea!==this.storageIdentity)return false;
      const current=this.inspect();this.conflict(event.key===null?'clear':event.newValue===null?'removed':'changed',current.raw,event,current.readable);return true;
    }
    save(raw){
      if(this.blocked||this.suspended)return false;
      this.pending={raw,epoch:this.epoch};this.changed();this.pump();return true;
    }
    pump(){
      if(this.flight||!this.pending||this.blocked||this.suspended)return;
      const epoch=this.epoch;this.flight=true;let task;
      try {task=this.locks().request(this.key+':save-guard-v1',{mode:'exclusive'},()=>{
        if(epoch!==this.epoch||this.blocked||this.suspended||!this.pending)return;
        const next=this.pending;this.pending=null;
        if(next.epoch!==epoch)return;
        let actual;try {actual=this.storage().getItem(this.key);}catch {this.capability='storage-unavailable';this.unreadableObserved=true;this.changed();return;}
        if(actual!==this.expected){this.conflict('write-check',actual);return;}
        try {this.storage().setItem(this.key,next.raw);this.expected=next.raw;this.expectedReadable=true;this.failure=false;}catch {this.failure=true;}
        this.changed();
      });}catch {task=Promise.reject(Error('Lock request failed'));}
      Promise.resolve(task).catch(()=>{if(epoch===this.epoch){this.capability='locks-unavailable';this.pending=null;this.changed();}}).finally(()=>{this.flight=false;if(epoch===this.epoch)this.changed();this.pump();});
    }
    replace(raw,{epoch,expected,readable,valid,commit}){
      const owns=()=>epoch===this.epoch&&valid();
      if(!owns())return Promise.resolve('stale');
      if(!this.replacementCaptured){
        this.replacementCaptured=true;this.capture('before-replace','首次明确替换之前的本页旅程',this.snapshot());
        if(readable)this.capture('replace-raw','首次明确替换之前的原始存档',expected);
      }
      if(!readable)this.unreadableObserved=true;
      if(this.capability||!readable){
        if(!readable)this.capability='storage-unavailable';
        if(!owns())return Promise.resolve('stale');
        this.protection=null;this.suspended=false;this.failure=false;commit('memory');this.changed();return Promise.resolve('memory');
      }
      this.replacementEpoch=epoch;this.changed();
      let task;
      try {task=this.locks().request(this.key+':save-guard-v1',{mode:'exclusive'},()=>{
        if(!owns())return 'stale';
        let actual;try {actual=this.storage().getItem(this.key);}catch {this.capability='storage-unavailable';this.unreadableObserved=true;this.changed();return 'failed';}
        if(actual!==expected){this.conflict('replacement-check',actual);return 'conflict';}
        try {this.storage().setItem(this.key,raw);}catch {this.failure=true;this.protection='replacement-failed';this.changed();return 'failed';}
        this.expected=raw;this.expectedReadable=true;this.protection=null;this.failure=false;this.suspended=false;commit('saved');this.changed();return 'saved';
      });}catch {task=Promise.reject(Error('Lock request failed'));}
      return Promise.resolve(task).catch(()=>{if(owns()){this.capability='locks-unavailable';this.changed();}return 'failed';}).finally(()=>{if(this.replacementEpoch===epoch){this.replacementEpoch=null;this.changed();}});
    }
  }
  const api={SaveGuard};if(typeof module==='object'&&module.exports)module.exports=api;else root.PelicanSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
