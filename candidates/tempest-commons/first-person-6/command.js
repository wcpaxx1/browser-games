/* First-person driver/controller adapter. The preserved 20 Hz economy/combat engine remains authoritative. */
(function(root){'use strict';
const G=root.Tempest,TAU=Math.PI*2,clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),wrap=a=>((a+Math.PI)%TAU+TAU)%TAU-Math.PI;
function create(seed=72134,encounter='flank-v1'){const s=G.createFirstBattle(seed),tanks=s.entities.filter(e=>e.type==='ranger');
 const p=tanks[2];p.x=17.3;p.y=7.6;p.angle=Math.atan2(1.4,5.7);p.turret=p.angle;p.manual=true;
 tanks[0].x=19.3;tanks[0].y=7.3;tanks[1].x=19.4;tanks[1].y=9.2;for(const t of tanks.slice(0,2)){t.holdFire=true;t.angle=.1;t.turret=.1};
 // Avoid the old narrow bridge as a hard-to-explain invisible driving barrier in this short arena.
 s.terrain.fill(0);return {...(encounter?{encounter}:{}),schema:2,kind:'tempest-cockpit',sim:s,pilot:p.id,yaw:p.angle,pitch:0,shots:0,hits:0,orders:0,commandTick:-100,recoil:0,hitFlash:0,lastHp:p.hp};}
function pilot(g){return g.sim.entities.find(e=>e.id===g.pilot)}
function target(g){return g.sim.entities.find(e=>e.type==='goal'&&e.team===1)}
function allies(g){return g.sim.entities.filter(e=>e.type==='ranger'&&e.id!==g.pilot&&e.team===0)}
function sight(g,e,view={}){if(!e)return false;const cam=root.CockpitGeometry.camera(g,view),mesh=root.CockpitGeometry.scene(g,view);for(const z of [.4,.8,1.13,1.4]){const dx=e.x-cam.x,dy=e.y-cam.y,dz=z-cam.z,len=Math.hypot(dx,dy,dz),ray={o:[cam.x,cam.y,cam.z],d:[dx/len,dy/len,dz/len],near:.075,limit:30},q=root.CockpitGeometry.cameraPoint(cam,[e.x,e.y,z]);if(q.z<=.075||Math.abs(q.x/q.z)>Math.tan(Math.PI*.2))continue;const hit=root.CockpitGeometry.cast(mesh,ray);if(hit?.owner===e.id)return true;}return false;}
function pick(g,nx=0,ny=0,view={}){return root.CockpitGeometry.pick(g,nx,ny,view);}
function aim(g,nx=0,ny=0,view={}){const p=pick(g,nx,ny,view);return p.hit?g.sim.entities.find(e=>e.id===p.hit.owner&&e.team===1&&e.hp>0)||null:null;}
function shoot(g,nx=0,ny=0,view={}){const s=g.sim,p=pilot(g);if(!p||s.paused||s.status!=='playing'||p.cooldown>0)return {ok:false};const q=pick(g,nx,ny,view);if(!q.ray)return {ok:false,hit:false};
 const range=G.SPEC[p.type].range,enemy=q.hit&&s.entities.find(e=>e.id===q.hit.owner&&e.team!==p.team),travel=q.hit?Math.min(range,q.hit.distance):range,hit=!!enemy&&q.hit.distance<=range,point=q.ray.o.map((v,i)=>v+q.ray.d[i]*travel),armor=enemy&&(G.SPEC[enemy.type].building?'structure':G.SPEC[enemy.type].armor),damage=G.SPEC[p.type].damage*(G.SPEC[p.type].versus?.[armor]||1);
 const shot={kind:'shell',from:p.id,to:hit?enemy.id:0,x:p.x,y:p.y,z:q.ray.o[2],tx:clamp(point[0],.001,G.W-.001),ty:clamp(point[1],.001,G.H-.001),tz:point[2],tick:s.tick,team:0,damage:hit?damage:0,duration:Math.max(1,Math.ceil(travel*1.5)),precise:{origin:q.ray.o,direction:q.ray.d,limit:range,near:q.ray.near}};
 p.cooldown=G.SPEC[p.type].cd;p.turret=Math.atan2(q.ray.d[1],q.ray.d[0]);s.projectiles.push(shot);s.events.push({...shot,kind:'fire'});g.shots++;g.recoil=1;return {ok:true,hit,outOfRange:!!enemy&&!hit};}
function tacticalDamage(g,hit,damage){return g.encounter==='flank-v1'&&g.sim.entities.some(e=>e.id===hit?.owner&&e.type==='goal')?damage*(hit.face?.material==='weakpoint'?4:.1):damage;}
function resolveShot(g,shot){if(!shot.precise)return null;const k=shot.precise,cam={...root.CockpitGeometry.camera(g),x:k.origin[0],y:k.origin[1],z:k.origin[2],yaw:Math.atan2(k.direction[1],k.direction[0])},mesh=shot.from===g.pilot?root.CockpitGeometry.scene(g):root.CockpitGeometry.build(g,{}, {camera:cam,excludeId:shot.from,rayOnly:true}),hit=root.CockpitGeometry.cast(mesh,{o:k.origin,d:k.direction,limit:k.limit,near:k.near});const t=hit&&g.sim.entities.find(e=>e.id===hit.owner&&e.team!==shot.team&&e.hp>0);if(hit){shot.tx=clamp(hit.point[0],0,G.W);shot.ty=clamp(hit.point[1],0,G.H);shot.tz=hit.point[2];}if(!t)return {to:0,damage:0};if(g.encounter==='flank-v1'&&t.type==='goal')shot.impactKind=hit.face?.material==='weakpoint'?'weakpoint':'armor';const armor=G.SPEC[t.type].building?'structure':G.SPEC[t.type].armor;g.hits++;return {to:t.id,damage:tacticalDamage(g,hit,G.SPEC.ranger.damage*(G.SPEC.ranger.versus?.[armor]||1))};}
function filterImpact(g,shot,impact){if(g.encounter!=='flank-v1'||shot.precise||shot.team!==0)return impact;const target=g.sim.entities.find(e=>e.id===impact.to&&e.type==='goal');if(!target)return impact;
 const origin=[shot.x,shot.y,.63],delta=[shot.tx-shot.x,shot.ty-shot.y,.8-.63],length=Math.hypot(...delta),ray={o:origin,d:delta.map(v=>v/length),near:.075,limit:length+1,ignoreOwner:shot.from};
 // Friendly automatic shots use their actual launch side, never a player-only
 // damage exemption. The same visible weakpoint face controls their multiplier.
 const mesh=root.CockpitGeometry.scene(g),hit=root.CockpitGeometry.cast(mesh,ray);shot.impactKind=hit?.face?.material==='weakpoint'?'weakpoint':'armor';return {...impact,damage:tacticalDamage(g,hit?.owner===target.id?hit:{owner:target.id},impact.damage)};}
function weakpoint(g){const t=target(g);return g.encounter==='flank-v1'&&t?{x:t.x,y:t.y-1.52,z:.77}:null;}
function command(g,nx=0,ny=0,view={}){if(g.sim.paused||g.sim.status!=='playing')return false;const e=aim(g,nx,ny,view);if(!e)return false;const ok=G.command(g.sim,allies(g).map(a=>a.id),'attack',e.x,e.y,e.id);if(ok){for(const a of allies(g))a.holdFire=false;g.orders++;g.commandTick=g.sim.tick}return ok;}
function free(g,x,y){if(x<.5||y<.5||x>G.W-.5||y>G.H-.5)return false;
 if(g.sim.terrain[Math.floor(y)*G.W+Math.floor(x)])return false;
 return !g.sim.entities.some(e=>e.id!==g.pilot&&G.SPEC[e.type].building&&Math.abs(x-e.x)<1.25&&Math.abs(y-e.y)<1.25);}
function step(g,input={}){const s=g.sim,p=pilot(g);if(s.paused||s.status!=='playing')return;
 if(p){g.yaw=wrap(g.yaw+clamp(Number(input.turn)||0,-1,1)*.036);p.angle=g.yaw;p.turret=g.yaw;
 const speed=clamp(Number(input.drive)||0,-1,1)*.062,dx=Math.cos(g.yaw)*speed,dy=Math.sin(g.yaw)*speed;
 if(free(g,p.x+dx,p.y))p.x+=dx;if(free(g,p.x,p.y+dy))p.y+=dy;
 if(input.fire)shoot(g,input.aimX||0,input.aimY||0,input.view||{});
 }
 G.step(s,{resolveShot:p=>resolveShot(g,p),filterImpact:(p,i)=>filterImpact(g,p,i)});const live=pilot(g);if(live){if(live.hp<g.lastHp)g.hitFlash=1;g.lastHp=live.hp}
 else if(s.status==='playing'){const next=allies(g)[0];if(next){next.manual=true;next.order=null;next.path=[];g.pilot=next.id;g.yaw=next.angle;g.lastHp=next.hp;g.hitFlash=1;}}
 g.recoil=Math.max(0,g.recoil-.13);g.hitFlash=Math.max(0,g.hitFlash-.065);}
function validate(g){if(!g||g.schema!==2||g.kind!=='tempest-cockpit'||(g.encounter!==undefined&&g.encounter!=='flank-v1'))throw Error('不是指挥席存档');const s=G.validate(g.sim);if(s.mode!=='firstBattle')throw Error('战局模式不兼容');
 const num=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
 if(!Number.isInteger(g.pilot)||!num(g.yaw,-Math.PI,Math.PI)||!num(g.pitch,-.3,.3)||!['shots','hits','orders'].every(k=>Number.isInteger(g[k])&&num(g[k],0,1e7))||g.hits>g.shots||!num(g.commandTick,-100,s.tick)||!num(g.recoil,0,1)||!num(g.hitFlash,0,1)||!num(g.lastHp,0,570))throw Error('驾驶员数据损坏');
 const p=s.entities.find(e=>e.id===g.pilot);if(s.status==='playing'&&(!p||p.team!==0||p.type!=='ranger'||p.manual!==true))throw Error('驾驶员不存在');
 if(s.entities.some(e=>e.manual===true&&e.id!==g.pilot))throw Error('驾驶员重复');return {...G.clone(g),sim:s};}
root.Cockpit={weakpoint,tacticalDamage,pick,resolveShot,create,pilot,target,allies,sight,aim,shoot,command,step,validate,free,wrap};
})(globalThis);
