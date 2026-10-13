/* Original Canvas 2D software raycasting and cockpit artwork. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EchoView=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const FOV=Math.PI*0.45,PLANE=Math.tan(FOV/2);
function cast(map,x,y,angle,columns=240){
 const fx=Math.cos(angle),fy=Math.sin(angle),px=-fy*PLANE,py=fx*PLANE,rays=[];
 for(let i=0;i<columns;i++){
  const u=2*(i+.5)/columns-1,dx=fx+px*u,dy=fy+py*u;let mx=Math.floor(x),my=Math.floor(y);
  const ddx=dx===0?Infinity:Math.abs(1/dx),ddy=dy===0?Infinity:Math.abs(1/dy),sx=dx<0?-1:1,sy=dy<0?-1:1;
  let tx=(dx<0?x-mx:mx+1-x)*ddx,ty=(dy<0?y-my:my+1-y)*ddy,side=0,hit=false;
  for(let step=0;step<64;step++){if(tx<ty){tx+=ddx;mx+=sx;side=0;}else{ty+=ddy;my+=sy;side=1;}if(map[my]?.[mx]!=='.'){hit=true;break;}}
  const distance=Math.max(.001,hit?(side===0?(mx-x+(1-sx)/2)/dx:(my-y+(1-sy)/2)/dy):64);
  const wall=(side===0?y+distance*dy:x+distance*dx);rays.push({distance,side,mapX:mx,mapY:my,wall:wall-Math.floor(wall)});
 }
 return rays;
}
function project(x,y,camera,width,height){const dx=x-camera.x,dy=y-camera.y,cos=Math.cos(camera.angle),sin=Math.sin(camera.angle),depth=dx*cos+dy*sin,side=-dx*sin+dy*cos;const focal=width/(2*PLANE);return{depth,x:width/2+side*focal/depth,y:height*.46,scale:focal/depth};}
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
function draw(ctx,level,scene,settings,now){
 const W=960,H=640,horizon=H*.46+(scene.bob||0),cols=240,step=W/cols,cam=scene.camera,rays=cast(level.map,cam.x,cam.y,cam.angle,cols),sonar=scene.firstMove?1:Math.min(1,scene.revealMs/350),high=settings.highContrast;
 ctx.clearRect(0,0,W,H);
 let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#031420');g.addColorStop(.47,'#102c40');g.addColorStop(.48,'#17374b');g.addColorStop(1,'#061b2b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // Perspective floor seams and a light cone establish a driver's eye-level view.
 ctx.strokeStyle=high?'#3c7181':'#24475b';ctx.lineWidth=1.2;
 for(let k=1;k<13;k++){const depth=k*.5,yy=horizon+270/depth;if(yy<H){ctx.beginPath();ctx.moveTo(0,yy);ctx.lineTo(W,yy);ctx.stroke();}}
 for(let x=-W;x<=2*W;x+=W/5){ctx.beginPath();ctx.moveTo(W/2,horizon);ctx.lineTo(x,H);ctx.stroke();}
 for(let i=0;i<cols;i++){
  const r=rays[i],height=Math.min(H*5,540/r.distance),top=horizon-height/2,bottom=top+height;
  const near=Math.max(0,1-r.distance/2),light=(.30+sonar*.65+near*.34)/(1+r.distance*.19)*(r.side?.79:1)*(high?1.22:1),seam=r.wall<.033||r.wall>.967;
  const base=seam?[41,73,89]:[58,118,137];ctx.fillStyle=`rgb(${base.map(v=>Math.min(255,Math.round(v*light))).join(',')})`;ctx.fillRect(i*step,top,step+.5,height);
  // Wall-panel edging is perspective-correct, never a top-down map.
  const edge=high?'#84c6c6':'#6aa6b4';ctx.globalAlpha=Math.min(1,.18+sonar*.40+near*.25);ctx.fillStyle=edge;ctx.fillRect(i*step,top+height*.08,step+.5,Math.max(1,height*.013));ctx.fillRect(i*step,top+height*.88,step+.5,Math.max(1,height*.014));
  if(r.wall>.47&&r.wall<.53){ctx.fillStyle='#a9e4dc';ctx.globalAlpha=Math.min(1,.14+sonar*.63);ctx.fillRect(i*step,top+height*.29,step+.5,height*.22);}
  ctx.globalAlpha=1;
  if(bottom<H){const fog=ctx.createLinearGradient(0,bottom,0,H);fog.addColorStop(0,'#00000016');fog.addColorStop(1,'#00000000');ctx.fillStyle=fog;ctx.fillRect(i*step,bottom,step+.5,H-bottom);}
 }
 // A real in-world golden exit: occluded by nearer wall columns.
 const exit=project(level.exit[0]+.5,level.exit[1]+.5,cam,W,H);
 if(exit.depth>.08&&Number.isFinite(exit.x)){
  const w=exit.scale*.50,h=exit.scale*.78,x=exit.x,y=horizon;
  if(x+w>0&&x-w<W){ctx.save();ctx.beginPath();for(let i=0;i<cols;i++)if(rays[i].distance>exit.depth-.05)ctx.rect(i*step,0,step+.6,H);ctx.clip();ctx.strokeStyle='#ffda8b';ctx.lineWidth=Math.max(3,Math.min(12,exit.scale*.024));ctx.shadowColor='#ffc972';ctx.shadowBlur=sonar?28:18;ctx.beginPath();ctx.ellipse(x,y,w/2,h/2,0,0,Math.PI*2);ctx.stroke();ctx.shadowBlur=0;ctx.lineWidth=Math.max(1,exit.scale*.006);ctx.beginPath();ctx.ellipse(x,y,w*.36,h*.36,0,0,Math.PI*2);ctx.stroke();ctx.fillStyle='#ffe9a633';ctx.beginPath();ctx.ellipse(x,y,w*.29,h*.29,0,0,Math.PI*2);ctx.fill();ctx.restore();}
 }
 // Clicking creates a visible sonar wave on the windshield; it is unmetered.
 const pulseAge=now-scene.pulseAt;if(pulseAge>=0&&pulseAge<950&&!scene.firstMove&&!settings.reducedMotion){const t=pulseAge/950;ctx.strokeStyle=`rgba(132,240,215,${(1-t)*.55})`;ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(W/2,horizon,35+t*W*.67,25+t*H*.53,0,0,Math.PI*2);ctx.stroke();}
 // First-room contextual pictogram: teaches six inputs without a text wall.
 if(scene.tutorial){const x=W/2,y=H*.68;ctx.save();ctx.translate(x,y);ctx.strokeStyle='#b4f4e0';ctx.fillStyle='#b4f4e0';ctx.lineWidth=8;ctx.lineCap='round';ctx.lineJoin='round';ctx.shadowColor='#75ebd5';ctx.shadowBlur=10;if(scene.tutorial==='forward'){ctx.beginPath();ctx.moveTo(-20,8);ctx.lineTo(0,-12);ctx.lineTo(20,8);ctx.stroke();}else{const sign=scene.tutorial==='right'?1:-1;ctx.scale(sign,1);ctx.beginPath();ctx.moveTo(-22,19);ctx.quadraticCurveTo(-22,-13,8,-13);ctx.lineTo(24,-13);ctx.stroke();ctx.beginPath();ctx.moveTo(10,-27);ctx.lineTo(27,-13);ctx.lineTo(10,1);ctx.stroke();}ctx.restore();}
 if(scene.bumpAge>=0&&scene.bumpAge<230){ctx.strokeStyle=`rgba(255,186,129,${1-scene.bumpAge/230})`;ctx.lineWidth=9;ctx.strokeRect(15,15,W-30,H-30);}
 if(scene.mode==='won'){const a=settings.reducedMotion?.14:.14+Math.sin(now/110)*.04;ctx.fillStyle=`rgba(255,210,126,${a})`;ctx.fillRect(0,0,W,H);}
 // Original cockpit frame: foreground window mullions, bolts and instrument rims.
 ctx.fillStyle='#051724';ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(75,0);ctx.lineTo(27,H*.74);ctx.lineTo(128,H);ctx.lineTo(0,H);ctx.closePath();ctx.fill();ctx.beginPath();ctx.moveTo(W,0);ctx.lineTo(W-75,0);ctx.lineTo(W-27,H*.74);ctx.lineTo(W-128,H);ctx.lineTo(W,H);ctx.closePath();ctx.fill();
 ctx.strokeStyle='#385867';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(71,0);ctx.lineTo(28,H*.74);ctx.lineTo(128,H);ctx.moveTo(W-71,0);ctx.lineTo(W-28,H*.74);ctx.lineTo(W-128,H);ctx.stroke();
 ctx.fillStyle='#061824';ctx.beginPath();ctx.moveTo(0,H);ctx.lineTo(0,H*.90);ctx.quadraticCurveTo(W/2,H*.77,W,H*.90);ctx.lineTo(W,H);ctx.closePath();ctx.fill();ctx.strokeStyle='#476774';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,H*.90);ctx.quadraticCurveTo(W/2,H*.77,W,H*.90);ctx.stroke();
 for(const x of[75,W-75])for(const y of[80,300]){ctx.fillStyle='#769097';ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);ctx.fill();}
 rounded(ctx,W/2-49,H-62,98,29,13,'#123440','#3c6470');rounded(ctx,W/2-23,H-51,46,5,2,'#82ddc9',null);
}
return{FOV,PLANE,cast,project,draw};
});
