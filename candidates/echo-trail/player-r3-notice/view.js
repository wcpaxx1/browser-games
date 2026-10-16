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
  const wall=(side===0?y+distance*dy:x+distance*dx),face=side===0?(sx>0?3:1):(sy>0?0:2);rays.push({distance,side,face,mapX:mx,mapY:my,wall:wall-Math.floor(wall)});
 }
 return rays;
}
function project(x,y,camera,width,height){const dx=x-camera.x,dy=y-camera.y,cos=Math.cos(camera.angle),sin=Math.sin(camera.angle),depth=dx*cos+dy*sin,side=-dx*sin+dy*cos;const focal=width/(2*PLANE);return{depth,x:width/2+side*focal/depth,y:height*.46,scale:focal/depth};}
function rounded(ctx,x,y,w,h,r,fill,stroke){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill();}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke();}}
// These local wall signatures know no goal, route, visited history or hidden map.
const MARK_COLORS=['#8ce3d5','#98c6ee','#d2b8ed','#d7e4e8'],MARK_RANGE=2.75,MARK_LIMIT=3;
function wallMark(seed,x,y,face){let n=(Math.imul(x+17,73856093)^Math.imul(y+23,19349663)^Math.imul(face+3,83492791)^seed)>>>0;n=Math.imul(n^(n>>>16),0x45d9f3b)>>>0;n=(n^(n>>>16))>>>0;return{key:`${x},${y},${face}`,shape:n&3,bars:1+((n>>>2)&3),color:MARK_COLORS[(n>>>4)&3]};}
function visibleMarks(rays,seed){const seen=new Map();for(const r of rays){if(r.distance>MARK_RANGE||r.wall<.34||r.wall>.66)continue;const mark=wallMark(seed,r.mapX,r.mapY,r.face),old=seen.get(mark.key);if(!old||r.distance<old.distance)seen.set(mark.key,{...mark,distance:r.distance});}return new Map([...seen.values()].sort((a,b)=>a.distance-b.distance||(a.key<b.key?-1:a.key>b.key?1:0)).slice(0,MARK_LIMIT).map(m=>[m.key,m]));}
// Project world grid lines onto the floor plane; the opaque walls drawn afterward occlude them.
function floorGrid(cam,width=960,height=640,horizon=height*.46){
 const cos=Math.cos(cam.angle),sin=Math.sin(cam.angle),focal=width/(2*PLANE),out=[],near=.08,far=12,span=14;
 const point=(x,y)=>{const dx=x-cam.x,dy=y-cam.y;return{depth:dx*cos+dy*sin,side:-dx*sin+dy*cos};};
 function line(x1,y1,x2,y2,axis,value){const a=point(x1,y1),b=point(x2,y2),dd=b.depth-a.depth;let lo=0,hi=1;if(Math.abs(dd)<1e-10){if(a.depth<near||a.depth>far)return;}else{const n=(near-a.depth)/dd,f=(far-a.depth)/dd;lo=Math.max(lo,Math.min(n,f));hi=Math.min(hi,Math.max(n,f));if(lo>hi)return;}const project=t=>{const d=a.depth+dd*t,s=a.side+(b.side-a.side)*t;return{x:width/2+s*focal/d,y:horizon+(height*270/640)/d};};out.push({axis,value,from:project(lo),to:project(hi)});}
 const x0=Math.floor(cam.x-span),x1=Math.ceil(cam.x+span),y0=Math.floor(cam.y-span),y1=Math.ceil(cam.y+span);
 for(let x=x0;x<=x1;x++)line(x,y0,x,y1,'x',x);for(let y=y0;y<=y1;y++)line(x0,y,x1,y,'y',y);return out;
}
// A column samples one texture coordinate on the already-hit wall face, never a billboard.
function markSegments(mark,u){const x=(u-.5)/.38,segments=[];if(Math.abs(x)<=1){const center=.455,radius=.052,thickness=.012;let edge;if(mark.shape===0)edge=Math.sqrt(Math.max(0,1-x*x))*radius;else if(mark.shape===1)edge=(1-Math.abs(x))*radius;if(edge!==undefined){if(Math.abs(x)>.92)segments.push([center-edge-thickness/2,edge*2+thickness]);else segments.push([center-edge-thickness/2,thickness],[center+edge-thickness/2,thickness]);}else if(mark.shape===2){if(Math.abs(x)<.2)segments.push([center-radius,2*radius]);else segments.push([center-thickness/2,thickness]);}else if(Math.abs(Math.abs(x)-.45)<.18)segments.push([center-radius,2*radius]);}
 for(let j=0;j<mark.bars;j++){const middle=.5+(j-(mark.bars-1)/2)*.17;if(Math.abs(u-middle)<.045)segments.push([.55,.018]);}return segments;}
function draw(ctx,level,scene,settings,now){
 const W=960,H=640,horizon=H*.46+(scene.bob||0),cols=240,step=W/cols,cam=scene.camera,rays=cast(level.map,cam.x,cam.y,cam.angle,cols),marks=visibleMarks(rays,scene.landmarkSeed??0),sonar=scene.firstMove?1:Math.min(1,scene.revealMs/350),high=settings.highContrast;
 ctx.clearRect(0,0,W,H);
 let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#031420');g.addColorStop(.47,'#102c40');g.addColorStop(.48,'#17374b');g.addColorStop(1,'#061b2b');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 // Every seam is a real integer cell boundary; moving/turning preserves its world position.
 ctx.save();ctx.beginPath();ctx.rect(0,horizon,W,H-horizon);ctx.clip();ctx.strokeStyle=high?'#50828c':'#315867';ctx.lineWidth=1.25;
 for(const line of floorGrid(cam,W,H,horizon)){ctx.beginPath();ctx.moveTo(line.from.x,line.from.y);ctx.lineTo(line.to.x,line.to.y);ctx.stroke();}ctx.restore();
 for(let i=0;i<cols;i++){
  const r=rays[i],height=Math.min(H*5,540/r.distance),top=horizon-height/2,bottom=top+height;
  const near=Math.max(0,1-r.distance/2),light=(.30+sonar*.65+near*.34)/(1+r.distance*.19)*(r.side?.79:1)*(high?1.22:1),seam=r.wall<.033||r.wall>.967;
  const base=seam?[41,73,89]:[58,118,137];ctx.fillStyle=`rgb(${base.map(v=>Math.min(255,Math.round(v*light))).join(',')})`;ctx.fillRect(i*step,top,step+.5,height);
  // Wall-panel edging is perspective-correct, never a top-down map.
  const edge=high?'#84c6c6':'#6aa6b4';ctx.globalAlpha=Math.min(1,.18+sonar*.40+near*.25);ctx.fillStyle=edge;ctx.fillRect(i*step,top+height*.08,step+.5,Math.max(1,height*.013));ctx.fillRect(i*step,top+height*.88,step+.5,Math.max(1,height*.014));
  const mark=marks.get(`${r.mapX},${r.mapY},${r.face}`);
  if(mark&&r.distance<=MARK_RANGE&&r.wall>=.34&&r.wall<=.66){const u=(r.wall-.34)/.32,fade=Math.min(1,Math.max(0,(MARK_RANGE-r.distance)/.45));ctx.globalAlpha=fade*(.45+sonar*.45);ctx.fillStyle='#092535';ctx.fillRect(i*step,top+height*.36,step+.5,height*.24);ctx.fillStyle=high?'#d8ffed':mark.color;ctx.globalAlpha=fade*Math.min(1,.42+sonar*.42+near*.15);for(const [y,h]of markSegments(mark,u))ctx.fillRect(i*step,top+height*y,step+.5,Math.max(1,height*h));}
  else if(!mark&&r.wall>.47&&r.wall<.53){ctx.fillStyle='#a9e4dc';ctx.globalAlpha=Math.min(1,.14+sonar*.63);ctx.fillRect(i*step,top+height*.29,step+.5,height*.22);}
  ctx.globalAlpha=1;
  // The true wall/floor junction distinguishes an opening's depth from a panel's inset trim.
  if(bottom>horizon&&bottom<H){ctx.fillStyle=high?'#7aafba':'#507d8d';ctx.globalAlpha=Math.min(.9,.3+sonar*.3+near*.2);ctx.fillRect(i*step,bottom-1,step+.5,Math.max(1,Math.min(2.5,2/r.distance)));ctx.globalAlpha=1;}
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
return{FOV,PLANE,MARK_RANGE,MARK_LIMIT,cast,project,wallMark,visibleMarks,markSegments,floorGrid,draw};
});
