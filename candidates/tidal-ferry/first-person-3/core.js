/* Original direct-play ferry simulation. Fixed-step world geometry; first-person view uses identical world units. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.DirectFerry=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const SEED=0x54494432,BOAT_R=.042,SPEED=.60;
const LEVELS=Object.freeze([
 {spawn:[.10,.65],pickup:[.27,.58],goal:[.83,.36],buoys:[],flow:null},
 {spawn:[.10,.77],pickup:[.25,.72],goal:[.84,.26],buoys:[[.52,.54,.067]],flow:{x:.38,y:.27,w:.22,h:.48,vx:0,vy:.15}},
 {spawn:[.10,.76],pickup:[.25,.70],goal:[.86,.24],buoys:[[.52,.52,.065],[.71,.35,.061]],flow:{x:.35,y:.37,w:.42,h:.29,vx:.16,vy:0}}
].map(l=>Object.freeze(l)));
function create(round=0,aspect=1.6){if(!Number.isInteger(round)||round<0||round>2)throw Error('round');if(!Number.isFinite(aspect)||aspect<=0||!Number.isFinite(1/aspect))throw Error('aspect');const p=LEVELS[round].spawn;return {phase:'play',prior:null,round,delivered:round,x:p[0],y:p[1],vx:0,vy:0,angle:Math.atan2((LEVELS[round].pickup[1]-p[1])*(aspect>=1?1:1/aspect),(LEVELS[round].pickup[0]-p[0])*(aspect>=1?aspect:1)),control:'helm',carried:false,lives:3,invulnerable:0,flash:0,event:'ready',eventId:0,target:null,age:0,celebrate:0,aspect};}
function dimensions(s){return s.aspect>=1?{w:s.aspect,h:1}:{w:1,h:1/s.aspect};}
function distance(s,x,y){const d=dimensions(s);return Math.hypot((s.x-x)*d.w,(s.y-y)*d.h);}
function command(s,a){if(a.type==='retry')return create(s.round,s.aspect);if(a.type==='restart')return create(0,s.aspect);if(a.type==='resize'){if(!Number.isFinite(a.aspect)||a.aspect<=0||!Number.isFinite(1/a.aspect))return s;return {...s,aspect:a.aspect};}if(a.type==='pause'&&['play','roundWon'].includes(s.phase))return {...s,prior:s.phase,phase:'paused',target:null,vx:0,vy:0};if(a.type==='resume'&&s.phase==='paused')return {...s,phase:s.prior,prior:null};if(s.phase!=='play')return s;if(a.type==='target'&&Number.isFinite(a.x)&&Number.isFinite(a.y))return {...s,control:'target',target:{x:Math.max(0,Math.min(1,a.x)),y:Math.max(0,Math.min(1,a.y))}};if(a.type==='stop')return {...s,target:null,vx:0,vy:0};return s;}
function step(s,input={},dt=1/120){if(!Number.isFinite(dt)||dt<=0||dt>1/30)return s;if(!['play','roundWon'].includes(s.phase))return s;let n={...s,event:null,eventId:s.eventId,age:s.age+dt};if(s.phase==='roundWon'){n.celebrate-=dt;if(n.celebrate<=0){n=create(s.round+1,s.aspect);n.event='next';n.eventId=s.eventId+1;}return n;}
 const l=LEVELS[s.round],d=dimensions(s);n.invulnerable=Math.max(0,s.invulnerable-dt);n.flash=Math.max(0,s.flash-dt);
 let dx=Number.isFinite(input.x)?Math.max(-1,Math.min(1,input.x)):0,dy=Number.isFinite(input.y)?Math.max(-1,Math.min(1,input.y)):0,speed=SPEED;const turn=Number.isFinite(input.turn)?Math.max(-1,Math.min(1,input.turn)):0,thrust=Number.isFinite(input.thrust)?Math.max(-1,Math.min(1,input.thrust)):0;if(turn||thrust){n.control='helm';n.target=null;n.angle=Math.atan2(Math.sin(n.angle+turn*1.8*dt),Math.cos(n.angle+turn*1.8*dt));dx=Math.cos(n.angle)*thrust;dy=Math.sin(n.angle)*thrust;}else if(dx||dy)n.control='vector';
 if(input.brake){n.target=null;dx=dy=0;}else if(dx||dy)n.target=null;else if(n.target){dx=(n.target.x-n.x)*d.w;dy=(n.target.y-n.y)*d.h;const dist=Math.hypot(dx,dy);if(dist<.015){n.target=null;dx=dy=0;}else speed=Math.min(SPEED,dist*3.8);}
 let len=Math.hypot(dx,dy);if(len>0){dx/=len;dy/=len;}
 const response=1-Math.exp(-(input.brake?28:9)*dt);n.vx+=(dx*speed-n.vx)*response;n.vy+=(dy*speed-n.vy)*response;
 let fx=0,fy=0;const flow=l.flow;if(flow&&n.x>flow.x&&n.x<flow.x+flow.w&&n.y>flow.y&&n.y<flow.y+flow.h&&!input.brake){fx=flow.vx;fy=flow.vy;}
 n.x+=(n.vx+fx)*dt/d.w;n.y+=(n.vy+fy)*dt/d.h;
 const margin=BOAT_R+.014;n.x=Math.max(margin/d.w,Math.min(1-margin/d.w,n.x));n.y=Math.max(margin/d.h,Math.min(1-margin/d.h,n.y));
 if(n.control!=='helm'&&Math.hypot(n.vx,n.vy)>.06){const desired=Math.atan2(n.vy,n.vx);let delta=Math.atan2(Math.sin(desired-n.angle),Math.cos(desired-n.angle));n.angle+=delta*Math.min(1,dt*12);}
 for(const [x,y,r]of l.buoys){const ox=(n.x-x)*d.w,oy=(n.y-y)*d.h,dist=Math.hypot(ox,oy),hit=r+BOAT_R;if(dist<hit){const nx=dist>1e-8?ox/dist:1,ny=dist>1e-8?oy/dist:0;n.x=x+nx*(hit+.001)/d.w;n.y=y+ny*(hit+.001)/d.h;n.vx=nx*.24;n.vy=ny*.24;n.target=null;if(n.invulnerable===0){n.lives--;n.flash=.45;n.invulnerable=1;n.event='hit';n.eventId++;if(n.lives<=0){n.phase='lost';n.vx=n.vy=0;return n;}}}}
 if(!n.carried&&distance(n,l.pickup[0],l.pickup[1])<.099){n.carried=true;n.event='pickup';n.eventId++;}
 if(n.carried&&distance(n,l.goal[0],l.goal[1])<.105){n.delivered=n.round+1;n.carried=false;n.event='delivery';n.eventId++;n.target=null;n.vx=n.vy=0;n.celebrate=.75;n.phase=n.round===2?'won':'roundWon';}
 return n;
}
return {SEED,BOAT_R,SPEED,LEVELS,create,command,step,dimensions,distance};
});
