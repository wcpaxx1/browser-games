/* Original first-person coastal cycling renderer. No assets or dependencies. */
(function(root){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const jumpHeight=remaining=>remaining>0?Math.sin((1-remaining/.85)*Math.PI):0;
function geometry(width,height,jump=0){return {laneWidth:Math.min(285,width*.30),horizon:height*.29,drop:height*(.61+jump*.16)};}
function project(distance,lane,cameraLane,width,height,jump=0){
  const z=Math.max(0,distance),scale=180/(z+180),g=geometry(width,height,jump);
  return {x:width*.5+(lane-cameraLane)*g.laneWidth*scale,y:g.horizon+g.drop*scale,scale,visible:distance>-36&&distance<1550};
}
function targetLane(x,y,cameraLane,width,height,jump=0){
  if(![x,y,cameraLane,width,height,jump].every(Number.isFinite)||width<=0||height<=0)return null;
  if(x<0||x>width||y<0||y>height*.91)return null;
  const g=geometry(width,height,jump),scale=(y-g.horizon)/g.drop;
  // Ignore sky and the very distant road, where a few pixels span every lane.
  if(scale<.11||scale>1)return null;
  // The hands/mail pouch are foreground controls, not selectable road pixels.
  const unit=Math.min(1.05,width/670),cockpitTop=height*.83-jump*12-48*unit-3;
  if(y>=cockpitTop&&Math.abs(x-width*.5)<232*unit)return null;
  const lane=cameraLane+(x-width*.5)/(g.laneWidth*scale);
  if(lane<-.56||lane>2.56)return null;
  return clamp(Math.round(lane),0,2);
}
function pickPointer(clientX,clientY,rect,view){
  if(!view||!rect||![clientX,clientY,rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
  if(clientX<rect.left||clientX>rect.left+rect.width||clientY<rect.top||clientY>rect.top+rect.height)return null;
  return targetLane((clientX-rect.left)*view.width/rect.width,(clientY-rect.top)*view.height/rect.height,view.cameraLane,view.width,view.height,view.jump);
}
function draw(ctx,W,H,state,route,p,time,cameraLane,flash,pickupFlash,steer=0){
 const r=state.run,low=state.settings.reduced,jump=jumpHeight(r.jump);
 const P=(z,lane)=>project(z,lane,cameraLane,W,H,jump);
 function path(points,fill,stroke,lw=1){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));if(fill){ctx.closePath();ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}}
 function line(points,color,lw=1){path(points,null,color,lw);}
 function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,Math.max(.1,rx),Math.max(.1,ry),0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
 function box(x,y,w,h,color,radius=0){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,radius);ctx.fill();}
 function roadStrip(z0,z1,lane0,lane1,color){const a=P(z0,lane0),b=P(z0,lane1),c=P(z1,lane1),d=P(z1,lane0);path([[a.x,a.y],[b.x,b.y],[c.x,c.y],[d.x,d.y]],color);}
 ctx.save();
 const sky=ctx.createLinearGradient(0,0,0,H*.49);sky.addColorStop(0,p.sky);sky.addColorStop(1,p.sun);ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
 ellipse(W*.77,H*.12,24,24,p.sun);
 if(route.theme===3)for(let i=0;i<36;i++)ellipse((i*107+29)%W,8+(i*37)%(H*.21),i%4===0?1.5:1,1,'#fff4cc');
 for(let i=0;i<4;i++){const x=((i+.1)*W/3-(low?0:time*3))%(W+120),y=H*(.10+(i%2)*.055);ellipse(x,y,35,9,'#fff9dc8c');ellipse(x+14,y-8,23,13,'#fff9dc8c');}
 const horizon=H*.29;
 path([[0,horizon+3],[W*.14,horizon-19],[W*.24,horizon-7],[W*.38,horizon-21],[W*.46,horizon+8],[W*.72,horizon-8],[W*.90,horizon-24],[W,horizon-7],[W,H],[0,H]],p.land);
 ctx.fillStyle=p.sea;ctx.fillRect(0,horizon+3,W,H-horizon);
 const sea=ctx.createLinearGradient(0,horizon,0,H);sea.addColorStop(0,p.sea);sea.addColorStop(1,p.deep);ctx.fillStyle=sea;ctx.fillRect(0,horizon+7,W,H-horizon);
 for(let i=0;i<9;i++){const y=horizon+13+i*i*3;line([[0,y],[W,y+Math.sin(i+time*.4)*2]],i%2?'#fff7d535':'#eff7dc66',1);}
 const a=P(0,-.88),b=P(0,3.2),c=P(7000,3.2),d=P(7000,-.88);
 path([[a.x,a.y],[b.x,b.y],[W,H],[0,H],[0,H*.8],[d.x,d.y],[c.x,c.y]],p.sand);
 const shore=P(0,-.78),farShore=P(7000,-.78);
 path([[shore.x,shore.y],[farShore.x,farShore.y],[W,H*.36],[W,H],[shore.x,H]],p.sand);
 line([[farShore.x-5,farShore.y],[shore.x-20,shore.y]],'#fff5d4',7);
 roadStrip(0,7000,-.56,2.56,p.road);
 roadStrip(0,7000,-.61,-.55,'#fff7d6');roadStrip(0,7000,2.55,2.61,'#fff7d6');
 // Alternating stripes move towards the rider and make speed/depth legible.
 for(let z=-80;z<1600;z+=100){const zz=z-(r.x%100);if(zz+48<=0)continue;for(const lane of [.5,1.5])roadStrip(Math.max(0,zz),zz+48,lane-.025,lane+.025,'#fff4d6ad');}
 for(let z=1450;z>=100;z-=180){const zz=z-(r.x%180),q=P(Math.max(0,zz),2.95);if(zz<=0)continue;ellipse(q.x,q.y,36*q.scale,10*q.scale,p.green);line([[q.x,q.y],[q.x-9*q.scale,q.y-26*q.scale],[q.x+2*q.scale,q.y-12*q.scale],[q.x+12*q.scale,q.y-34*q.scale]],'#557c56',3*q.scale);}
 // Roadside posts pass through the rider's peripheral view.
 for(let z=1300;z>0;z-=220){const zz=z-(r.x%220);if(zz<5)continue;for(const l of [-.78,2.78]){const q=P(zz,l);box(q.x-3*q.scale,q.y-46*q.scale,6*q.scale,46*q.scale,'#f9f0d1');box(q.x-4*q.scale,q.y-38*q.scale,8*q.scale,9*q.scale,'#da8b5b');}}
 const finishZ=1800-r.x,finish=P(Math.max(0,finishZ),1),s=finish.scale;
 // The post office grows on the roadside all the way to the finish.
 const lx=finish.x+Math.min(330,W*.34)*s,ly=finish.y;
 path([[lx-22*s,ly],[lx+22*s,ly],[lx+15*s,ly-134*s],[lx-15*s,ly-134*s]],'#fff3d6');
 box(lx-19*s,ly-69*s,38*s,26*s,'#d57c5e');box(lx-22*s,ly-146*s,44*s,15*s,'#315d57');box(lx-15*s,ly-169*s,30*s,23*s,'#f4c86d');path([[lx-28*s,ly-169*s],[lx+28*s,ly-169*s],[lx,ly-192*s]],'#315d57');
 if(finishZ<600){roadStrip(Math.max(0,finishZ-6),finishZ+6,-.55,2.55,'#fff4d5');const f=P(finishZ,1);ctx.font=`bold ${Math.max(10,30*f.scale)}px sans-serif`;ctx.textAlign='center';ctx.fillStyle='#244b45';ctx.fillText('✉',f.x,f.y-72*f.scale);}
 const visible=route.items.filter(o=>P(o.x-r.x,o.lane).visible&&!(o.type==='stamp'&&r.taken.includes(o.id))).sort((a,b)=>b.x-a.x);
 for(const o of visible){const q=P(o.x-r.x,o.lane),s=q.scale;if(o.x-r.x<-24)continue;const x=q.x,y=q.y;
  ellipse(x,y,42*s,11*s,'#31594429');
  if(o.type==='stamp'){
    const yy=y-85*s-(low?0:Math.sin(time*3+o.id)*4*s);ellipse(x,yy,35*s,35*s,'#fff8cf63');
    ctx.save();ctx.translate(x,yy);ctx.rotate(-.06);box(-28*s,-24*s,56*s,48*s,'#fff8dc',4*s);ctx.strokeStyle='#bb673f';ctx.lineWidth=3*s;ctx.strokeRect(-22*s,-18*s,44*s,36*s);path([[-17*s,-11*s],[17*s,-11*s],[17*s,11*s],[-17*s,11*s]],'#e1a261');line([[-17*s,-11*s],[0,2*s],[17*s,-11*s]],'#fff8d7',3*s);ctx.restore();
  }else{
    const hit=r.hit.includes(o.id);ctx.save();if(hit)ctx.globalAlpha=.35;
    ellipse(x,y-9*s,48*s,21*s,'#b9533433');
    if(o.type==='wood'){box(x-43*s,y-29*s,86*s,29*s,'#a7734b',8*s);ellipse(x-40*s,y-14*s,7*s,14*s,'#d3ae77');ellipse(x+40*s,y-14*s,7*s,14*s,'#79573e');line([[x-33*s,y-21*s],[x+30*s,y-21*s]],'#d9b77d',3*s);}
    else{ellipse(x,y-17*s,26*s,17*s,'#cd664d');for(const side of [-1,1]){line([[x+side*19*s,y-13*s],[x+side*39*s,y-6*s],[x+side*47*s,y-15*s]],'#a25342',4*s);line([[x+side*17*s,y-23*s],[x+side*35*s,y-38*s]],'#b85a42',5*s);ellipse(x+side*38*s,y-42*s,11*s,8*s,'#e47e57');ellipse(x+side*10*s,y-34*s,5*s,7*s,'#fdf0d1');ellipse(x+side*10*s,y-36*s,2*s,3*s,'#213f3d');}}
    ctx.restore();
  }
 }
 // First-person cockpit: handlebars, gloved wings and the mail pouch.
 const bob=low?0:Math.sin(time*9)*1.7,lean=steer*5;
 ctx.save();ctx.translate(W*.5+lean,H*.83-jump*12+bob);const unit=Math.min(1.05,W/670);
 ctx.scale(unit,unit);
 ellipse(0,57,183,40,'#284e4530');
 path([[-57,30],[-28,11],[28,11],[57,30],[46,103],[-46,103]],'#cf8455','#875a3e',3);
 box(-41,34,82,57,'#ddb284',9);path([[-28,47],[28,47],[28,75],[-28,75]],'#fff5d4');line([[-28,47],[0,65],[28,47]],'#bc7a52',2);
 line([[-175,8],[-131,-6],[-73,-24],[73,-24],[131,-6],[175,8]],'#284d48',17);
 line([[-175,5],[-132,-10],[-74,-28],[74,-28],[132,-10],[175,5]],'#89a59a',7);
 line([[-66,-20],[-13,33],[13,33],[66,-20]],'#d78754',11);ellipse(0,20,12,12,'#345e54');ellipse(0,20,6,6,'#d1ddd0');
 for(const side of [-1,1]){
   line([[side*177,8],[side*207,16]],'#213f3d',25);
   ctx.save();ctx.translate(side*176,0);ctx.rotate(side*.14);ellipse(0,4,31,20,'#fff4d9');ellipse(side*7,6,24,13,'#e8dfc2');for(let f=0;f<3;f++)line([[side*(-15+f*9),-5],[side*(-18+f*9),12]],'#c7cbb8',2);ctx.restore();
 }
 ellipse(105,-22,17,17,'#d8a753');ellipse(105,-25,13,12,'#f7d984');line([[112,-30],[119,-34]],'#294e49',4);
 ctx.restore();
 if(pickupFlash>0){ctx.fillStyle=`rgba(255,248,197,${pickupFlash*.18})`;ctx.fillRect(0,0,W,H);}
 if(flash>0){ctx.strokeStyle=`rgba(180,69,40,${flash*.85})`;ctx.lineWidth=18;ctx.strokeRect(9,9,W-18,H-18);}
 ctx.restore();
}
const api={geometry,jumpHeight,project,targetLane,pickPointer,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.PelicanView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
