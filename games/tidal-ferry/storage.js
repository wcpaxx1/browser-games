/* Adapted from the user's ship-static-browser-games local-save template. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.TideSave=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const KEY='indie.tidal-ferry.progress',VERSION=1,MAX=65536;
const defaults=()=>({game:'tidal-ferry',currentLevel:0,unlockedLevel:0,completed:[],best:[null,null,null,null,null,null],settings:{reducedMotion:false,highContrast:false}});
const int=(n,a,b)=>Number.isInteger(n)&&n>=a&&n<=b;
function validate(d){return !!d&&typeof d==='object'&&d.game==='tidal-ferry'&&int(d.currentLevel,0,5)&&int(d.unlockedLevel,0,5)&&d.currentLevel<=d.unlockedLevel&&Array.isArray(d.completed)&&d.completed.length<=6&&d.unlockedLevel===Math.min(5,d.completed.length)&&new Set(d.completed).size===d.completed.length&&d.completed.every(i=>int(i,0,5)&&i<=d.unlockedLevel)&&Array.isArray(d.best)&&d.best.length===6&&d.best.every((x,i)=>(x===null&&!d.completed.includes(i))||(int(x,1,[1,2,4,4,6,7][i])&&d.completed.includes(i)))&&!!d.settings&&typeof d.settings.reducedMotion==='boolean'&&typeof d.settings.highContrast==='boolean'&&Array.from({length:d.unlockedLevel},(_,i)=>i).every(i=>d.completed.includes(i));}
function clean(d){return {game:'tidal-ferry',currentLevel:d.currentLevel,unlockedLevel:d.unlockedLevel,completed:[...d.completed].sort(),best:[...d.best],settings:{reducedMotion:d.settings.reducedMotion,highContrast:d.settings.highContrast}};}
function encode(d){if(!validate(d))throw Error('invalid');return JSON.stringify({version:VERSION,data:clean(d)},null,2);}
function decode(raw){if(typeof raw!=='string'||raw.length>MAX)throw Error('size');const o=JSON.parse(raw);if(!o||o.version!==VERSION||!validate(o.data))throw Error('invalid');return clean(o.data);}
function create(storage=()=>globalThis.localStorage){
 let data=defaults(),blocked=false,blockedStatus='preserved',rawBackup=null;
 const result=(status,persisted=false)=>({status,persisted,data:clean(data)});
 function write(d){try{encode(d);}catch{return result('invalid');}data=clean(d);if(blocked)return result(blockedStatus);try{storage().setItem(KEY,encode(data));return result('saved',true);}catch{return result('memory');}}
 return {load(){try{const raw=storage().getItem(KEY);if(raw===null){blocked=false;rawBackup=null;return result('empty');}try{data=decode(raw);blocked=false;rawBackup=null;return result('loaded',true);}catch{blocked=true;blockedStatus='preserved';rawBackup=raw;return result('preserved');}}catch{return result('unavailable');}},save:write,
 export(){return encode(data);},exportOriginal(){return rawBackup;},
 import(raw,confirmed=false){let d;try{d=decode(raw);}catch{return result('invalid-import');}if(!confirmed)return result('confirm');blocked=false;return write(d);},
 reset(confirmed=false){if(!confirmed)return result('confirm');try{storage().removeItem(KEY);data=defaults();blocked=false;rawBackup=null;return result('reset',true);}catch{return result('reset-failed');}},
 conflict(){blocked=true;blockedStatus='conflict';try{rawBackup=storage().getItem(KEY);}catch{}return result('conflict');}
 };
}
return {KEY,VERSION,MAX,defaults,validate,encode,decode,create};
});
