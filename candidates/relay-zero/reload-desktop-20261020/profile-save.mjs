import {createLocalSave} from './local-save.mjs';
// Profile-only serialized persistence. The generic preference stores stay unchanged.
// Web Locks coordinate participating builds on this origin, not legacy/external writers.
export function createProfileSave({key,version=1,defaults,validate,storage=()=>globalThis.localStorage,
  locks=()=>globalThis.navigator?.locks,randomUUID=()=>globalThis.crypto.randomUUID(),maxChars=65536}) {
  const clone=value=>JSON.parse(JSON.stringify(value));
  let codecRaw=null;
  const codec=createLocalSave({key,version,defaults,validate,maxChars,
    storage:()=>({getItem:()=>codecRaw,setItem(){},removeItem(){}})});
  let data=clone(defaults),expected=null,observed=false,blocked=false,conflicted=false,
    disabled='',generation=0,serial=0,writer='',manager=null,busy=false,replacing=false;
  const queue=[];
  const result=(status,persisted=false)=>({status,persisted,data:clone(data)});
  try { manager=locks(); if(typeof manager?.request!=='function')disabled='coordination-unavailable';
    else {writer=randomUUID();if(typeof writer!=='string'||writer.length<16)throw Error();}
  } catch {disabled='coordination-unavailable';}
  function parse(raw){codecRaw=raw;const r=codec.load();if(r.status!=='loaded')throw Error('Invalid import');return r.data;}
  function keep(value){try{codec.export(value);data=clone(value);return true;}catch{return false;}}
  function conflict(){conflicted=true;generation++;replacing=false;return result('conflict');}
  function freshness(){
    if(!observed)return result(disabled||'unavailable');
    try{if(storage().getItem(key)!==expected)return conflict();}
    catch{disabled='unavailable';generation++;replacing=false;return result('unavailable');}
    return null;
  }
  function finish(entry,r){entry.resolve(r);entry.done?.(r);}
  function commit(entry){
    if(entry.generation!==generation)return result('cancelled');
    if(conflicted)return result('conflict');
    if(disabled)return result(disabled);
    const stale=freshness();if(stale)return stale;
    if(entry.kind!=='save'&&entry.expected!==expected)return conflict();
    if(blocked&&entry.kind==='save')return result('replacement-confirmation-required');
    let raw;
    try{const envelope=JSON.parse(codec.export(entry.value));envelope.saveRevision=writer+':'+(++serial);
      raw=JSON.stringify(envelope);if(raw.length>maxChars)throw Error();}
    catch{return result('invalid');}
    try{storage().setItem(key,raw);}catch{disabled='memory-only';replacing=false;return result('memory-only');}
    expected=raw;blocked=false;replacing=false;
    // A queued older snapshot may be saved, but must never roll live page memory back.
    if(entry.kind!=='save')data=clone(entry.value);
    return result(entry.kind==='reset'?'reset':'saved',true);
  }
  function pump(){
    if(busy||!queue.length)return;
    const entry=queue.shift();busy=true;let entered=false;
    const fail=()=>{if(entered)return;entered=true;disabled='coordination-unavailable';replacing=false;
      try{finish(entry,result(disabled));}finally{busy=false;pump();}};
    if(disabled){try{finish(entry,result(disabled));}finally{busy=false;pump();}return;}
    try{Promise.resolve(manager.request(key+':mutations-v1',{mode:'exclusive'},()=>{
      entered=true;let r;try{r=commit(entry);}catch{disabled='memory-only';replacing=false;r=result('memory-only');}
      try{finish(entry,r);}finally{busy=false;pump();}
    })).catch(fail);}catch{fail();}
  }
  function enqueue(kind,value,expectedAtConfirmation,done){
    let resolve;const completion=new Promise(r=>resolve=r);
    queue.push({kind,value:clone(value),expected:expectedAtConfirmation,generation,resolve,done});pump();return completion;
  }
  function immediate(r,done){done?.(r);return Promise.resolve(r);}
  function replace(kind,value,{confirmed=false,token}={},done){
    if(!confirmed)return immediate(result(kind==='reset'?'reset-confirmation-required':'replacement-confirmation-required'),done);
    if(!token||token.generation!==generation||token.raw!==expected||conflicted)return immediate(result('cancelled'),done);
    const stale=freshness();if(stale)return immediate(stale,done);
    if(!keep(value))return immediate(result('invalid-import'),done);
    generation++;replacing=true;
    if(disabled){replacing=false;return immediate(result(disabled),done);}
    return enqueue(kind,value,token.raw,done);
  }
  return {
    load(){
      let raw;try{raw=storage().getItem(key);}catch{disabled='unavailable';return result('unavailable');}
      expected=raw;observed=true;codecRaw=raw;const r=codec.load();data=r.data;blocked=r.status==='unreadable-preserved';
      return result(blocked?r.status:disabled||r.status,r.persisted);
    },
    save(value,done){
      // A late pagehide snapshot must not replace the pending reset/import copy.
      if(replacing)return immediate(result('cancelled'),done);
      if(!keep(value))return immediate(result('invalid'),done);
      if(conflicted)return immediate(result('conflict'),done);
      if(blocked)return immediate(result('replacement-confirmation-required'),done);
      if(disabled)return immediate(result(disabled),done);
      return enqueue('save',value,null,done);
    },
    export(value=data){return codec.export(value);},
    // Capturing a confirmation cancels old queued snapshots and binds exact stored bytes.
    capture(){generation++;replacing=false;const stale=freshness();
      return stale||conflicted?null:Object.freeze({generation,raw:expected});},
    import(raw,options,done){let next;try{next=parse(raw);}catch{return immediate(result('invalid-import'),done);}
      return replace('import',next,options,done);},
    reset(options,done){return replace('reset',defaults,options,done);},
    invalidate(){return conflict();},
    cancelReplacement(){if(replacing){generation++;replacing=false;}},
    inspect(){return {conflicted,blocked,disabled,generation,replacing,pending:queue.length+Number(busy)};}
  };
}
