/* Three spatial views for Relay Zero. Original code, no runtime dependencies.
 * The camera uses the same occupied cells as movement and bullets. It never
 * mutates the simulation or its save format. Coordinates: x/y ground, z up. */
(function(root,factory){if(typeof module==='object')module.exports=factory();else root.RelayView=factory();})(globalThis,function(){
'use strict';
const VERSION=1,KEY='relay-zero:breach:camera:v1';
const PRESETS=Object.freeze({first:Object.freeze({label:'第一人称',distance:0,side:0,lift:0}),near:Object.freeze({label:'近距跟随',distance:1.1,side:.44,lift:.32}),far:Object.freeze({label:'远距跟随',distance:2.8,side:.50,lift:.62})});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),norm=a=>Math.atan2(Math.sin(a),Math.cos(a));
function valid(p){return !!p&&Object.hasOwn(PRESETS,p.mode);}
function resolve(C,p,mode='first',yaw=p.a,pitch=p.pitch,{eye=C.EYE}={}){
 const preset=PRESETS[mode]||PRESETS.first,ca=Math.cos(yaw),sa=Math.sin(yaw),dx=-ca*preset.distance-sa*preset.side,dy=-sa*preset.distance+ca*preset.side,total=Math.hypot(dx,dy);let fraction=1;
 // Swept 12 cm camera clearance, including diagonal corner checks. No tunnel
 // through a thin occupied cell, even after a large turn or view switch.
 if(total>0){fraction=0;const n=Math.ceil(total/.035);for(let i=1;i<=n;i++){const t=i/n;if(!C.clear(p.x+dx*t,p.y+dy*t,.12))break;fraction=t;}}
 const distance=preset.distance*fraction;
 return {mode:Object.hasOwn(PRESETS,mode)?mode:'first',x:p.x+dx*fraction,y:p.y+dy*fraction,z:eye+preset.lift*fraction,a:yaw,pitch,boom:total*fraction,back:distance,fraction,clipped:fraction<.999,avatar:mode!=='first'&&distance>.42,avatarAlpha:clamp((distance-.42)/.34,0,1),fov:82};
}
function project(camera,point,plane=960/(2*Math.tan(82*Math.PI/360))){const dx=point.x-camera.x,dy=point.y-camera.y,f=dx*Math.cos(camera.a)+dy*Math.sin(camera.a),r=-dx*Math.sin(camera.a)+dy*Math.cos(camera.a);return f>.04?{x:480+r/f*plane,y:310+Math.tan(camera.pitch)*plane+(camera.z-point.z)/f*plane,d:f,scale:plane/f}:null;}
function bodyHit(origin,a,pitch,target,limit){const dx=target.x-origin.x,dy=target.y-origin.y,along=dx*Math.cos(a)+dy*Math.sin(a),perp=dx*Math.sin(a)-dy*Math.cos(a),radius=.29;if(along<=0||Math.abs(perp)>radius)return null;const distance=Math.max(0,along-Math.sqrt(radius*radius-perp*perp));if(distance>limit)return null;const z=origin.z+Math.tan(pitch)*distance;return z>=.1&&z<=1.7?distance:null;}
function hitPoint(C,origin,a,pitch,enemies=[]){let distance=C.cast(origin.x,origin.y,a).d;for(const e of enemies){if(e.hp<=0)continue;const hit=bodyHit(origin,a,pitch,e,distance);if(hit!==null)distance=hit;}return {x:origin.x+Math.cos(a)*distance,y:origin.y+Math.sin(a)*distance,z:origin.z+Math.tan(pitch)*distance,distance};}
function aim(C,p,enemies,camera,{yaw=p.a,pitch=p.pitch,u=0,v=0,fallback=false,recoil=p.recoil,plane=960/(2*Math.tan(82*Math.PI/360))}={}){
 let a=yaw,shotPitch=clamp(pitch+recoil,-.8,.8),limited=false;
 if(fallback){const rawX=480+u*480,rawY=310+v*310,x=clamp(rawX,20,940),y=clamp(rawY,20,600),delta=Math.atan((x-480)/plane),rayPitch=Math.atan((310+Math.tan(pitch)*plane-y)*Math.cos(delta)/plane),target=hitPoint(C,camera,norm(yaw+delta),rayPitch,enemies),dx=target.x-p.x,dy=target.y-p.y,baseYaw=Math.atan2(dy,dx),d=Math.hypot(dx,dy),basePitch=Math.atan2(target.z-C.EYE,d),yawOffset=norm(baseYaw-yaw),safeYaw=clamp(yawOffset,-1.12,1.12);a=norm(yaw+safeYaw);shotPitch=clamp(basePitch+recoil,-.8,.8);limited=x!==rawX||y!==rawY||safeYaw!==yawOffset||shotPitch!==basePitch+recoil;}
 // The visible reticle is the actual muzzle ray's first impact, not a ray
 // fired from the camera. Nearby cover still blocks bullets in every view.
 const hit=hitPoint(C,{x:p.x,y:p.y,z:C.EYE},a,shotPitch,enemies),q=project(camera,hit,plane),x=q?clamp(q.x,20,940):480,y=q?clamp(q.y,20,600):310;
 return {a,pitch:shotPitch,x,y,plane,limited:limited||!q||x!==q.x||y!==q.y,hit,offscreen:!q||x!==q.x||y!==q.y,cameraMode:camera.mode};
}
return {VERSION,KEY,PRESETS,valid,resolve,project,hitPoint,aim};
});
