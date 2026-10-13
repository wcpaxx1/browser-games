(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.DirectSave=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const KEY='indie.tidal-ferry-first-person.progress',VERSION=1,MAX=16384;
const defaults=()=>({game:'tidal-ferry-first-person',round:0,wins:0,reducedMotion:false});
const valid=d=>!!d&&d.game==='tidal-ferry-first-person'&&Number.isInteger(d.round)&&d.round>=0&&d.round<=2&&Number.isInteger(d.wins)&&d.wins>=0&&d.wins<=999999&&typeof d.reducedMotion==='boolean';
const clean=d=>({game:'tidal-ferry-first-person',round:d.round,wins:d.wins,reducedMotion:d.reducedMotion});
function encode(d){if(!valid(d))throw Error('invalid');return JSON.stringify({version:VERSION,data:clean(d)},null,2);}
function decode(raw){if(typeof raw!=='string'||raw.length>MAX)throw Error('size');const p=JSON.parse(raw);if(p?.version!==VERSION||!valid(p.data))throw Error('invalid');return clean(p.data);}
function create(storage=()=>globalThis.localStorage){let data=defaults(),blocked=false,original=null,reason='preserved';const result=(status,persisted=false)=>({data:clean(data),status,persisted});function save(d){if(!valid(d))return result('invalid');data=clean(d);if(blocked)return result(reason);try{storage().setItem(KEY,encode(data));return result('saved',true);}catch{return result('memory');}}
 return {load(){try{const raw=storage().getItem(KEY);if(raw===null){blocked=false;original=null;return result('empty');}try{data=decode(raw);blocked=false;original=null;return result('loaded',true);}catch{blocked=true;reason='preserved';original=raw;return result('preserved');}}catch{return result('memory');}},save,export:()=>encode(data),original:()=>original,import(raw,confirmed=false){let d;try{d=decode(raw);}catch{return result('invalid');}if(!confirmed)return result('confirm');blocked=false;return save(d);},reset(confirmed=false){if(!confirmed)return result('confirm');try{storage().removeItem(KEY);blocked=false;original=null;data=defaults();return result('reset',true);}catch{return result('failed');}},conflict(){blocked=true;reason='conflict';try{original=storage().getItem(KEY);}catch{}return result('conflict');}};
}
return {KEY,VERSION,MAX,defaults,valid,encode,decode,create};
});
