/* Original game rules. No browser dependency. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BatikCore=api;})(typeof globalThis==='object'?globalThis:this,function(){
'use strict';
const VERSION='0.1.5',SEED=31018,LIMIT=55;
const LEVELS=[
 {name:'初印',motif:0,color:'#285d69',targets:[{u:.50,v:.47}],reserve:null},
 {name:'错落',motif:0,color:'#374967',targets:[{u:.30,v:.30},{u:.70,v:.37},{u:.47,v:.73}],reserve:{u:.68,v:.75,r:.115}},
 {name:'留白',motif:0,color:'#9c513e',targets:[{u:.28,v:.28},{u:.72,v:.28},{u:.28,v:.72},{u:.72,v:.72}],reserve:{u:.5,v:.5,r:.14}}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function initial(){return{version:1,seed:SEED,phase:'ready',stage:0,time:LIMIT,stamps:[],scores:[],result:null,reveal:0,aim:{u:.5,v:.47},pulse:0,notice:null};}
function start(){const s=initial();s.phase='playing';return s;}
function aim(s,u,v){if(Number.isFinite(u)&&Number.isFinite(v))s.aim={u:clamp(u,.1,.9),v:clamp(v,.1,.9)};return s;}
function stamp(s){if(s.phase!=='playing'||s.stamps.length>=12)return false;const p={...s.aim};const l=LEVELS[s.stage];let near=null,dist=.038;for(const t of l.targets){const d=Math.hypot(t.u-p.u,t.v-p.v);if(d<dist){dist=d;near=t;}}if(near){p.u=near.u;p.v=near.v;}s.stamps.push(p);s.pulse=1;s.notice=null;return true;}
function evaluate(stage,stamps){const l=LEVELS[stage],used=new Set();let quality=0,complete=true;const distances=[];for(const t of l.targets){let best=-1,d=Infinity;stamps.forEach((p,i)=>{if(used.has(i))return;const x=Math.hypot(p.u-t.u,p.v-t.v);if(x<d){d=x;best=i;}});if(best>=0)used.add(best);distances.push(Number.isFinite(d)?d:1);quality+=Math.max(0,1-d/.14);if(d>.085)complete=false;}
 const extra=Math.max(0,stamps.length-l.targets.length);let protectedHit=false;if(l.reserve)protectedHit=stamps.some(p=>Math.hypot(p.u-l.reserve.u,p.v-l.reserve.v)<l.reserve.r+.095);const score=Math.round(clamp(100*quality/l.targets.length-extra*18-(protectedHit?35:0),0,100));return{score,pass:complete&&score>=76&&!protectedHit,protectedHit,missing:distances.filter(d=>d>.085).length,extra,distances};}
function dye(s){if(s.phase!=='playing')return false;if(!s.stamps.length){s.notice='stamp';return false;}s.result=evaluate(s.stage,s.stamps);s.phase='reveal';s.reveal=0;s.pulse=0;return true;}
function undo(s){if(!['playing','reveal'].includes(s.phase)||!s.stamps.length)return false;s.stamps.pop();s.phase='playing';s.result=null;s.reveal=0;s.notice=null;return true;}
function retry(s){if(!['playing','reveal'].includes(s.phase))return false;s.stamps=[];s.result=null;s.reveal=0;s.phase='playing';s.notice=null;return true;}
function next(s){if(s.phase!=='reveal'||!s.result?.pass||s.reveal<1)return false;s.scores.push(s.result.score);if(s.stage===2){s.phase='won';return true;}s.stage++;s.stamps=[];s.result=null;s.reveal=0;s.phase='playing';s.aim={...LEVELS[s.stage].targets[0]};return true;}
function tick(s,dt){dt=clamp(Number.isFinite(dt)?dt:0,0,.1);s.pulse=Math.max(0,s.pulse-dt*5);if(!['playing','reveal'].includes(s.phase))return;if(!(s.phase==='reveal'&&s.result?.pass))s.time=Math.max(0,s.time-dt);if(s.phase==='reveal')s.reveal=Math.min(1,s.reveal+dt/1.05);if(s.time<=0){s.phase='lost';s.result=null;} }
function total(s){return s.scores.length?Math.round(s.scores.reduce((a,b)=>a+b,0)/s.scores.length):0;}
function snapshot(s){return{stage:s.stage,time:s.time,stamps:s.stamps.map(p=>({...p})),scores:[...s.scores],aim:{...s.aim}};}
function validRun(r){return !!r&&Number.isInteger(r.stage)&&r.stage>=0&&r.stage<3&&Number.isFinite(r.time)&&r.time>0&&r.time<=LIMIT&&Array.isArray(r.stamps)&&r.stamps.length<=12&&r.stamps.every(validPoint)&&Array.isArray(r.scores)&&r.scores.length===r.stage&&r.scores.every(x=>Number.isInteger(x)&&x>=0&&x<=100)&&validPoint(r.aim);}
function validPoint(p){return p&&Number.isFinite(p.u)&&Number.isFinite(p.v)&&p.u>=.1&&p.u<=.9&&p.v>=.1&&p.v<=.9;}
function resume(r){if(!validRun(r))return null;return{...start(),...JSON.parse(JSON.stringify(r))};}
return{VERSION,SEED,LIMIT,LEVELS,clamp,initial,start,aim,stamp,evaluate,dye,undo,retry,next,tick,total,snapshot,validRun,resume};
});
