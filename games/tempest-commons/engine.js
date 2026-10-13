/* Tempest Commons v0.1.0 — original deterministic simulation; no external dependencies. */
(function(root){
'use strict';
const W=40,H=26,HZ=20,VERSION=1;
const SPEC={
 hq:{name:'潮汐中枢',hp:1500,building:true,cost:0,range:4,damage:10,cd:22},
 solar:{name:'太阳能阵列',hp:340,building:true,cost:160},
 factory:{name:'无人机工坊',hp:750,building:true,cost:280},
 turret:{name:'电弧哨塔',hp:520,building:true,cost:220,range:6,damage:19,cd:18},
 hauler:{name:'无人采集车',hp:170,cost:140,speed:.075,capacity:96},
 scout:{name:'巡游蜂',hp:115,cost:90,speed:.105,range:4,damage:10,cd:15},
 ranger:{name:'棱镜履带车',hp:240,cost:180,speed:.060,range:5.4,damage:30,cd:30}
};
const clone=o=>JSON.parse(JSON.stringify(o));
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296}
function spawn(s,type,team,x,y){
 const p=SPEC[type],e={id:s.nextId++,type,team,x,y,hp:p.hp,cooldown:0,order:null,path:[],pathAge:0,cargo:0,work:0,queue:[]};
 s.entities.push(e);return e;
}
function create(seed=72134){
 seed=Number(seed)>>>0;
 const s={version:VERSION,seed,rng:seed,tick:0,nextId:1,status:'playing',paused:false,credits:[1050,750],entities:[],resources:[],terrain:[],explored:Array(W*H).fill(false),events:[],kills:[0,0],aiWave:0};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let rock=(x===19||x===20)&&y>2&&y<23&&!(y>=7&&y<=10)&&!(y>=17&&y<=20);
  s.terrain.push(rock?1:0);
 }
 for(const [x,y] of [[9,7],[8,18],[30,7],[31,18],[16,9],[24,18]]){
  for(let i=0;i<3;i++)s.resources.push({id:s.nextId++,x:x+(i%2)*1.2+random(s)*.3,y:y+Math.floor(i/2)*1.2+random(s)*.3,amount:1800+Math.floor(random(s)*400)});
 }
 spawn(s,'hq',0,4,13);spawn(s,'solar',0,4,9);spawn(s,'factory',0,7,13);
 spawn(s,'hauler',0,7,16);spawn(s,'scout',0,8,11);spawn(s,'scout',0,8,12);spawn(s,'scout',0,8,14);
 spawn(s,'hq',1,35,13);spawn(s,'solar',1,35,9);spawn(s,'factory',1,32,13);spawn(s,'turret',1,31,11);
 spawn(s,'hauler',1,32,16);spawn(s,'scout',1,30,13);spawn(s,'scout',1,30,14);
 for(const e of s.entities.filter(e=>e.type==='hauler'))autoHarvest(s,e);
 reveal(s);return s;
}
function inside(x,y){return x>=0&&y>=0&&x<W&&y<H}
function blocked(s,x,y,ignore=0){
 if(!inside(x,y)||s.terrain[y*W+x])return true;
 return s.entities.some(e=>e.id!==ignore&&e.hp>0&&SPEC[e.type].building&&Math.abs((x+.5)-e.x)<1&&Math.abs((y+.5)-e.y)<1);
}
function pathfind(s,sx,sy,gx,gy,range=0){
 const start={x:Math.max(0,Math.min(W-1,Math.floor(sx))),y:Math.max(0,Math.min(H-1,Math.floor(sy)))};
 if(!Number.isFinite(gx)||!Number.isFinite(gy))return [];
 gx=Math.max(.5,Math.min(W-.5,gx));gy=Math.max(.5,Math.min(H-.5,gy));
 const prev=new Int32Array(W*H).fill(-2),q=[start.y*W+start.x];prev[q[0]]=-1;
 let found=-1;
 for(let head=0;head<q.length;head++){
  const n=q[head],x=n%W,y=Math.floor(n/W);
  if((range>0&&Math.hypot(x+.5-gx,y+.5-gy)<=range)||(range===0&&x===Math.floor(gx)&&y===Math.floor(gy))){found=n;break}
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1]]){
   const nx=x+dx,ny=y+dy,ni=ny*W+nx;
   if(!inside(nx,ny)||prev[ni]!==-2||blocked(s,nx,ny))continue;
   prev[ni]=n;q.push(ni);
  }
 }
 if(found<0)return [];
 const result=[];while(prev[found]!==-1){result.push({x:found%W+.5,y:Math.floor(found/W)+.5});found=prev[found]}
 return result.reverse();
}
function autoHarvest(s,e){
 const node=s.resources.filter(r=>r.amount>0).sort((a,b)=>dist(e,a)-dist(e,b)||a.id-b.id)[0];
 e.order=node?{kind:'harvest',target:node.id}:null;e.path=[];
}
function command(s,ids,kind,x,y,target){
 if(s.status!=='playing'||s.paused)return false;
 if(!['move','attack','harvest','attackMove','stop'].includes(kind))return false;
 const es=s.entities.filter(e=>ids.includes(e.id)&&e.team===0&&!SPEC[e.type].building);
 es.forEach((e,i)=>{
  const t=s.entities.find(t=>t.id===target&&t.team!==e.team);
  const r=s.resources.find(r=>r.id===target&&r.amount>0);
  if(kind==='attack'&&!t)return;
  if(kind==='harvest'&&(e.type!=='hauler'||!r))return;
  e.order=kind==='stop'?null:{kind,x:Math.max(.5,Math.min(W-.5,x+(kind==='move'||kind==='attackMove'?(i%4)*.65:0))),y:Math.max(.5,Math.min(H-.5,y+(kind==='move'||kind==='attackMove'?Math.floor(i/4)*.65:0))),target};
  e.path=[];e.pathAge=0;
 });return es.length>0;
}
function energy(s,team){return s.entities.filter(e=>e.team===team).reduce((a,e)=>a+(e.type==='hq'?5:e.type==='solar'?8:e.type==='factory'?-4:e.type==='turret'?-3:0),0)}
function canBuild(s,type,x,y,team=0){
 if(!['solar','factory','turret'].includes(type)||s.status!=='playing'||s.paused)return '当前无法建造';
 if(s.credits[team]<SPEC[type].cost)return '能源点不足';
 if(!Number.isInteger(x)||!Number.isInteger(y)||x<2||y<2||x>W-2||y>H-2)return '超出战场';
 const home=s.entities.find(e=>e.team===team&&e.type==='hq');
 if(!home||Math.hypot(x-home.x,y-home.y)>10)return '请在中枢十格内建造';
 for(let yy=y-1;yy<=y;yy++)for(let xx=x-1;xx<=x;xx++){
  if(blocked(s,xx,yy)||s.resources.some(r=>r.amount>0&&Math.hypot(r.x-xx-.5,r.y-yy-.5)<1)||s.entities.some(e=>!SPEC[e.type].building&&Math.hypot(e.x-xx-.5,e.y-yy-.5)<.8))return '此处被占用';
 }
 return '';
}
function build(s,type,x,y,team=0){
 const error=canBuild(s,type,x,y,team);if(error)return {ok:false,error};
 s.credits[team]-=SPEC[type].cost;const e=spawn(s,type,team,x,y);
 // A new building invalidates cached paths.
 for(const u of s.entities)u.path=[];
 return {ok:true,id:e.id};
}
function train(s,type,team=0){
 if(s.status!=='playing'||s.paused||!['hauler','scout','ranger'].includes(type))return {ok:false,error:'当前无法生产'};
 const f=s.entities.find(e=>e.team===team&&e.type==='factory'&&e.queue.length<5);
 if(!f)return {ok:false,error:'需要空闲工坊（每座队列上限 5）'};
 if(s.entities.filter(e=>e.team===team&&!SPEC[e.type].building).length+s.entities.filter(e=>e.team===team).reduce((n,e)=>n+e.queue.length,0)>=45)return {ok:false,error:'已达 45 单位上限'};
 if(s.credits[team]<SPEC[type].cost)return {ok:false,error:'能源点不足'};
 s.credits[team]-=SPEC[type].cost;f.queue.push({type,left:type==='ranger'?130:type==='hauler'?100:75});return {ok:true};
}
function storm(s){return s.tick%(HZ*100)>=HZ*75}
function visible(s,e){return e.team===0||s.entities.some(a=>a.team===0&&dist(a,e)<(SPEC[a.type].building?8:7))}
function reveal(s){
 for(const e of s.entities.filter(e=>e.team===0)){
  const rad=SPEC[e.type].building?8:7;
  for(let y=Math.max(0,Math.floor(e.y-rad));y<Math.min(H,Math.ceil(e.y+rad));y++)
   for(let x=Math.max(0,Math.floor(e.x-rad));x<Math.min(W,Math.ceil(e.x+rad));x++)
    if(Math.hypot(x+.5-e.x,y+.5-e.y)<rad)s.explored[y*W+x]=true;
 }
}
function walk(s,e,x,y,range){
 if(dist(e,{x,y})<=range)return true;
e.pathAge=Math.min(100,e.pathAge+1);
 if(e.path.length&&blocked(s,Math.floor(e.path[0].x),Math.floor(e.path[0].y))){e.path=[];e.pathAge=0}
 if((!e.path.length&&(e.pathAge===1||e.pathAge>=20))||(e.order?.kind==='attack'&&e.pathAge>45)){e.path=pathfind(s,e.x,e.y,x,y,range<.75?0:range);e.pathAge=e.path.length?0:1}
 if(!e.path.length&&range<.75&&Math.floor(e.x)===Math.floor(x)&&Math.floor(e.y)===Math.floor(y)&&!blocked(s,Math.floor(x),Math.floor(y)))e.path=[{x,y}];
 if(!e.path.length)return false;
 const next=e.path[0],d=dist(e,next),speed=SPEC[e.type].speed*(storm(s)?.62:1);
 if(d<=speed){e.x=next.x;e.y=next.y;e.path.shift()}
 else{e.x+=(next.x-e.x)/d*speed;e.y+=(next.y-e.y)/d*speed}
 return dist(e,{x,y})<=range;
}
function step(s){
 if(s.paused||s.status!=='playing')return;
 s.tick++;
 if(s.tick%HZ===0)for(let team=0;team<2;team++)s.credits[team]+=s.entities.filter(e=>e.team===team).reduce((n,e)=>n+(e.type==='hq'?2:e.type==='solar'?3:0),0);
 if(s.tick%80===0&&s.tick>400)train(s,s.aiWave++%4===0?'ranger':'scout',1);
 if(s.tick%240===0&&s.tick>800){
  const home=s.entities.find(e=>e.type==='hq'&&e.team===0);
  if(home)for(const e of s.entities.filter(e=>e.team===1&&!SPEC[e.type].building&&e.type!=='hauler')){e.order={kind:'attack',target:home.id};e.path=[]}
 }
 s.events=s.events.filter(e=>s.tick-e.tick<7);
 for(const e of [...s.entities]){
  if(e.hp<=0)continue;
  const spec=SPEC[e.type];if(e.cooldown>0)e.cooldown--;
  if(e.type==='factory'&&e.queue.length){
   if(energy(s,e.team)>=0||s.tick%2===0)e.queue[0].left--;
   if(e.queue[0].left<=0){
    let spot;for(const [dx,dy]of [[2,0],[2,1],[0,2],[-2,0],[0,-2],[-2,-1]]){
     if(!blocked(s,Math.floor(e.x+dx),Math.floor(e.y+dy))){spot={x:e.x+dx+.5,y:e.y+dy+.5};break}
    }
    if(spot){const u=spawn(s,e.queue.shift().type,e.team,spot.x,spot.y);if(u.type==='hauler')autoHarvest(s,u)}
   }
  }
  if(e.type==='hauler'){
   if(!e.order)continue;
   if(e.order.kind==='harvest'){
    const home=s.entities.find(a=>a.team===e.team&&a.type==='hq');
    let node=s.resources.find(r=>r.id===e.order.target&&r.amount>0);
    if(!node&&e.cargo===0){autoHarvest(s,e);continue}
    if(e.cargo>=spec.capacity||!node){
     if(home&&walk(s,e,home.x,home.y,2)){s.credits[e.team]+=e.cargo;e.cargo=0;e.path=[]}
    }else if(walk(s,e,node.x,node.y,1.2)){e.work++;if(e.work>=12){const amount=Math.min(12,node.amount,spec.capacity-e.cargo);node.amount-=amount;e.cargo+=amount;e.work=0}}
   }else if(['move','attackMove'].includes(e.order.kind)&&walk(s,e,e.order.x,e.order.y,.3))e.order=null;
   continue;
  }
  const order=e.order;
  let target=order?.kind==='attack'?s.entities.find(t=>t.id===order.target&&t.team!==e.team&&t.hp>0):null;
  if(order?.kind==='attack'&&!target){e.order=null;e.path=[]}
  if(spec.damage){
   const nearby=s.entities.filter(t=>t.team!==e.team&&t.hp>0&&dist(e,t)<=spec.range).sort((a,b)=>dist(e,a)-dist(e,b)||a.id-b.id)[0];
   if(!target||dist(e,target)>spec.range)target=nearby||target;
   if(target&&dist(e,target)<=spec.range){
    if(e.cooldown===0){target.hp-=spec.damage;e.cooldown=spec.cd;s.events.push({from:e.id,to:target.id,x:e.x,y:e.y,tx:target.x,ty:target.y,tick:s.tick,team:e.team});if(target.hp<=0)s.kills[e.team]++}
    if(order?.kind!=='move')continue;
   }
  }
  if(!spec.building&&e.order){
   if(e.order.kind==='attack'&&target)walk(s,e,target.x,target.y,spec.range*.86);
   else if(['move','attackMove'].includes(e.order.kind)){
    if(e.order.kind==='attackMove'&&target)walk(s,e,target.x,target.y,spec.range*.86);
    else if(walk(s,e,e.order.x,e.order.y,.32))e.order=null;
   }
  }
 }
 s.entities=s.entities.filter(e=>e.hp>0);
 const player=s.entities.some(e=>e.team===0&&e.type==='hq'),enemy=s.entities.some(e=>e.team===1&&e.type==='hq');
 if(!player||!enemy)s.status=!player&&!enemy?'draw':player?'won':'lost';
 if(s.tick%10===0)reveal(s);
}
function validate(s){
 const fail=()=>{throw Error('存档结构或版本无效')};
 const num=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
 if(!s||s.version!==VERSION||!Number.isInteger(s.seed)||!num(s.rng,0,4294967295)||!Number.isInteger(s.tick)||!num(s.tick,0,1e9)||!Number.isInteger(s.nextId)||!num(s.nextId,1,1e9)||!['playing','won','lost','draw'].includes(s.status)||typeof s.paused!=='boolean')fail();
 if(!Array.isArray(s.credits)||s.credits.length!==2||s.credits.some(x=>!num(x,0,1e9)))fail();
 if(!Array.isArray(s.terrain)||s.terrain.length!==W*H||s.terrain.some(x=>x!==0&&x!==1)||!Array.isArray(s.explored)||s.explored.length!==W*H||s.explored.some(x=>typeof x!=='boolean'))fail();
 if(!Array.isArray(s.entities)||s.entities.length>150||!Array.isArray(s.resources)||s.resources.length>100||!Array.isArray(s.events)||s.events.length>1000||!Array.isArray(s.kills)||s.kills.length!==2||s.kills.some(x=>!num(x,0,1e9))||!Number.isInteger(s.aiWave))fail();
 const ids=new Set();
 for(const e of s.entities){
  if(!Number.isInteger(e.id)||ids.has(e.id)||e.id>=s.nextId||!SPEC[e.type]||![0,1].includes(e.team)||!num(e.x,0,W)||!num(e.y,0,H)||!num(e.hp,.001,SPEC[e.type].hp)||!num(e.cooldown,0,100)||!num(e.cargo,0,96)||!num(e.work,0,12)||!num(e.pathAge,0,100)||!Array.isArray(e.path)||e.path.length>W*H||e.path.some(p=>!num(p.x,0,W)||!num(p.y,0,H))||!Array.isArray(e.queue)||e.queue.length>5||e.queue.some(q=>!['scout','ranger','hauler'].includes(q.type)||!num(q.left,-100000,200)))fail();
  if(e.order&&(!['move','attack','harvest','attackMove'].includes(e.order.kind)||( ['move','attackMove'].includes(e.order.kind)&&(!num(e.order.x,0,W)||!num(e.order.y,0,H)))||(['attack','harvest'].includes(e.order.kind)&&!Number.isInteger(e.order.target))))fail();
  ids.add(e.id);
 }
 for(const r of s.resources){if(!Number.isInteger(r.id)||ids.has(r.id)||r.id>=s.nextId||!num(r.x,0,W)||!num(r.y,0,H)||!num(r.amount,0,10000))fail();ids.add(r.id)}
 for(const e of s.events)if(!num(e.x,0,W)||!num(e.y,0,H)||!num(e.tx,0,W)||!num(e.ty,0,H)||!num(e.tick,0,s.tick)||![0,1].includes(e.team))fail();
 const p=s.entities.some(e=>e.type==='hq'&&e.team===0),a=s.entities.some(e=>e.type==='hq'&&e.team===1);
 if((s.status==='playing'&&(!p||!a))||(s.status==='won'&&(!p||a))||(s.status==='lost'&&(p||!a))||(s.status==='draw'&&(p||a)))fail();
 return clone(s);
}
root.Tempest={W,H,HZ,VERSION,SPEC,create,step,spawn,command,pathfind,blocked,build,canBuild,train,energy,storm,visible,validate,clone};
})(typeof globalThis!=='undefined'?globalThis:window);

