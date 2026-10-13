/* Isolated, versioned per-page slots. A loaded slot is never overwritten. */
(function(root){
'use strict';
const NS='tempest-commons:v1:slot:';
function checksum(str){let h=2166136261;for(let i=0;i<str.length;i++)h=Math.imul(h^str.charCodeAt(i),16777619);return (h>>>0).toString(16)}
function encode(state){const payload=JSON.stringify(root.Tempest.validate(state));return JSON.stringify({format:1,checksum:checksum(payload),payload})}
function decode(raw){
 if(typeof raw!=='string'||raw.length>2000000)throw Error('存档缺失或超出大小限制');
 const env=JSON.parse(raw);
 if(env.format===0&&env.game){return {state:root.Tempest.validate(env.game),migrated:true}}
 if(env.format!==1)throw Error('存档版本不支持，原数据已保留');
 if(typeof env.payload!=='string'||checksum(env.payload)!==env.checksum)throw Error('存档校验失败，原数据已保留');
 return {state:root.Tempest.validate(JSON.parse(env.payload)),migrated:false};
}
class Vault{
 constructor(storage,id){this.storage=storage;this.key=NS+id;this.memory=null;this.error='';}
 save(state){
  const raw=encode(state);this.memory=raw;
  try{this.storage.setItem(this.key,raw);this.error='';return {ok:true,persistent:true}}
  catch(e){this.error='浏览器存储不可用；本页内存仍可保存，请导出备份。';return {ok:true,persistent:false}}
 }
 list(){
  const items=[];
  try{
   for(let i=0;i<this.storage.length;i++){
    const key=this.storage.key(i);if(!key||!key.startsWith(NS))continue;
    try{const d=decode(this.storage.getItem(key));items.push({key,tick:d.state.tick,seed:d.state.seed,status:d.state.status,migrated:d.migrated})}
    catch(e){items.push({key,error:'损坏或不支持'})}
   }
  }catch(e){this.error='浏览器存储不可用；仅本页内存可用。'}
  if(this.memory){const index=items.findIndex(x=>x.key===this.key),d=decode(this.memory),item={key:this.key,tick:d.state.tick,seed:d.state.seed,status:d.state.status,memory:!!this.error||index<0};if(index<0)items.push(item);else items[index]=item}
  return items.sort((a,b)=>b.key.localeCompare(a.key));
 }
 load(key){
  if(!key.startsWith(NS))throw Error('存档命名空间不匹配');
  let raw;if(key===this.key&&this.memory)raw=this.memory;else raw=this.storage.getItem(key);
  return decode(raw);
 }
 raw(){return this.memory}
 clearOwn(){try{this.storage.removeItem(this.key)}catch(e){this.error='本地存储不可用'}this.memory=null}
}
root.TempestStorage={NS,Vault,checksum,encode,decode};
})(globalThis);


