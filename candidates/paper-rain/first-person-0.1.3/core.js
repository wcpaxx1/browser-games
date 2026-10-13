/* Original deterministic rules and common world geometry. No DOM dependency. */
(function(root){
'use strict';
const V='0.1.3', ROUND=30, ROOM={minX:-4.7,maxX:4.7,minZ:-1.6,maxZ:9.5}, EYE=1.6;
const NEAR=.06, DEFAULT_VIEWPORT={width:1440,height:900};
const TARGET={x:0,y:2.3,z:12,r:1.9}, REACH=2.05, CONE=Math.cos(43*Math.PI/180);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const finite=(n,a,b)=>typeof n==='number'&&Number.isFinite(n)&&n>=a&&n<=b;
const integer=(n,a,b)=>Number.isInteger(n)&&finite(n,a,b);
const copy=v=>JSON.parse(JSON.stringify(v));
function forward(p){const c=Math.cos(p.pitch);return {x:Math.sin(p.yaw)*c,y:Math.sin(p.pitch),z:Math.cos(p.yaw)*c};}
function camera(p){const f=forward(p),r={x:Math.cos(p.yaw),y:0,z:-Math.sin(p.yaw)},u={x:-Math.sin(p.yaw)*Math.sin(p.pitch),y:Math.cos(p.pitch),z:-Math.cos(p.yaw)*Math.sin(p.pitch)};return {f,r,u};}
// Shared CSS-pixel lens and physical-ball disk. Sprite padding is decorative, never hit area.
function lens(width=DEFAULT_VIEWPORT.width,height=DEFAULT_VIEWPORT.height){return {width,height,focal:Math.min(height*.88,width*1.3),cx:width/2,cy:height*.49,near:NEAR};}
function setViewport(s,width,height){if(finite(width,1,20000)&&finite(height,1,20000))s.viewport={width,height};}
function ballProjection(p,b,viewport=DEFAULT_VIEWPORT){if(!b)return null;const {width,height}=viewport||DEFAULT_VIEWPORT,L=lens(width,height),{f,r,u}=camera(p),x=b.x-p.x,y=b.y-EYE,z=b.z-p.z,depth=x*f.x+y*f.y+z*f.z;if(depth<=L.near)return null;return {x:L.cx+(x*r.x+y*r.y+z*r.z)*L.focal/depth,y:L.cy-(x*u.x+y*u.y+z*u.z)*L.focal/depth,r:L.focal*b.r/depth,depth,width,height};}
function visibleBall(p,b,viewport=DEFAULT_VIEWPORT){const q=ballProjection(p,b,viewport);if(!q)return false;const dx=Math.max(0,-q.x,q.x-q.width),dy=Math.max(0,-q.y,q.y-q.height);return dx*dx+dy*dy<q.r*q.r*(1-1e-10);}
function relative(p,b){const x=b.x-p.x,y=b.y-EYE,z=b.z-p.z,dist=Math.hypot(x,y,z),f=forward(p);return {dist,dot:dist?((x*f.x+y*f.y+z*f.z)/dist):1};}
function reachable(p,b,guard=false,viewport=DEFAULT_VIEWPORT){if(!b||!['waiting','incoming'].includes(b.kind)||!visibleBall(p,b,viewport))return false;const q=relative(p,b);return q.dist<=(guard?2.25:REACH)+b.r&&q.dot>=(guard?.46:CONE);}
function initial(seed=120713){return {viewport:{...DEFAULT_VIEWPORT},phase:'ready',t:0,seed:seed>>>0,player:{x:0,z:0,yaw:0,pitch:.045},ball:null,sequence:0,spawnAt:0,score:0,misses:0,blocks:0,swings:0,lastSwing:-10,lastAction:{kind:'none',at:-10},flowers:[],events:[],won:false};}
function start(s){if(s.phase==='ready'){s.phase='playing';s.ball={kind:'waiting',x:-.48,y:1.65,z:1.98,vx:0,vy:0,vz:0,r:.24,id:0};s.sequence=1;s.spawnAt=Infinity;}return s;}
function event(s,kind,extra={}){const ev={kind,t:s.t,...extra};s.events.push(ev);if(s.events.length>24)s.events.shift();return ev;}
function aimPoint(p){const f=forward(p);if(f.z>.025){const q=(TARGET.z-p.z)/f.z;return {x:p.x+f.x*q,y:EYE+f.y*q,z:TARGET.z};}return {x:p.x+f.x*20,y:EYE+f.y*20,z:p.z+f.z*20};}
function strike(s){if(s.phase!=='playing')return {kind:'ignored'};if(s.t-s.lastSwing<.28-1e-8)return {kind:'cooldown'};s.lastSwing=s.t;s.swings++;s.lastAction={kind:'swing',at:s.t};const b=s.ball;if(!reachable(s.player,b,false,s.viewport))return event(s,'empty');const a=aimPoint(s.player),dx=a.x-b.x,dy=a.y-b.y,dz=a.z-b.z,n=Math.hypot(dx,dy,dz)||1;b.kind='returned';b.vx=dx/n*14;b.vy=dy/n*14;b.vz=dz/n*14;s.lastAction={kind:'hit',at:s.t};return event(s,'contact',{id:b.id});}
function block(s){if(s.phase!=='playing'||!reachable(s.player,s.ball,true,s.viewport))return false;const b=s.ball;b.kind='blocked';b.vx=b.x<=s.player.x?-4:4;b.vy=3;b.vz=2.5;s.blocks++;s.lastAction={kind:'block',at:s.t};event(s,'block',{id:b.id});return true;}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function spawn(s){const i=s.sequence++,side=i%2?-1:1;const offset=i<3?1.85:1.7+random(s)*.7;const x=clamp(s.player.x+side*offset,-4.2,4.2),z=Math.min(10.5,s.player.z+6.5);s.ball={kind:'incoming',x,y:1.57+(i<3?0:(random(s)-.5)*.24),z,vx:0,vy:0,vz:-(i<3?2.05:2.3),r:.24,id:i};s.spawnAt=Infinity;event(s,'spawn',{id:i,side});}
function remove(s,kind){event(s,kind,{id:s.ball.id});s.ball=null;s.spawnAt=s.t+.55;}
function miss(s,kind='miss'){s.misses++;s.lastAction={kind:'miss',at:s.t};remove(s,kind);}
function step(s,dt,held={}){
 if(s.phase!=='playing'||!finite(dt,0,.05))return;
 let remaining=ROUND-s.t;dt=Math.min(dt,remaining);s.t+=dt;
 const p=s.player;let side=(held.ArrowRight?1:0)-(held.ArrowLeft?1:0),ahead=(held.ArrowUp?1:0)-(held.ArrowDown?1:0);const n=Math.hypot(side,ahead)||1;
 p.x=clamp(p.x+(Math.cos(p.yaw)*side+Math.sin(p.yaw)*ahead)/n*3.2*dt,ROOM.minX,ROOM.maxX);
 p.z=clamp(p.z+(-Math.sin(p.yaw)*side+Math.cos(p.yaw)*ahead)/n*3.2*dt,ROOM.minZ,ROOM.maxZ);
 if(!s.ball&&s.t>=s.spawnAt)spawn(s);
 const b=s.ball;
 if(b){if(held.guard)block(s);
  if(b.kind!=='waiting'){
   const prev={x:b.x,y:b.y,z:b.z};b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;
   if(b.kind==='returned'){
    // Swept collision against the exact rendered target plane, never screen-space clamping.
    if(prev.z<TARGET.z&&b.z>=TARGET.z){const f=(TARGET.z-prev.z)/(b.z-prev.z),x=prev.x+(b.x-prev.x)*f,y=prev.y+(b.y-prev.y)*f;if(Math.hypot(x-TARGET.x,y-TARGET.y)<=TARGET.r-b.r*.2){s.score++;s.flowers.push({x,y,t:s.t});if(s.flowers.length>6)s.flowers.shift();s.lastAction={kind:'score',at:s.t};remove(s,'score');}else miss(s,'wide');}
    else if(Math.abs(b.x)>7||b.z<-3||b.z>14||b.y<-.6||b.y>7)miss(s,'wide');
   }else if(b.kind==='incoming'&&(b.z<p.z-.55||b.z<-2))miss(s);
   else if(b.kind==='blocked'&&(Math.abs(b.x)>5.5||b.y>5||b.z>12))remove(s,'safe');
  }
 }
 s.flowers=s.flowers.filter(f=>s.t-f.t<4);
 if(s.t>=ROUND-1e-9){s.t=ROUND;s.phase='over';s.won=s.score>=3;s.ball=null;event(s,'over');}
}
function look(s,dx,dy){if(s.phase!=='playing'||!finite(dx,-10000,10000)||!finite(dy,-10000,10000))return;s.player.yaw=((s.player.yaw+dx*.0028+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;s.player.pitch=clamp(s.player.pitch-dy*.0028,-1.05,1.05);}
function pause(s){if(s.phase==='playing'){s.phase='paused';event(s,'pause');}}
function resume(s){if(s.phase==='paused'){s.phase='playing';event(s,'resume');}}
function snapshot(s){return {t:s.t,seed:s.seed,player:copy(s.player),ball:s.ball?copy(s.ball):null,sequence:s.sequence,spawnAt:Number.isFinite(s.spawnAt)?s.spawnAt:null,score:s.score,misses:s.misses,blocks:s.blocks,swings:s.swings,lastSwing:s.lastSwing};}
function validRun(r){if(!r||typeof r!=='object'||Array.isArray(r))return false;const p=r.player;if(!p||!finite(p.x,ROOM.minX,ROOM.maxX)||!finite(p.z,ROOM.minZ,ROOM.maxZ)||!finite(p.yaw,-Math.PI,Math.PI)||!finite(p.pitch,-1.05,1.05))return false;
 if(!finite(r.t,0,ROUND)||!integer(r.seed,0,4294967295)||!integer(r.sequence,1,100)||!(r.spawnAt===null||finite(r.spawnAt,0,31))||!integer(r.score,0,100)||!integer(r.misses,0,100)||!integer(r.blocks,0,100)||!integer(r.swings,0,200)||!finite(r.lastSwing,-10,30))return false;
 if(r.lastSwing>r.t)return false;
 if(r.ball){const b=r.ball;if(!['waiting','incoming','returned','blocked'].includes(b.kind)||!finite(b.x,-8,8)||!finite(b.y,-1,8)||!finite(b.z,-4,15)||!finite(b.vx,-14,14)||!finite(b.vy,-14,14)||!finite(b.vz,-14,14)||b.r!==.24||!integer(b.id,0,100))return false;}else if(r.spawnAt===null&&r.t<ROUND)return false;
 return true;}
function restore(r){if(!validRun(r))throw Error('Invalid checkpoint');const s=initial(r.seed);for(const k of ['t','seed','sequence','score','misses','blocks','swings','lastSwing'])s[k]=r[k];s.player={x:r.player.x,z:r.player.z,yaw:r.player.yaw,pitch:r.player.pitch};if(r.ball){s.ball={};for(const k of ['kind','x','y','z','vx','vy','vz','r','id'])s.ball[k]=r.ball[k];}s.spawnAt=r.spawnAt===null?Infinity:r.spawnAt;s.phase=r.t>=ROUND?'over':'paused';s.won=s.score>=3;return s;}
const api={V,ROUND,ROOM,EYE,NEAR,DEFAULT_VIEWPORT,lens,setViewport,ballProjection,visibleBall,TARGET,REACH,CONE,clamp,finite,integer,initial,start,step,strike,block,look,pause,resume,forward,camera,relative,reachable,aimPoint,snapshot,validRun,restore};if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
