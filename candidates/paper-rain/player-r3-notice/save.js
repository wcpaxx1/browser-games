/* Adapted from the installed studio local-save contract; explicit game schema. */
(function(root){'use strict';
const Core=typeof module==='object'&&module.exports?require('./core.js'):root.PaperCore;
const KEY='studio.woodblock-parry.progress',VERSION=1,MAX=16384;
const defaults=()=>({best:0,rounds:0,seed:120713,muted:false,checkpoint:null});
function sanitize(d){if(!d||!Core.integer(d.best,0,100)||!Core.integer(d.rounds,0,1000000)||!Core.integer(d.seed,0,4294967295)||typeof d.muted!=='boolean'||!(d.checkpoint===null||Core.validRun(d.checkpoint)))throw Error('Invalid fields');const checkpoint=d.checkpoint?Core.snapshot(Core.restore(d.checkpoint)):null;if(checkpoint&&d.checkpoint.physicsVersion===undefined)delete checkpoint.physicsVersion;return {best:d.best,rounds:d.rounds,seed:d.seed,muted:d.muted,checkpoint};}
function decode(raw){if(typeof raw!=='string'||raw.length>MAX)throw Error('Invalid size');const p=JSON.parse(raw);if(!p||p.version!==VERSION)throw Error('Unsupported version');return sanitize(p.data);}
function encode(d){const s=JSON.stringify({version:VERSION,data:sanitize(d)});if(s.length>MAX)throw Error('Too large');return s;}
function create(storage=()=>globalThis.localStorage){let data=defaults(),baseline=null,blocked=false,status='empty';const out=(persisted=false)=>({status,persisted,data:JSON.parse(JSON.stringify(data))});return {
 load(){try{baseline=storage().getItem(KEY);}catch{status='unavailable';return out();}if(baseline===null){blocked=false;data=defaults();status='empty';return out();}try{data=decode(baseline);blocked=false;status='loaded';return out(true);}catch{blocked=true;status='unreadable-preserved';return out();}},
 save(next){try{data=sanitize(next);}catch{status='invalid';return out();}if(blocked){status=status==='external-change'?'external-change':'unreadable-preserved';return out();}try{const current=storage().getItem(KEY);if(current!==baseline){blocked=true;status='external-change';return out();}const raw=encode(data);storage().setItem(KEY,raw);baseline=raw;status='saved';return out(true);}catch{status='memory-only';return out();}},
 external(){blocked=true;status='external-change';return out();},
 export(next=data){return encode(next);},
 import(raw,confirmed=false){if(!confirmed){status='confirmation-required';return out();}let next;try{next=decode(raw);}catch{status='invalid-import';return out();}try{storage().setItem(KEY,encode(next));baseline=encode(next);blocked=false;data=next;status='imported';return out(true);}catch{data=next;status='memory-only';return out();}},
 reset(confirmed=false){if(!confirmed){status='confirmation-required';return out();}try{storage().removeItem(KEY);baseline=null;blocked=false;data=defaults();status='reset';return out(true);}catch{status='reset-failed';return out();}},
 state:()=>out()
};}
class Operations{constructor(){this.generation=0;this.pending=null;}invalidate(){this.generation++;this.pending=null;}async select(read){const id=++this.generation;this.pending=null;try{const raw=await read();if(id!==this.generation)return {stale:true};const data=decode(raw);this.pending={raw,data};return {ok:true,data};}catch(e){if(id!==this.generation)return {stale:true};this.pending=null;return {ok:false};}}}
const api={KEY,VERSION,MAX,defaults,sanitize,decode,encode,create,Operations};if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperSave=api;
})(typeof globalThis!=='undefined'?globalThis:this);
