/* Adapted from the ship-static-browser-games local-save starting point. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EchoStorage=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='indie.echo-trail.v1', MAX=65536;
  const defaults=()=>({schemaVersion:1,gameId:'echo-trail',currentLevel:0,unlockedLevel:0,completed:[],settings:{reducedMotion:false,highContrast:false}});
  const clone=v=>JSON.parse(JSON.stringify(v));
  function validate(v){
    if(!v||typeof v!=='object'||Array.isArray(v)||v.schemaVersion!==1||v.gameId!=='echo-trail')return false;
    if(!Number.isInteger(v.currentLevel)||!Number.isInteger(v.unlockedLevel)||v.currentLevel<0||v.currentLevel>v.unlockedLevel||v.unlockedLevel<0||v.unlockedLevel>4)return false;
    if(!Array.isArray(v.completed)||v.completed.length>5||v.completed.some((x,i)=>x!==i)||v.unlockedLevel!==Math.min(v.completed.length,4))return false;
    return !!v.settings&&typeof v.settings==='object'&&typeof v.settings.reducedMotion==='boolean'&&typeof v.settings.highContrast==='boolean';
  }
  function clean(v){if(!validate(v))throw new Error('Invalid save');return {schemaVersion:1,gameId:'echo-trail',currentLevel:v.currentLevel,unlockedLevel:v.unlockedLevel,completed:[...v.completed],settings:{reducedMotion:v.settings.reducedMotion,highContrast:v.settings.highContrast}};}
  function decode(raw){if(typeof raw!=='string'||raw.length>MAX)throw new Error('Invalid size');return clean(JSON.parse(raw));}
  function create(storage=()=>globalThis.localStorage){
    let data=defaults(),blocked=false,blockedReason='preserved',preserved=null,status='empty';
    const result=(s,persisted=false)=>{status=s;return {status,persisted,data:clone(data),hasPreserved:preserved!==null};};
    function write(v){let next,raw;try{next=clean(v);raw=JSON.stringify(next);}catch{return result('invalid');}
      data=next;if(blocked)return result(blockedReason);try{storage().setItem(KEY,raw);return result('saved',true);}catch{return result('memory-only');}}
    return {
      load(){let raw;try{raw=storage().getItem(KEY);}catch{blocked=true;blockedReason='unavailable';return result('unavailable');}
        if(raw===null){blocked=false;preserved=null;return result('empty');}
        try{data=decode(raw);blocked=false;preserved=null;return result('loaded',true);}catch{blocked=true;blockedReason='preserved';preserved=raw;return result('preserved');}},
      save:write,
      inspect:raw=>decode(raw),
      export:()=>JSON.stringify(data,null,2),
      exportOriginal:()=>preserved,
      get:()=>({status,data:clone(data),hasPreserved:preserved!==null}),
      import(raw,{confirmed=false}={}){if(!confirmed)return result('confirmation-required');let next;try{next=decode(raw);}catch{return result('invalid-import');}blocked=false;return write(next);},
      reset({confirmed=false}={}){if(!confirmed)return result('confirmation-required');try{storage().removeItem(KEY);}catch{return result('reset-failed');}data=defaults();blocked=false;preserved=null;return result('reset',true);},
      externalChange(raw){blocked=true;blockedReason='external-change';preserved=typeof raw==='string'?raw:preserved;return result('external-change');}
    };
  }
  return {KEY,MAX,defaults,validate,decode,create};
});
