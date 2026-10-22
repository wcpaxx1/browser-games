export const ACTIVE_KEY='tk-xiangqi.m1.active';
export const GAME_PREFIX='tk-xiangqi.m1.game.';
export const SETTINGS_KEY='tk-xiangqi.m1.settings.v1';
const SCHEMA='tk-xiangqi-local/1';
export function newSlot(){return GAME_PREFIX+Date.now().toString(36)+'-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));}
export function envelope(engineSave){return JSON.stringify({schema:SCHEMA,savedAt:new Date().toISOString(),engineSave});}
export function decode(raw,restore){
 if(typeof raw!=='string'||raw.length>24000000)throw new Error('存档为空或超过24MB安全读取上限。原文件未被改动。');
 const x=JSON.parse(raw);
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join(',')!=='engineSave,savedAt,schema'||x.schema!==SCHEMA||typeof x.engineSave!=='string'||typeof x.savedAt!=='string'||!Number.isFinite(Date.parse(x.savedAt)))throw new Error('不是受支持的三国象棋M1存档。原文件未被改动。');
 return restore(x.engineSave);
}
export class MatchStore {
 constructor(restore){this.restore=restore;this.slot=null;this.lastRaw=null;this.blocked=false;this.rawProblem=null;this.problemKey=null;this.error=null;}
 load(){
  try{
   const key=localStorage.getItem(ACTIVE_KEY);
   if(!key)return null;
   if(!key.startsWith(GAME_PREFIX)||key.length>150){this.rawProblem=key;this.problemKey=ACTIVE_KEY;throw new Error('当前对局索引不受支持。');}
   this.slot=key;this.problemKey=key;const raw=localStorage.getItem(key);this.lastRaw=raw;this.rawProblem=raw;
   if(!raw)throw new Error('当前对局存档缺失。');
   const state=decode(raw,this.restore);this.rawProblem=null;this.problemKey=null;return state;
  }catch(e){this.blocked=true;this.error=e;return null;}
 }
 independent(){this.slot=newSlot();this.lastRaw=null;this.blocked=false;this.error=null;}
 save(engineSave){
  if(this.blocked)return {ok:false,reason:'存档受保护；请导出当前局，或另存独立局。'};
  if(!this.slot)this.independent();
  try{
   const existing=localStorage.getItem(this.slot);
   if(existing!==this.lastRaw){this.blocked=true;this.rawProblem=existing;this.problemKey=this.slot;return {ok:false,reason:'另一页面改变或清除了存档；已停止覆盖。'};}
   const raw=envelope(engineSave);localStorage.setItem(this.slot,raw);this.lastRaw=raw;localStorage.setItem(ACTIVE_KEY,this.slot);this.error=null;return {ok:true};
  }catch(e){this.error=e;return {ok:false,reason:'浏览器未能保存（空间不足或存储受限）。当前局仍在内存，请导出。'};}
 }
 noticeExternal(event){
  if(event.key===null||event.key===ACTIVE_KEY||event.key===this.slot){this.blocked=true;this.rawProblem=event.newValue;this.problemKey=event.key;return true;}return false;
 }
}
export function loadSettings(){try{const raw=localStorage.getItem(SETTINGS_KEY);if(!raw)return {settings:{schema:1,showCoordinates:false},writable:true};const x=JSON.parse(raw);if(x?.schema!==1||typeof x.showCoordinates!=='boolean'||Object.keys(x).sort().join(',')!=='schema,showCoordinates')throw new Error();return {settings:x,writable:true};}catch{return {settings:{schema:1,showCoordinates:false},writable:false};}}
export function saveSettings(settings){try{localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));return true;}catch{return false;}}
