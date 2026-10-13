/* Eye-level ground-plane projection. All geometry uses the same world units as physics. */
(function(r,f){if(typeof module==='object'&&module.exports)module.exports=f();else r.FerryView=f();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';const WORLD_ASPECT=1.6,EYE=.105,NEAR=.035;
function camera(s,width,height){if(!(width>0&&height>0&&Number.isFinite(width)&&Number.isFinite(height)))throw Error('viewport');const w=s.aspect>=1?s.aspect:1,h=s.aspect>=1?1:1/s.aspect;return {width,height,w,h,x:s.x*w,y:s.y*h,cos:Math.cos(s.angle),sin:Math.sin(s.angle),focal:Math.min(width*.70,height*1.20),horizon:height*.38,eye:EYE};}
function project(cam,x,y,z=0){const dx=x*cam.w-cam.x,dy=y*cam.h-cam.y,depth=dx*cam.cos+dy*cam.sin,right=-dx*cam.sin+dy*cam.cos;if(depth<=NEAR)return null;const scale=cam.focal/depth;return {x:cam.width/2+right*scale,y:cam.horizon+(cam.eye-z)*scale,depth,scale};}
function ground(cam,sx,sy){if(!Number.isFinite(sx)||!Number.isFinite(sy)||sy<=cam.horizon+1)return null;const depth=cam.eye*cam.focal/(sy-cam.horizon),right=(sx-cam.width/2)*depth/cam.focal;return {x:(cam.x+cam.cos*depth-cam.sin*right)/cam.w,y:(cam.y+cam.sin*depth+cam.cos*right)/cam.h,depth};}
function bearing(cam,x,y){const dx=x*cam.w-cam.x,dy=y*cam.h-cam.y;return Math.atan2(-dx*cam.sin+dy*cam.cos,dx*cam.cos+dy*cam.sin);}
return {WORLD_ASPECT,EYE,NEAR,camera,project,ground,bearing};
});
