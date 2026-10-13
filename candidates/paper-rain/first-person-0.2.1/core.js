/* Original deterministic rules and common world geometry. No DOM dependency. */
(function(root){
'use strict';
const V='0.2.1', ROUND=30, ROOM={minX:-4.7,maxX:4.7,minZ:-1.6,maxZ:9.5}, EYE=1.6;
const NEAR=.06, DEFAULT_VIEWPORT={width:1440,height:900};
const TARGET={x:0,y:2.3,z:12,r:1.9}, REACH=2.05, CONE=Math.cos(43*Math.PI/180);
const PADDLE={start:1.40,height:-.12,radius:.28,speed:4.4,duration:.16,restitution:.68,mass:.035};
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
function paddleNormal(p){return {x:Math.sin(p.yaw),y:0,z:Math.cos(p.yaw)};}
function contactGeometry(p,b,n,reach,viewport){if(!b||!visibleBall(p,b,viewport))return null;const x=b.x-p.x,y=b.y-(EYE+PADDLE.height),z=b.z-p.z,d=x*n.x+y*n.y+z*n.z,rx=x-d*n.x,ry=y-d*n.y,rz=z-d*n.z;return {d,radial:Math.hypot(rx,ry,rz),overlap:d+b.r>=reach-1e-8&&d-b.r<=reach+1e-8};}
function reachable(p,b,guard=false,viewport=DEFAULT_VIEWPORT){if(!b||!['waiting','incoming'].includes(b.kind))return false;const n=paddleNormal(p),q=contactGeometry(p,b,n,PADDLE.start,viewport);if(!q||q.radial>PADDLE.radius)return false;const plane=PADDLE.start+(guard?.12:0);return q.d-b.r>=plane-1e-8&&q.d-b.r<=plane+(guard?0:PADDLE.speed*PADDLE.duration)+1e-8;}
function initial(seed=120713,mode='practice'){return {viewport:{...DEFAULT_VIEWPORT},mode:mode==='challenge'?'challenge':'practice',freeLook:false,phase:'ready',t:0,seed:seed>>>0,player:{x:0,z:0,yaw:0,pitch:0},ball:null,stroke:null,lastContact:null,sequence:0,spawnAt:0,score:0,misses:0,blocks:0,swings:0,lastSwing:-10,lastAction:{kind:'none',at:-10},flowers:[],events:[],won:false};}
function start(s){if(s.phase==='ready'){s.phase='playing';s.ball={kind:'waiting',x:0,y:1.60,z:1.64,vx:0,vy:0,vz:0,r:.24,id:0};s.sequence=1;s.spawnAt=Infinity;}return s;}
function event(s,kind,extra={}){const ev={kind,t:s.t,...extra};s.events.push(ev);if(s.events.length>24)s.events.shift();return ev;}
function aimPoint(p){const f=forward(p);if(f.z>.025){const q=(TARGET.z-p.z)/f.z;return {x:p.x+f.x*q,y:EYE+f.y*q,z:TARGET.z};}return {x:p.x+f.x*20,y:EYE+f.y*20,z:p.z+f.z*20};}
// Simplified collision laboratory: no gravity/drag during flight; finite moving paddle,
// infinite paddle mass, restitution in its moving frame, and unchanged tangential velocity.
function impulse(v,n,u,e,mass=PADDLE.mass){const relative=(v.x-u.x)*n.x+(v.y-u.y)*n.y+(v.z-u.z)*n.z;if(relative>=0)return null;const j=-(1+e)*relative;return {velocity:{x:v.x+j*n.x,y:v.y+j*n.y,z:v.z+j*n.z},impulse:mass*j,relative};}
function impact(s,b,n,speed,at=s.t,kind='contact'){const before={x:b.vx,y:b.vy,z:b.vz},u={x:n.x*speed,y:n.y*speed,z:n.z*speed},result=impulse(before,n,u,kind==='block'?.35:PADDLE.restitution);if(!result)return null;const point={x:b.x-n.x*b.r,y:b.y-n.y*b.r,z:b.z-n.z*b.r};b.vx=result.velocity.x;b.vy=result.velocity.y;b.vz=result.velocity.z;b.kind=kind==='block'?'blocked':'returned';const origin=kind==='block'?{x:s.player.x,y:EYE+PADDLE.height,z:s.player.z}:s.stroke?.origin||{x:s.player.x,y:EYE+PADDLE.height,z:s.player.z},depth=(point.x-origin.x)*n.x+(point.y-origin.y)*n.y+(point.z-origin.z)*n.z,paddleCenter={x:origin.x+n.x*depth,y:origin.y+n.y*depth,z:origin.z+n.z*depth};const contact={id:b.id,kind,t:at,point,paddleCenter,normal:{...n},before,after:{...result.velocity},paddleSpeed:speed,restitution:kind==='block'?.35:PADDLE.restitution,mass:PADDLE.mass,impulse:result.impulse};s.lastContact=contact;s.lastAction={kind:kind==='block'?'block':'hit',at};if(kind==='block')s.blocks++;return event(s,kind,{...contact});}
function strike(s){if(s.phase!=='playing')return {kind:'ignored'};if(s.stroke&&s.t-s.stroke.at<PADDLE.duration){s.queuedStrikeUntil=s.t+.12;return {kind:'buffered'};}s.lastSwing=s.t;s.swings++;s.lastAction={kind:'swing',at:s.t};const n=paddleNormal(s.player);s.stroke={at:s.t,origin:{x:s.player.x,y:EYE+PADDLE.height,z:s.player.z},normal:n,speed:PADDLE.speed};const b=s.ball,q=b&&contactGeometry(s.player,b,n,PADDLE.start,s.viewport);if(q&&['waiting','incoming'].includes(b.kind)&&q.overlap&&q.d-b.r>=PADDLE.start-1e-8&&q.radial<=PADDLE.radius){const ev=impact(s,b,n,PADDLE.speed);if(ev)return ev;}return event(s,reachable(s.player,b,false,s.viewport)?'swing':'empty');}
function block(s){if(s.phase!=='playing'||!reachable(s.player,s.ball,true,s.viewport))return false;const b=s.ball,n=paddleNormal(s.player),q=contactGeometry(s.player,b,n,PADDLE.start+.12,s.viewport);if(!q?.overlap||q.d-b.r<PADDLE.start+.12-1e-8)return false;return !!impact(s,b,n,0,s.t,'block');}
function sweepPaddle(s,b,prev,dt,guard=false){
 const stroke=guard?{at:s.t-dt,origin:{x:s.player.x,y:EYE+PADDLE.height,z:s.player.z},normal:paddleNormal(s.player),speed:0}:s.stroke;
 if(!stroke||!['waiting','incoming'].includes(b.kind))return false;
 const a0=Math.max(0,s.t-dt-stroke.at),a1=Math.max(0,s.t-stroke.at);if(!guard&&a0>PADDLE.duration)return false;
 const active=guard?dt:Math.min(dt,PADDLE.duration-a0),n=stroke.normal,o=stroke.origin,d0=PADDLE.start+(guard?.12:stroke.speed*a0),vn=b.vx*n.x+b.vy*n.y+b.vz*n.z,depth=(prev.x-o.x)*n.x+(prev.y-o.y)*n.y+(prev.z-o.z)*n.z,gap=depth-b.r-d0,closing=stroke.speed-vn;
 // A face cannot appear inside/behind a ball after the ball already crossed its start.
 if(closing<=0||gap < -1e-8)return false;const elapsed=Math.max(0,gap/closing);if(elapsed>active)return false;
 const hit={...b,x:prev.x+b.vx*elapsed,y:prev.y+b.vy*elapsed,z:prev.z+b.vz*elapsed},at=s.t-dt+elapsed,plane=d0+stroke.speed*elapsed,x=hit.x-o.x-n.x*plane,y=hit.y-o.y-n.y*plane,z=hit.z-o.z-n.z*plane,tangent=x*n.x+y*n.y+z*n.z,radial=Math.hypot(x-tangent*n.x,y-tangent*n.y,z-tangent*n.z);
 if(radial>PADDLE.radius||!visibleBall(s.player,hit,s.viewport))return false;b.x=hit.x;b.y=hit.y;b.z=hit.z;
 if(!impact(s,b,n,stroke.speed,at,guard?'block':'contact'))return false;const rest=dt-elapsed;b.x+=b.vx*rest;b.y+=b.vy*rest;b.z+=b.vz*rest;return true;
}
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function spawn(s){const i=s.sequence++,side=i%2?-1:1,easy=s.mode!=='challenge',offset=easy?(i<3?.18:.18+random(s)*.05):(i<3?1.10:.85+random(s)*.45),x=clamp(s.player.x+side*offset,-4.2,4.2),z=Math.min(10.5,s.player.z+(easy?3.5:5));s.ball={kind:'incoming',x,y:EYE,z,vx:0,vy:0,vz:-(easy?1.35:2.05),r:.24,id:i};s.spawnAt=Infinity;event(s,'spawn',{id:i,side});}
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
 if(b){
  { // Waiting first ball may also meet an active finite paddle sweep.
   const prev={x:b.x,y:b.y,z:b.z};if(!(held.guard&&sweepPaddle(s,b,prev,dt,true))&&!sweepPaddle(s,b,prev,dt)){b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;}
   if(b.kind==='returned'){
    // Swept collision against the exact rendered target plane, never screen-space clamping.
    if(prev.z<TARGET.z&&b.z>=TARGET.z){const f=(TARGET.z-prev.z)/(b.z-prev.z),x=prev.x+(b.x-prev.x)*f,y=prev.y+(b.y-prev.y)*f;if(Math.hypot(x-TARGET.x,y-TARGET.y)<=TARGET.r-b.r*.2){s.score++;s.flowers.push({x,y,t:s.t});if(s.flowers.length>6)s.flowers.shift();s.lastAction={kind:'score',at:s.t};remove(s,'score');}else miss(s,'wide');}
    else if(Math.abs(b.x)>7||b.z<-3||b.z>14||b.y<-.6||b.y>7)miss(s,'wide');
   }else if(b.kind==='incoming'&&(b.z<p.z-.55||b.z<-2))miss(s);
   else if(b.kind==='blocked'&&(Math.abs(b.x)>5.5||b.y>5||b.z>Math.min(12,p.z+2.5)))remove(s,'safe');
  }
 }
 if(s.stroke&&s.t-s.stroke.at>=PADDLE.duration&&s.queuedStrikeUntil>=s.t){s.stroke=null;s.queuedStrikeUntil=0;strike(s);}if(s.stroke&&s.t-s.stroke.at>.32)s.stroke=null;
 s.flowers=s.flowers.filter(f=>s.t-f.t<4);
 if(s.score>=3||s.t>=ROUND-1e-9){if(s.t>=ROUND-1e-9)s.t=ROUND;s.phase='over';s.won=s.score>=3;s.ball=null;s.stroke=null;s.queuedStrikeUntil=0;event(s,'over');}
}
function look(s,dx,dy){if(s.phase!=='playing'||!finite(dx,-10000,10000)||!finite(dy,-10000,10000))return;s.player.yaw=((s.player.yaw+dx*.00115+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;if(s.freeLook)s.player.pitch=clamp(s.player.pitch-dy*.00115,-.75,.75);else s.player.pitch=0;}
function pause(s){if(s.phase==='playing'){s.phase='paused';s.stroke=null;s.queuedStrikeUntil=0;event(s,'pause');}}
function resume(s){if(s.phase==='paused'){s.phase='playing';event(s,'resume');}}
function snapshot(s){return {physicsVersion:2,mode:s.mode,freeLook:s.freeLook,t:s.t,seed:s.seed,player:copy(s.player),ball:s.ball?copy(s.ball):null,sequence:s.sequence,spawnAt:Number.isFinite(s.spawnAt)?s.spawnAt:null,score:s.score,misses:s.misses,blocks:s.blocks,swings:s.swings,lastSwing:s.lastSwing};}
function validRun(r){if(!r||typeof r!=='object'||Array.isArray(r))return false;const p=r.player;if(!p||!finite(p.x,ROOM.minX,ROOM.maxX)||!finite(p.z,ROOM.minZ,ROOM.maxZ)||!finite(p.yaw,-Math.PI,Math.PI)||!finite(p.pitch,-1.05,1.05))return false;
 if(!finite(r.t,0,ROUND)||!integer(r.seed,0,4294967295)||!integer(r.sequence,1,100)||!(r.spawnAt===null||finite(r.spawnAt,0,31))||!integer(r.score,0,100)||!integer(r.misses,0,100)||!integer(r.blocks,0,100)||!integer(r.swings,0,200)||!finite(r.lastSwing,-10,30))return false;
 if(r.lastSwing>r.t)return false;if(r.physicsVersion!==undefined&&r.physicsVersion!==2)return false;if(r.mode!==undefined&&!['practice','challenge'].includes(r.mode))return false;if(r.freeLook!==undefined&&typeof r.freeLook!=='boolean')return false;
 if(r.ball){const b=r.ball;if(!['waiting','incoming','returned','blocked'].includes(b.kind)||!finite(b.x,-8,8)||!finite(b.y,-1,8)||!finite(b.z,-4,15)||!finite(b.vx,-18,18)||!finite(b.vy,-18,18)||!finite(b.vz,-18,18)||b.r!==.24||!integer(b.id,0,100))return false;}else if(r.spawnAt===null&&r.t<ROUND)return false;
 return true;}
function restore(r){if(!validRun(r))throw Error('Invalid checkpoint');const s=initial(r.seed,r.mode);s.freeLook=r.freeLook===true;for(const k of ['t','seed','sequence','score','misses','blocks','swings','lastSwing'])s[k]=r[k];s.player={x:r.player.x,z:r.player.z,yaw:r.player.yaw,pitch:s.freeLook?r.player.pitch:0};if(r.ball){s.ball={};for(const k of ['kind','x','y','z','vx','vy','vz','r','id'])s.ball[k]=r.ball[k];}s.spawnAt=r.spawnAt===null?Infinity:r.spawnAt;s.phase=r.t>=ROUND||r.score>=3?'over':'paused';s.won=s.score>=3;return s;}
const api={V,ROUND,ROOM,EYE,PADDLE,paddleNormal,contactGeometry,impulse,NEAR,DEFAULT_VIEWPORT,lens,setViewport,ballProjection,visibleBall,TARGET,REACH,CONE,clamp,finite,integer,initial,start,step,strike,block,look,pause,resume,forward,camera,relative,reachable,aimPoint,snapshot,validRun,restore};if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperCore=api;
})(typeof globalThis!=='undefined'?globalThis:this);
