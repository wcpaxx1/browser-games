(function(root,factory){if(typeof module==='object')module.exports=factory();else root.RelayDirect=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const WIDTH=960,HEIGHT=620,KEY='relay-zero:fp-simple:profile',VERSION=1,ROUND_TIME=90;
const COVER=[{x:335,y:200,w:32,h:45,height:86},{x:335,y:375,w:32,h:45,height:86}];
const EYE=56,DRONE_Z=68,FOV=110*Math.PI/180,PLANE=WIDTH/(2*Math.tan(FOV/2)),HORIZON=HEIGHT*.46,BARRIER=390;
const SPAWNS=[{x:640,y:110},{x:800,y:260},{x:800,y:360},{x:640,y:510}];
const EXIT={x:864,y:310,r:42};
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const finite=(n,lo,hi)=>typeof n==='number'&&Number.isFinite(n)&&n>=lo&&n<=hi;
const integer=(n,lo,hi)=>Number.isInteger(n)&&finite(n,lo,hi);
function blocked(x,y,r=17){return x-r<36||y-r<36||x+r>WIDTH-36||y+r>HEIGHT-36||COVER.some(b=>x+r>b.x&&x-r<b.x+b.w&&y+r>b.y&&y-r<b.y+b.h);}
function move(p,dx,dy,locked=false){if(!blocked(p.x+dx,p.y)&&(!locked||p.x+dx<=BARRIER))p.x+=dx;if(!blocked(p.x,p.y+dy)&&(!locked||(p.y+dy>=200&&p.y+dy<=420)))p.y+=dy;}
function project(p,x,y,z=DRONE_Z){let depth=x-p.x;if(depth<=1)return null;return {x:WIDTH/2+(y-p.y)*PLANE/depth,y:HORIZON+(EYE-z)*PLANE/depth,scale:PLANE/depth,depth};}
function aimForScreen(u,v){let a=Math.atan((u-WIDTH/2)/PLANE);return {aimAngle:a,aimPitch:Math.atan((HORIZON-v)*Math.cos(a)/PLANE)};}
function segmentSphere(b,nx,ny,nz,c,r){const dx=nx-b.x,dy=ny-b.y,dz=nz-b.z,ox=b.x-c.x,oy=b.y-c.y,oz=b.z-c.z,aa=dx*dx+dy*dy+dz*dz,cc=ox*ox+oy*oy+oz*oz-r*r;if(cc<=0)return 0;if(aa===0)return null;let bb=2*(ox*dx+oy*dy+oz*dz),disc=bb*bb-4*aa*cc;if(disc<0)return null;let t=(-bb-Math.sqrt(disc))/(2*aa);return t>=0&&t<=1?t:null;}
function segmentBox(x,y,nx,ny,b){let lo=0,hi=1,dx=nx-x,dy=ny-y;for(const [p,q] of [[-dx,x-b.x],[dx,b.x+b.w-x],[-dy,y-b.y],[dy,b.y+b.h-y]]){if(Math.abs(p)<1e-10){if(q<0)return null;}else{let t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}}return lo;}
function segmentCircle(x,y,nx,ny,c,r){let dx=nx-x,dy=ny-y,a=dx*dx+dy*dy,ox=x-c.x,oy=y-c.y;if(ox*ox+oy*oy<=r*r)return 0;if(a===0)return null;let b=2*(ox*dx+oy*dy),det=b*b-4*a*(ox*ox+oy*oy-r*r);if(det<0)return null;let t=(-b-Math.sqrt(det))/(2*a);return t>=0&&t<=1?t:null;}
function sight(a,b){return !COVER.some(box=>segmentBox(a.x,a.y,b.x,b.y,box)!==null);}
function create(){return {state:'ready',time:ROUND_TIME,elapsed:0,player:{x:250,y:310,hp:5,a:0,pitch:0,invuln:0,shield:0,shieldCool:0},ammo:8,reload:0,cool:0,kills:0,shots:0,hits:0,secure:0,enemies:SPAWNS.map((p,i)=>({id:i,x:p.x,y:p.y,hp:3,cool:2.7+i*.4,aim:0})),bullets:[],effects:[],events:[],reason:''};}
function resume(s){if(s.state==='ready'||s.state==='paused')s.state='active';}
function pause(s){if(s.state==='active')s.state='paused';}
function end(s,state,reason){if(s.state!=='active')return;s.state=state;s.reason=reason;s.events.push({type:state});}
function fire(s){if(s.state!=='active'||s.cool>0||s.reload>0||s.ammo===0)return false;const p=s.player;s.cool=.15;s.ammo--;s.shots++;s.bullets.push({x:p.x+Math.cos(p.a)*22,y:p.y+Math.sin(p.a)*22,z:EYE+Math.tan(p.pitch)*22,vx:Math.cos(p.a)*Math.cos(p.pitch)*850,vy:Math.sin(p.a)*Math.cos(p.pitch)*850,vz:Math.sin(p.pitch)*850,owner:0,life:1.5});s.events.push({type:'shot'});if(s.ammo===0)s.reload=.7;return true;}
function shield(s){let p=s.player;if(s.state!=='active'||p.shieldCool>0)return false;p.shield=1.6;p.shieldCool=5.5;s.events.push({type:'shield'});return true;}
function step(s,input={},dt=1/60){s.events=[];if(s.state!=='active')return;dt=clamp(Number.isFinite(dt)?dt:0,0,.05);if(!dt)return;s.time=Math.max(0,s.time-dt);s.elapsed+=dt;
const p=s.player;for(const k of ['invuln','shield','shieldCool'])p[k]=Math.max(0,p[k]-dt);s.cool=Math.max(0,s.cool-dt);if(s.reload>0){s.reload=Math.max(0,s.reload-dt);if(s.reload===0){s.ammo=8;s.events.push({type:'reload'});}}
let dx=clamp(input.x||0,-1,1),dy=clamp(input.y||0,-1,1),length=Math.max(1,Math.hypot(dx,dy));move(p,-dy/length*190*dt,dx/length*190*dt,s.kills<4);
if(finite(input.aimX,-2000,3000)&&finite(input.aimY,-2000,3000)&&Math.hypot(input.aimX-p.x,input.aimY-p.y)>1)p.a=Math.atan2(input.aimY-p.y,input.aimX-p.x);
if(finite(input.aimAngle,-Math.PI,Math.PI))p.a=input.aimAngle;if(finite(input.aimPitch,-1.4,1.4))p.pitch=input.aimPitch;
if(input.shield)shield(s);if(input.fire)fire(s);
for(const e of s.enemies){if(e.hp<=0)continue;e.cool=Math.max(0,e.cool-dt);if(e.cool<.8)e.aim=Math.atan2(p.y-e.y,p.x-e.x);if(e.cool===0){e.cool=2.5;if(sight(e,p)){s.bullets.push({x:e.x+Math.cos(e.aim)*26,y:e.y+Math.sin(e.aim)*26,z:DRONE_Z,vx:Math.cos(e.aim)*190,vy:Math.sin(e.aim)*190,vz:(EYE-DRONE_Z)/Math.hypot(p.x-e.x,p.y-e.y)*190,owner:1,life:6});s.events.push({type:'enemy-shot',x:e.x,y:e.y});}}}
const keep=[];for(const b of s.bullets){let nx=b.x+b.vx*dt,ny=b.y+b.vy*dt,nz=b.z+b.vz*dt,first=1.01,target=null;b.life-=dt;
for(const box of COVER){let t=segmentBox(b.x,b.y,nx,ny,box);if(t!==null&&t<first&&b.z+(nz-b.z)*t<=box.height&&b.z+(nz-b.z)*t>=0){first=t;target='wall';}}
if(b.owner===0){for(const e of s.enemies){if(e.hp<=0)continue;let t=segmentSphere(b,nx,ny,nz,{x:e.x,y:e.y,z:DRONE_Z},35);if(t!==null&&t<first){first=t;target=e;}}}else{let t=segmentSphere(b,nx,ny,nz,{x:p.x,y:p.y,z:EYE},p.shield>0?33:18);if(t!==null&&t<first){first=t;target=p;}}
if(first<=1){let x=b.x+(nx-b.x)*first,y=b.y+(ny-b.y)*first;s.effects.push({x,y,z:b.z+(nz-b.z)*first,life:.28,type:b.owner?'red':'gold'});
if(target&&target!=='wall'){if(b.owner===0){target.hp--;s.hits++;s.events.push({type:'hit',x:target.x,y:target.y});if(target.hp===0){s.kills++;p.hp=Math.min(5,p.hp+1);s.effects.push({x:target.x,y:target.y,z:DRONE_Z,life:.7,type:'burst'});s.events.push({type:'down',x:target.x,y:target.y});}}
else if(p.shield>0){s.events.push({type:'blocked'});}else if(p.invuln===0){p.hp=Math.max(0,p.hp-1);p.invuln=.9;s.events.push({type:'hurt'});}}
}else if(b.life>0&&nx>30&&nx<WIDTH-30&&ny>30&&ny<HEIGHT-30&&nz>0&&nz<300){b.x=nx;b.y=ny;b.z=nz;keep.push(b);}}
s.bullets=keep;s.effects=s.effects.filter(e=>(e.life-=dt)>0);
if(p.hp<=0){end(s,'lost','护盾耗尽');return;}if(s.time<=0){end(s,'lost','时间到');return;}
if(s.kills===4){s.bullets=s.bullets.filter(b=>b.owner===0);if(Math.hypot(p.x-EXIT.x,p.y-EXIT.y)<EXIT.r-7){s.secure=Math.min(.12,s.secure+dt);if(s.secure>=.12)end(s,'won','中继夺回');}else s.secure=0;}}
function snapshot(s){if(!['active','paused'].includes(s.state))return null;return {state:'paused',time:s.time,elapsed:s.elapsed,player:{x:s.player.x,y:s.player.y,hp:s.player.hp,a:s.player.a,pitch:s.player.pitch,invuln:s.player.invuln,shield:s.player.shield,shieldCool:s.player.shieldCool},ammo:s.ammo,reload:s.reload,cool:s.cool,kills:s.kills,shots:s.shots,hits:s.hits,secure:s.secure,enemies:s.enemies.map(e=>({...e})),bullets:s.bullets.map(b=>({...b})),effects:[],events:[],reason:''};}
function validRound(s){return !!(s&&s.state==='paused'&&finite(s.time,.000001,ROUND_TIME)&&finite(s.elapsed,0,ROUND_TIME)&&Math.abs(s.time+s.elapsed-ROUND_TIME)<.001&&s.player&&finite(s.player.x,53,907)&&finite(s.player.y,53,567)&&!blocked(s.player.x,s.player.y)&&integer(s.player.hp,1,5)&&finite(s.player.a,-Math.PI,Math.PI)&&finite(s.player.pitch,-1.4,1.4)&&(s.kills===4||(s.player.x<=BARRIER&&s.player.y>=200&&s.player.y<=420))&&finite(s.player.invuln,0,.9)&&finite(s.player.shield,0,1.6)&&finite(s.player.shieldCool,0,5.5)&&integer(s.ammo,0,8)&&finite(s.reload,0,.7)&&(s.ammo===0?s.reload>0:s.reload===0)&&finite(s.cool,0,.15)&&integer(s.kills,0,4)&&integer(s.shots,0,650)&&integer(s.hits,0,12)&&s.hits<=s.shots&&finite(s.secure,0,.12)&&Array.isArray(s.enemies)&&s.enemies.length===4&&s.enemies.every((e,i)=>e&&e.id===i&&e.x===SPAWNS[i].x&&e.y===SPAWNS[i].y&&integer(e.hp,0,3)&&finite(e.cool,0,4)&&finite(e.aim,-Math.PI,Math.PI))&&s.kills===s.enemies.filter(e=>e.hp===0).length&&s.hits===12-s.enemies.reduce((n,e)=>n+e.hp,0)&&Array.isArray(s.bullets)&&s.bullets.length<=60&&s.bullets.every(b=>b&&finite(b.x,0,WIDTH)&&finite(b.y,0,HEIGHT)&&finite(b.vx,-850,850)&&finite(b.vy,-850,850)&&finite(b.z,0,300)&&finite(b.vz,-850,850)&&[0,1].includes(b.owner)&&finite(b.life,0,6))&&Array.isArray(s.effects)&&s.effects.length===0&&Array.isArray(s.events)&&s.events.length===0&&s.reason==='');}
function defaults(){return {wins:0,attempts:0,best:null,muted:false,round:null};}
function validProfile(p){return !!(p&&integer(p.wins,0,1e6)&&integer(p.attempts,p.wins,1e6)&&(p.best===null||finite(p.best,.001,ROUND_TIME))&&typeof p.muted==='boolean'&&(p.round===null||(p.attempts>p.wins&&validRound(p.round))));}
return {WIDTH,HEIGHT,KEY,VERSION,ROUND_TIME,COVER,SPAWNS,EXIT,EYE,DRONE_Z,FOV,PLANE,HORIZON,BARRIER,project,aimForScreen,segmentSphere,create,resume,pause,step,fire,shield,move,blocked,sight,segmentBox,segmentCircle,snapshot,validRound,defaults,validProfile};
});
