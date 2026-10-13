/* Tempest Commons 0.2 — rebuilt on the 0.1 deterministic 20 Hz simulation and grid pathfinder.
   Original code/art. No proprietary game data. */
(function(root){
'use strict';
const W=40,H=26,HZ=20,VERSION=2,MAX_UNITS=70;
const SPEC={
 goal:{name:'敌军前哨',role:'首战目标',hp:2550,core:true,building:true,cost:0,power:0,range:10,damage:40,cd:40,sight:20,weapon:'shell',versus:{infantry:1,light:.8,heavy:.85,structure:.5}},
 hq:{name:'建造场',role:'扩展基地',hp:1800,core:true,building:true,cost:0,power:25,sight:8},
 solar:{name:'发电站',role:'供应 150 电力',hp:650,building:true,cost:300,time:160,power:150,sight:5,requires:['hq']},
 refinery:{name:'精炼厂',role:'附赠矿车 · 经济核心',hp:1000,building:true,cost:900,time:280,power:-30,sight:6,requires:['solar']},
 barracks:{name:'兵营',role:'步兵 / 反坦克兵',hp:700,building:true,cost:500,time:200,power:-20,sight:6,requires:['solar']},
 factory:{name:'战车工厂',role:'装甲与采矿车辆',hp:1200,building:true,cost:1400,time:400,power:-65,sight:6,requires:['refinery','barracks']},
 radar:{name:'雷达站',role:'雷达在线 · 解锁火炮',hp:700,building:true,cost:700,time:240,power:-40,sight:9,requires:['refinery']},
 turret:{name:'防御炮塔',role:'反步兵 · 缺电停火',hp:750,building:true,cost:500,time:200,power:-25,range:6.5,damage:21,cd:14,sight:7,weapon:'bullet',versus:{infantry:1.5,light:.65,heavy:.28,structure:.4},requires:['barracks']},
 mcv:{name:'基地车',role:'选择后按 D 部署',hp:1300,core:true,cost:0,speed:.037,sight:8,armor:'heavy'},
 hauler:{name:'采矿车',role:'采矿 / 运回精炼厂',hp:650,cost:900,time:300,speed:.046,capacity:600,sight:6,armor:'heavy',producer:'factory'},
 rifle:{name:'步兵',role:'克制步兵 · 低效反甲',hp:110,cost:100,time:90,speed:.055,range:4.6,damage:12,cd:14,sight:6,armor:'infantry',producer:'barracks',weapon:'bullet',versus:{infantry:1,light:.45,heavy:.18,structure:.2}},
 rocket:{name:'反坦克兵',role:'克制装甲 · 怕机枪',hp:100,cost:300,time:150,speed:.043,range:6,damage:42,cd:46,sight:6,armor:'infantry',producer:'barracks',weapon:'rocket',versus:{infantry:.35,light:1.25,heavy:1.4,structure:.6}},
 scout:{name:'侦察车',role:'快速侦察 · 反步兵',hp:250,cost:500,time:160,speed:.103,range:4.8,damage:16,cd:12,sight:10,armor:'light',producer:'factory',weapon:'bullet',versus:{infantry:1.35,light:.7,heavy:.23,structure:.2}},
 ranger:{name:'主战坦克',role:'前线主力 · 反装甲',hp:570,cost:800,time:240,speed:.059,range:6,damage:55,cd:34,sight:7,armor:'heavy',producer:'factory',weapon:'shell',versus:{infantry:.58,light:1.1,heavy:1,structure:.85}},
 artillery:{name:'自行火炮',role:'远程拆楼 · 需护卫',hp:310,cost:1100,time:300,speed:.038,range:9,minRange:2.4,damage:90,cd:70,sight:7,armor:'light',producer:'factory',weapon:'artillery',versus:{infantry:1,light:.7,heavy:.65,structure:1.5},requires:['radar']}
};
const clone=o=>JSON.parse(JSON.stringify(o)),dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296}
function spawn(s,type,team,x,y){
 const p=SPEC[type],e={id:s.nextId++,type,team,x,y,hp:p.hp,cooldown:0,order:null,path:[],pathAge:0,cargo:0,work:0,queue:[],angle:team?Math.PI:0,turret:team?Math.PI:0,born:s.tick,repair:false,rally:null};
 s.entities.push(e);return e;
}
function create(seed=72134){
 seed=Number(seed)>>>0;
 const s={version:VERSION,mode:'classic',seed,rng:seed,tick:0,nextId:1,status:'playing',paused:false,credits:[5000,3600],entities:[],resources:[],terrain:[],explored:Array(W*H).fill(false),events:[],projectiles:[],wrecks:[],buildQueue:[[],[]],kills:[0,0],mined:[0,0],aiWave:0,groups:{}};
 for(let y=0;y<H;y++)for(let x=0;x<W;x++)s.terrain.push((x===19||x===20)&&y>1&&y<24&&!(y>=7&&y<=10)&&!(y>=17&&y<=20)?1:0);
 for(const [x,y] of [[9,6],[8,19],[29,6],[31,19],[16,9],[24,18]])for(let i=0;i<5;i++)s.resources.push({id:s.nextId++,x:x+(i%3)*.86+random(s)*.18,y:y+Math.floor(i/3)*.85+random(s)*.18,amount:2600+Math.floor(random(s)*600)});
 spawn(s,'mcv',0,5,13);spawn(s,'rifle',0,7,11);spawn(s,'rifle',0,7.7,12);spawn(s,'rifle',0,7,14);spawn(s,'scout',0,8,13);
 spawn(s,'hq',1,35,13);spawn(s,'solar',1,35,9);spawn(s,'refinery',1,30,8);spawn(s,'barracks',1,35,17);spawn(s,'factory',1,31,14);spawn(s,'turret',1,29,12);spawn(s,'hauler',1,30,6);spawn(s,'rifle',1,28,13);spawn(s,'rifle',1,29,15);spawn(s,'ranger',1,29,14);
 for(const e of s.entities.filter(e=>e.type==='hauler'))autoHarvest(s,e);
 reveal(s);return s;
}
function createFirstBattle(seed=72134){
 const s=create(seed);s.mode='firstBattle';s.entities=[];s.credits=[2200,0];s.explored.fill(true);s.resources=s.resources.filter(r=>r.x<15);
 spawn(s,'hq',0,5,13);spawn(s,'solar',0,5,8);spawn(s,'refinery',0,9,10);spawn(s,'factory',0,9,14);
 const miner=spawn(s,'hauler',0,9,7);autoHarvest(s,miner);
 for(const [x,y]of [[14,8.4],[14,9.6],[13,9]])spawn(s,'ranger',0,x,y);
 spawn(s,'goal',1,23,9);reveal(s);return s;
}
function inside(x,y){return x>=0&&y>=0&&x<W&&y<H}
function blocked(s,x,y,ignore=0){
 if(!inside(x,y)||s.terrain[y*W+x])return true;
 return s.entities.some(e=>e.id!==ignore&&e.hp>0&&SPEC[e.type].building&&Math.abs((x+.5)-e.x)<1&&Math.abs((y+.5)-e.y)<1);
}
function pathfind(s,sx,sy,gx,gy,range=0){
 const start={x:clamp(Math.floor(sx),0,W-1),y:clamp(Math.floor(sy),0,H-1)};
 if(!Number.isFinite(gx)||!Number.isFinite(gy))return [];
 gx=clamp(gx,.5,W-.5);gy=clamp(gy,.5,H-.5);
 const prev=new Int32Array(W*H).fill(-2),q=[start.y*W+start.x];prev[q[0]]=-1;let found=-1;
 for(let head=0;head<q.length;head++){
  const n=q[head],x=n%W,y=Math.floor(n/W);
  if((range>0&&Math.hypot(x+.5-gx,y+.5-gy)<=range)||(range===0&&x===Math.floor(gx)&&y===Math.floor(gy))){found=n;break}
  for(const [dx,dy] of [[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){
   const nx=x+dx,ny=y+dy,ni=ny*W+nx;
   if(!inside(nx,ny)||prev[ni]!==-2||blocked(s,nx,ny)||(dx&&dy&&(blocked(s,x+dx,y)||blocked(s,x,y+dy))))continue;
   prev[ni]=n;q.push(ni);
  }
 }
 if(found<0)return [];
 const result=[];while(prev[found]!==-1){result.push({x:found%W+.5,y:Math.floor(found/W)+.5});found=prev[found]}
 if(!result.length&&range>0&&Math.hypot(sx-gx,sy-gy)>range)return [{x:start.x+.5,y:start.y+.5}];
 return result.reverse();
}
function autoHarvest(s,e){
 const node=s.resources.filter(r=>r.amount>0).sort((a,b)=>dist(e,a)-dist(e,b)||a.id-b.id)[0];
 e.order=node?{kind:'harvest',target:node.id}:null;e.path=[];e.pathAge=0;
}
function command(s,ids,kind,x,y,target,team=0){
 if(s.status!=='playing'||s.paused||!Array.isArray(ids))return false;
 if(!['move','attack','harvest','attackMove','stop','return'].includes(kind))return false;
 if(!['attack','harvest','stop','return'].includes(kind)&&(!Number.isFinite(x)||!Number.isFinite(y)))return false;
 const es=s.entities.filter(e=>ids.includes(e.id)&&e.team===team&&!SPEC[e.type].building);let changed=0;
 es.forEach((e,i)=>{
  const t=s.entities.find(t=>t.id===target&&t.team!==e.team&&t.hp>0),r=s.resources.find(r=>r.id===target&&r.amount>0);
  if(kind==='attack'&&(!t||!visibleTo(s,t,team)))return;
  if((kind==='harvest'&&(e.type!=='hauler'||!r))||(kind==='return'&&e.type!=='hauler'))return;
  const cols=Math.ceil(Math.sqrt(es.length)),ox=(i%cols-(cols-1)/2)*.85,oy=(Math.floor(i/cols)-(Math.ceil(es.length/cols)-1)/2)*.85;
  e.order=kind==='stop'?null:{kind,x:clamp((x||e.x)+(kind==='move'||kind==='attackMove'?ox:0),.5,W-.5),y:clamp((y||e.y)+(kind==='move'||kind==='attackMove'?oy:0),.5,H-.5),target};
  e.path=[];e.pathAge=0;changed++;
 });return changed>0;
}
function power(s,team=0){return s.entities.filter(e=>e.team===team).reduce((a,e)=>{const p=SPEC[e.type].power||0;if(p>0)a.produced+=p;else a.used-=p;return a},{produced:0,used:0})}
function energy(s,team=0){const p=power(s,team);return p.produced-p.used}
function has(s,team,type){return s.entities.some(e=>e.team===team&&e.type===type&&e.hp>0)}
function requirement(s,type,team=0){return (SPEC[type].requires||[]).find(t=>!has(s,team,t))||null}
function canPlace(s,type,x,y,team=0,deployId=0){
 if(!SPEC[type]?.building||!Number.isInteger(x)||!Number.isInteger(y)||x<2||y<2||x>W-2||y>H-2)return '超出战场';
 if(!deployId&&!s.entities.some(e=>e.team===team&&SPEC[e.type].building&&dist(e,{x,y})<=5.2))return '需要靠近己方建筑（5 格内）';
 if(team===0&&!deployId&&!s.explored[Math.floor(y)*W+Math.floor(x)])return '尚未侦察此处';
 for(let yy=y-1;yy<=y;yy++)for(let xx=x-1;xx<=x;xx++){
  if(blocked(s,xx,yy)||s.resources.some(r=>r.amount>0&&Math.hypot(r.x-xx-.5,r.y-yy-.5)<.75)||s.entities.some(e=>e.id!==deployId&&!SPEC[e.type].building&&Math.hypot(e.x-xx-.5,e.y-yy-.5)<.65))return '地形或单位占用';
 }
 return '';
}
function canBuild(s,type,x,y,team=0){
 if(s.status!=='playing'||s.paused)return '当前无法建造';
 if(!s.buildQueue[team]?.some(q=>q.type===type&&q.left<=0))return '请先在侧栏完成施工';
 return canPlace(s,type,x,y,team);
}
function startBuild(s,type,team=0){
 if(s.status!=='playing'||s.paused||!SPEC[type]?.building||!SPEC[type].time)return {ok:false,error:'当前无法建造'};
 const req=requirement(s,type,team);if(req)return {ok:false,error:'需要'+SPEC[req].name};
 if(s.buildQueue[team].length)return {ok:false,error:'已有建筑施工中或等待放置'};
 if(s.credits[team]<SPEC[type].cost)return {ok:false,error:'资金不足'};
 s.credits[team]-=SPEC[type].cost;s.buildQueue[team].push({type,left:SPEC[type].time,total:SPEC[type].time,held:false});return {ok:true};
}
function cancelBuild(s,team=0){const q=s.buildQueue[team][0];if(!q||s.paused||s.status!=='playing')return false;s.credits[team]+=SPEC[q.type].cost;s.buildQueue[team]=[];return true}
function build(s,type,x,y,team=0){
 const error=canBuild(s,type,x,y,team);if(error)return {ok:false,error};
 const e=spawn(s,type,team,x,y);s.buildQueue[team]=[];for(const u of s.entities)u.path=[];
 s.events.push({kind:'build',x,y,tx:x,ty:y,tick:s.tick,team});
 if(type==='refinery'){const spot=exitSpot(s,e);if(spot){const u=spawn(s,'hauler',team,spot.x,spot.y);autoHarvest(s,u)}}
 return {ok:true,id:e.id};
}
function deploy(s,id){
 const e=s.entities.find(e=>e.id===id&&e.type==='mcv'&&e.team===0);if(!e||s.paused||s.status!=='playing')return {ok:false,error:'请先选择基地车'};
 const x=Math.round(e.x),y=Math.round(e.y),error=canPlace(s,'hq',x,y,0,e.id);if(error)return {ok:false,error};
 e.type='hq';e.x=x;e.y=y;e.hp=SPEC.hq.hp;e.order=null;e.path=[];e.born=s.tick;s.events.push({kind:'build',x,y,tx:x,ty:y,tick:s.tick,team:0});reveal(s);return {ok:true,id:e.id};
}
function train(s,type,team=0){
 if(s.status!=='playing'||s.paused||!SPEC[type]?.producer)return {ok:false,error:'当前无法生产'};
 const req=requirement(s,type,team);if(req)return {ok:false,error:'需要'+SPEC[req].name};
 const f=s.entities.find(e=>e.team===team&&e.type===SPEC[type].producer&&e.queue.length<9);
 if(!f)return {ok:false,error:'需要空闲'+SPEC[SPEC[type].producer].name+'（最多 9 个）'};
 if(s.entities.filter(e=>e.team===team&&!SPEC[e.type].building).length+s.entities.filter(e=>e.team===team).reduce((n,e)=>n+e.queue.length,0)>=MAX_UNITS)return {ok:false,error:'已达 70 单位上限'};
 if(s.credits[team]<SPEC[type].cost)return {ok:false,error:'资金不足'};
 s.credits[team]-=SPEC[type].cost;f.queue.push({type,left:SPEC[type].time,total:SPEC[type].time});return {ok:true};
}
function cancelTrain(s,type,team=0){if(s.paused||s.status!=='playing')return false;for(const e of s.entities){if(e.team!==team)continue;const i=e.queue.map(q=>q.type).lastIndexOf(type);if(i>=0){e.queue.splice(i,1);s.credits[team]+=SPEC[type].cost;return true}}return false}
function storm(){return false} // Removed the prototype's unrelated periodic movement penalty.
function visibleTo(s,e,team){return s.mode==='firstBattle'||e.team===team||s.entities.some(a=>a.team===team&&dist(a,e)<SPEC[a.type].sight)}
function visible(s,e){return visibleTo(s,e,0)}
function vision(s){const vis=new Uint8Array(W*H);for(const e of s.entities.filter(e=>e.team===0)){const rad=SPEC[e.type].sight;for(let y=Math.max(0,Math.floor(e.y-rad));y<Math.min(H,Math.ceil(e.y+rad));y++)for(let x=Math.max(0,Math.floor(e.x-rad));x<Math.min(W,Math.ceil(e.x+rad));x++)if(Math.hypot(x+.5-e.x,y+.5-e.y)<rad)vis[y*W+x]=1}return vis}
function reveal(s){const v=vision(s);for(let i=0;i<v.length;i++)if(v[i])s.explored[i]=true}
function walk(s,e,x,y,range){
 if(dist(e,{x,y})<=range)return true;
 e.pathAge=Math.min(100,e.pathAge+1);
 if(e.path.length&&blocked(s,Math.floor(e.path[0].x),Math.floor(e.path[0].y))){e.path=[];e.pathAge=0}
 if((!e.path.length&&(e.pathAge===1||e.pathAge>=20))||(e.order?.kind==='attack'&&e.pathAge>45)){e.path=pathfind(s,e.x,e.y,x,y,range<.75?0:range);e.pathAge=e.path.length?0:1}
 if(!e.path.length&&range<.75&&Math.floor(e.x)===Math.floor(x)&&Math.floor(e.y)===Math.floor(y)&&!blocked(s,Math.floor(x),Math.floor(y)))e.path=[{x,y}];
 if(!e.path.length)return false;
 const next=e.path[0],d=dist(e,next),speed=SPEC[e.type].speed;
 e.angle=Math.atan2(next.y-e.y,next.x-e.x);
 if(d<=speed){e.x=next.x;e.y=next.y;e.path.shift()}else{e.x+=(next.x-e.x)/d*speed;e.y+=(next.y-e.y)/d*speed}
 return dist(e,{x,y})<=range;
}
function exitSpot(s,e){for(const [dx,dy]of [[0,1.8],[1.8,0],[0,-1.8],[-1.8,0],[1.8,1.8],[-1.8,-1.8]]){const x=e.x+dx,y=e.y+dy;if(!blocked(s,Math.floor(x),Math.floor(y))&&!s.entities.some(u=>!SPEC[u.type].building&&dist(u,{x,y})<.6))return {x,y}}return null}
function hit(s,target,damage,team){if(target.hp<=0)return;target.hp-=damage;if(target.hp<=0)s.kills[team]++}
function fire(s,e,t){
 const p=SPEC[e.type],armor=SPEC[t.type].building?'structure':SPEC[t.type].armor,damage=p.damage*(p.versus?.[armor]||1);
 e.cooldown=p.cd;e.turret=Math.atan2(t.y-e.y,t.x-e.x);
 const duration=p.weapon==='bullet'?2:Math.ceil(dist(e,t)*(p.weapon==='artillery'?3:1.5));
 const shot={kind:p.weapon,from:e.id,to:t.id,x:e.x,y:e.y,tx:t.x,ty:t.y,tick:s.tick,team:e.team,damage,duration};s.projectiles.push(shot);s.events.push({...shot,kind:'fire'});
}
function separate(s){
 const us=s.entities.filter(e=>!SPEC[e.type].building&&e.hp>0);
 for(let i=0;i<us.length;i++)for(let j=i+1;j<us.length;j++){
  const a=us[i],b=us[j],rad=(SPEC[a.type].armor==='infantry'?.18:.32)+(SPEC[b.type].armor==='infantry'?.18:.32),d=dist(a,b);
  if(d>=rad)continue;
  const angle=d>.001?Math.atan2(b.y-a.y,b.x-a.x):((a.id*7+b.id)%8)*Math.PI/4,force=Math.min(.06,(rad-d)/2+.005),dx=Math.cos(angle)*force,dy=Math.sin(angle)*force;
  for(const [u,sgn]of [[a,-1],[b,1]]){const x=clamp(u.x+dx*sgn,.3,W-.3),y=clamp(u.y+dy*sgn,.3,H-.3);if(!blocked(s,Math.floor(x),Math.floor(y))){u.x=x;u.y=y}}
 }
}
function ai(s){
 if(s.mode==='firstBattle')return;
 if(s.tick%200===0&&s.tick>900){train(s,s.aiWave%4===0?'ranger':s.aiWave%4===1?'rocket':'rifle',1);s.aiWave++}
 if(s.tick%1500===0&&s.tick>=3000){const goal=s.entities.find(e=>e.team===0&&(e.type==='refinery'||e.type==='hq'||e.type==='mcv'));if(goal)for(const e of s.entities.filter(e=>e.team===1&&SPEC[e.type].damage&&!SPEC[e.type].building)){e.order={kind:'attackMove',x:goal.x,y:goal.y};e.path=[];e.pathAge=0}}
 // Enemy economy obeys the same mining and unit costs. No free passive credits or unit spawning.
}
function step(s,hooks={}){
 if(s.paused||s.status!=='playing')return;s.tick++;ai(s);
 s.events=s.events.filter(e=>s.tick-e.tick<35);
 s.wrecks=s.wrecks.filter(e=>s.tick-e.tick<1800).slice(-80);
 for(const p of s.projectiles.filter(p=>s.tick-p.tick>=p.duration)){
  let impact=p.precise?(hooks.resolveShot?.(p)||{to:0,damage:0}):p;if(hooks.filterImpact)impact=hooks.filterImpact(p,impact);const t=s.entities.find(e=>e.id===impact.to&&e.hp>0);if(t)hit(s,t,impact.damage,p.team);
  if(p.kind==='artillery')for(const e of s.entities.filter(e=>e.team!==p.team&&e.id!==p.to&&dist(e,{x:p.tx,y:p.ty})<1.05))hit(s,e,p.damage*.28,p.team);
  s.events.push({kind:'impact',x:p.tx,y:p.ty,tx:p.tx,ty:p.ty,tick:s.tick,team:p.team,weapon:p.kind,...(p.impactKind?{impactKind:p.impactKind}:{}),z:p.tz??.7});
 }
 s.projectiles=s.projectiles.filter(p=>s.tick-p.tick<p.duration);
 for(let team=0;team<2;team++){const q=s.buildQueue[team][0];if(q&&q.left>0&&!q.held&&has(s,team,'hq')&&(energy(s,team)>=0||s.tick%3===0))q.left--}
 for(const e of [...s.entities]){
  if(e.hp<=0)continue;const spec=SPEC[e.type];if(e.cooldown>0)e.cooldown--;
  if(e.repair&&spec.building&&e.hp<spec.hp&&s.tick%5===0&&s.credits[e.team]>=2){e.hp=Math.min(spec.hp,e.hp+5);s.credits[e.team]-=2}
  if(spec.building&&e.queue.length){
   if(energy(s,e.team)>=0||s.tick%3===0)e.queue[0].left--;
   if(e.queue[0].left<=0){const spot=exitSpot(s,e);if(spot){const u=spawn(s,e.queue.shift().type,e.team,spot.x,spot.y);if(u.type==='hauler')autoHarvest(s,u);else if(e.rally)u.order={kind:'attackMove',x:e.rally.x,y:e.rally.y};s.events.push({kind:'unit',x:u.x,y:u.y,tx:u.x,ty:u.y,tick:s.tick,team:e.team})}}
  }
  if(e.manual===true)continue; // Driver-controlled tank: no autonomous motion or firing.
  if(e.type==='hauler'){
   if(!e.order)continue;
   if(['harvest','return'].includes(e.order.kind)){
    const homes=s.entities.filter(a=>a.team===e.team&&a.type==='refinery').sort((a,b)=>dist(e,a)-dist(e,b)),home=homes[0];
    let node=s.resources.find(r=>r.id===e.order.target&&r.amount>0);
    if(!node&&e.cargo===0&&e.order.kind!=='return'){autoHarvest(s,e);continue}
    if(e.cargo>=spec.capacity||!node||e.order.kind==='return'){
     if(home&&walk(s,e,home.x,home.y,1.65)){e.work++;if(e.work>=25){s.credits[e.team]+=e.cargo;s.mined[e.team]+=e.cargo;s.events.push({kind:'deposit',x:e.x,y:e.y,tx:e.x,ty:e.y,tick:s.tick,team:e.team,amount:e.cargo});e.cargo=0;e.work=0;autoHarvest(s,e)}}
    }else if(walk(s,e,node.x,node.y,.65)){e.work++;if(e.work>=6){const amount=Math.min(30,node.amount,spec.capacity-e.cargo);node.amount-=amount;e.cargo+=amount;e.work=0}}
   }else if(['move','attackMove'].includes(e.order.kind)&&walk(s,e,e.order.x,e.order.y,.3))e.order=null;
   continue;
  }
  const order=e.order;
  let target=order?.kind==='attack'?s.entities.find(t=>t.id===order.target&&t.team!==e.team&&t.hp>0&&visibleTo(s,t,e.team)):null;
  if(order?.kind==='attack'&&!target){e.order=null;e.path=[]}
  if(spec.damage&&!e.holdFire&&(e.type!=='turret'||energy(s,e.team)>=0)){
   const nearby=s.entities.filter(t=>t.team!==e.team&&t.hp>0&&dist(e,t)<=spec.range&&dist(e,t)>=(spec.minRange||0)&&visibleTo(s,t,e.team)).sort((a,b)=>{const aa=SPEC[a.type].building?'structure':SPEC[a.type].armor,bb=SPEC[b.type].building?'structure':SPEC[b.type].armor;return (spec.versus?.[bb]||1)-(spec.versus?.[aa]||1)||dist(e,a)-dist(e,b)||a.id-b.id})[0];
   if(!target||dist(e,target)>spec.range)target=nearby||target;
   if(target&&dist(e,target)<=spec.range&&dist(e,target)>=(spec.minRange||0)){
    e.turret=Math.atan2(target.y-e.y,target.x-e.x);if(e.cooldown===0)fire(s,e,target);
    if(order?.kind!=='move')continue;
   }
  }
  if(!spec.building&&e.order){
   if(e.order.kind==='attack'&&target)walk(s,e,target.x,target.y,(spec.range||1)*.86);
   else if(['move','attackMove'].includes(e.order.kind)){
    if(e.order.kind==='attackMove'&&target)walk(s,e,target.x,target.y,(spec.range||1)*.86);
    else if(walk(s,e,e.order.x,e.order.y,.32))e.order=null;
   }
  }
 }
 separate(s);
 for(const e of s.entities.filter(e=>e.hp<=0)){s.wrecks.push({type:e.type,x:e.x,y:e.y,tick:s.tick,angle:e.angle});s.events.push({kind:'destroy',x:e.x,y:e.y,tx:e.x,ty:e.y,tick:s.tick,team:e.team});}
 s.entities=s.entities.filter(e=>e.hp>0);
 const player=s.entities.some(e=>e.team===0&&SPEC[e.type].core)&&(s.mode!=='firstBattle'||s.entities.some(e=>e.team===0&&SPEC[e.type].damage&&!SPEC[e.type].building)),enemy=s.entities.some(e=>e.team===1&&SPEC[e.type].core);
 if(!player||!enemy)s.status=!player&&!enemy?'draw':player?'won':'lost';
 if(s.tick%5===0)reveal(s);
}
function validate(s){
 const fail=()=>{throw Error('存档结构或版本无效（需重制版 v2）')},num=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 if(!s||s.version!==VERSION||!['classic','firstBattle'].includes(s.mode)||!Number.isInteger(s.seed)||!num(s.rng,0,4294967295)||!Number.isInteger(s.tick)||!num(s.tick,0,1e9)||!Number.isInteger(s.nextId)||!num(s.nextId,1,1e9)||!['playing','won','lost','draw'].includes(s.status)||typeof s.paused!=='boolean')fail();
 if(!Array.isArray(s.credits)||s.credits.length!==2||s.credits.some(x=>!num(x,0,1e9)))fail();
 if(!Array.isArray(s.terrain)||s.terrain.length!==W*H||s.terrain.some(x=>x!==0&&x!==1)||!Array.isArray(s.explored)||s.explored.length!==W*H||s.explored.some(x=>typeof x!=='boolean'))fail();
 if(!Array.isArray(s.entities)||s.entities.length>200||!Array.isArray(s.resources)||s.resources.length>100||!Array.isArray(s.events)||s.events.length>3000||!Array.isArray(s.projectiles)||s.projectiles.length>1000||!Array.isArray(s.wrecks)||s.wrecks.length>200||!Array.isArray(s.kills)||s.kills.length!==2||s.kills.some(x=>!num(x,0,1e9))||!Array.isArray(s.mined)||s.mined.length!==2||s.mined.some(x=>!num(x,0,1e9))||!Number.isInteger(s.aiWave)||!s.groups||typeof s.groups!=='object'||Array.isArray(s.groups)||Object.entries(s.groups).some(([k,v])=>!/^\d$/.test(k)||!Array.isArray(v)||v.length>MAX_UNITS||v.some(x=>!Number.isInteger(x))))fail();
 const queue=q=>q&&SPEC[q.type]&&num(q.left,-100000,10000)&&num(q.total,1,10000);
 if(!Array.isArray(s.buildQueue)||s.buildQueue.length!==2||s.buildQueue.some(a=>!Array.isArray(a)||a.length>1||a.some(q=>!queue(q)||!SPEC[q.type].building||typeof q.held!=='boolean')))fail();
 const ids=new Set();
 for(const e of s.entities){
  if(!Number.isInteger(e.id)||e.id<1||ids.has(e.id)||e.id>=s.nextId||!SPEC[e.type]||![0,1].includes(e.team)||!num(e.x,0,W)||!num(e.y,0,H)||!num(e.hp,.001,SPEC[e.type].hp)||!num(e.cooldown,0,100)||!num(e.cargo,0,600)||!num(e.work,0,30)||!num(e.pathAge,0,100)||!num(e.angle,-100,100)||!num(e.turret,-100,100)||!num(e.born,0,s.tick)||typeof e.repair!=='boolean'||(e.manual!==undefined&&typeof e.manual!=='boolean')||(e.holdFire!==undefined&&typeof e.holdFire!=='boolean')||(e.rally&&(!num(e.rally.x,0,W)||!num(e.rally.y,0,H)))||!Array.isArray(e.path)||e.path.length>W*H||e.path.some(p=>!num(p.x,0,W)||!num(p.y,0,H))||!Array.isArray(e.queue)||e.queue.length>9||e.queue.some(q=>!queue(q)||!SPEC[q.type].producer))fail();
  if(e.order&&(!['move','attack','harvest','attackMove','return'].includes(e.order.kind)||(['move','attackMove'].includes(e.order.kind)&&(!num(e.order.x,0,W)||!num(e.order.y,0,H)))||(['attack','harvest'].includes(e.order.kind)&&!Number.isInteger(e.order.target))))fail();ids.add(e.id);
 }
 for(const r of s.resources){if(!Number.isInteger(r.id)||r.id<1||ids.has(r.id)||r.id>=s.nextId||!num(r.x,0,W)||!num(r.y,0,H)||!num(r.amount,0,10000))fail();ids.add(r.id)}
 for(const e of [...s.events,...s.projectiles])if(!num(e.x,0,W)||!num(e.y,0,H)||!num(e.tx,0,W)||!num(e.ty,0,H)||!num(e.tick,0,s.tick)||![0,1].includes(e.team)||(e.impactKind!==undefined&&!['armor','weakpoint'].includes(e.impactKind)))fail();
 for(const p of s.projectiles){if(p.precise){const q=p.precise;if(!Array.isArray(q.origin)||q.origin.length!==3||!Array.isArray(q.direction)||q.direction.length!==3||q.origin.some(v=>!num(v,-10,100))||q.direction.some(v=>!num(v,-1,1))||Math.abs(Math.hypot(...q.direction)-1)>1e-8||!num(q.limit,.1,10)||!num(q.near,.01,10)||!num(p.z,0,10)||!num(p.tz,-10,20))fail();}if(!['bullet','shell','rocket','artillery'].includes(p.kind)||!num(p.damage,0,1000)||!num(p.duration,1,100)||!Number.isInteger(p.to))fail();}
 for(const w of s.wrecks)if(!SPEC[w.type]||!num(w.x,0,W)||!num(w.y,0,H)||!num(w.tick,0,s.tick)||!num(w.angle,-100,100))fail();
 const p=s.entities.some(e=>SPEC[e.type].core&&e.team===0)&&(s.mode!=='firstBattle'||s.entities.some(e=>e.team===0&&SPEC[e.type].damage&&!SPEC[e.type].building)),a=s.entities.some(e=>SPEC[e.type].core&&e.team===1);
 if((s.status==='playing'&&(!p||!a))||(s.status==='won'&&(!p||a))||(s.status==='lost'&&(p||!a))||(s.status==='draw'&&(p||a)))fail();return clone(s);
}
root.Tempest={fire,W,H,HZ,VERSION,MAX_UNITS,SPEC,create,createFirstBattle,step,spawn,command,pathfind,blocked,build,canBuild,canPlace,startBuild,cancelBuild,deploy,train,cancelTrain,energy,power,storm,visible,visibleTo,vision,requirement,validate,clone};
})(typeof globalThis!=='undefined'?globalThis:window);
