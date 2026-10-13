/* Cockpit schema and namespace are separate from both archived RTS save versions. */
(function(root){'use strict';const NS='tempest-commons:cockpit:v2:';
function hash(v){let n=2166136261;for(let i=0;i<v.length;i++)n=Math.imul(n^v.charCodeAt(i),16777619);return(n>>>0).toString(16)}
function encode(g){const payload=JSON.stringify(root.Cockpit.validate(g));return JSON.stringify({format:'cockpit-2',checksum:hash(payload),payload})}
function decode(raw){if(typeof raw!=='string'||raw.length>2000000)throw Error('存档为空或过大');const e=JSON.parse(raw);if(e.format!=='cockpit-2'||typeof e.payload!=='string'||hash(e.payload)!==e.checksum)throw Error('存档格式或校验错误，原文件保留');return root.Cockpit.validate(JSON.parse(e.payload))}
class Save{constructor(storage,id){this.storage=storage;this.key=NS+id;this.memory=null;this.error=false;}write(g){const raw=encode(g);this.memory=raw;try{this.storage.setItem(this.key,raw);this.error=false;return true}catch(e){this.error=true;return false}}
 list(){const all=[];try{for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key?.startsWith(NS))try{const g=decode(this.storage.getItem(key));all.push({key,tick:g.sim.tick,status:g.sim.status})}catch(e){all.push({key,error:true})}}}catch(e){this.error=true}if(this.memory&&!all.some(x=>x.key===this.key)){const g=decode(this.memory);all.push({key:this.key,tick:g.sim.tick,status:g.sim.status,memory:true})}return all.sort((a,b)=>b.key.localeCompare(a.key))}
 load(key){if(!key?.startsWith(NS))throw Error('不是本游戏存档');return decode(key===this.key&&this.memory?this.memory:this.storage.getItem(key))}}
root.CockpitSave={NS,Save,encode,decode,hash};})(globalThis);
