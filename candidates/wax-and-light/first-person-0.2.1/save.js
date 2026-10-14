(function(root,factory){const api=factory(typeof module==='object'?require('./core.js'):root.BatikCore);if(typeof module==='object'&&module.exports)module.exports=api;else root.BatikSave=api;})(globalThis,function(C){
'use strict';const KEY='worldcraft.batik-stamping.v1';
function valid(d){return d&&d.version===1&&Number.isInteger(d.best)&&d.best>=0&&d.best<=100&&Number.isInteger(d.completed)&&d.completed>=0&&d.completed<=1000000&&(d.run===null||C.validRun(d.run));}
function fresh(){return{version:1,best:0,completed:0,run:null};}
function create(storage){let data=fresh(),blocked=false,reason='',raw=null;try{raw=storage.getItem(KEY);if(raw!==null){const parsed=JSON.parse(raw);if(!valid(parsed))throw Error('invalid');data=parsed;}}catch(e){blocked=true;reason=raw===null?'unavailable':'corrupt';}
 function write(){if(blocked)return false;try{storage.setItem(KEY,JSON.stringify(data));reason='';return true;}catch(e){blocked=true;reason='unavailable';return false;}}
 return{get data(){return data;},get blocked(){return blocked;},get reason(){return reason;},get raw(){return raw;},save(run,best=null){data.run=run;if(best!==null){data.best=Math.max(data.best,best);data.completed=Math.min(1000000,data.completed+1);}return write();},replace(){data=fresh();blocked=false;raw=null;return write();},external(value){raw=value;blocked=true;reason='external';},export(){return reason==='corrupt'&&raw!==null?raw:JSON.stringify(data,null,2);}};
}
return{KEY,valid,fresh,create};});
