/* Original canvas illustration. No downloaded or recovered commercial art. */
(function(root){'use strict';
const G=root.Tempest, clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function rng(seed){let s=seed>>>0;return()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296)}
class CommandView{
 constructor(canvas,makeCanvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.makeCanvas=makeCanvas||((w,h)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c});this.cam={x:17.5,y:9};this.zoom=1;this.w=1;this.h=1;this.ground=null;this.mark=null;this.regions=[]}
 resize(w,h,dpr=1){this.w=w;this.h=h;this.dpr=Math.min(2,dpr||1);this.canvas.width=Math.round(w*this.dpr);this.canvas.height=Math.round(h*this.dpr);this.scale=Math.min(w/12.6,h/18.5,52)*this.zoom}
 fit(g){const es=g?.sim.entities.filter(e=>e.hp>0&&['ranger','goal','rocket'].includes(e.type));if(!es?.length){this.cam={x:17.5,y:9};this.zoom=1;this.scale=Math.min(this.w/12.6,this.h/18.5,52);return}
  const rad=e=>e.type==='goal'?1.6:.8,minX=Math.min(...es.map(e=>e.x-rad(e))),maxX=Math.max(...es.map(e=>e.x+rad(e))),minY=Math.min(...es.map(e=>e.y-rad(e))),maxY=Math.max(...es.map(e=>e.y+rad(e)));
  this.cam={x:(minX+maxX)/2,y:(minY+maxY)/2};const base=Math.min(this.w/12.6,this.h/18.5,52);this.scale=Math.min(Math.max(40,this.w-100)/(maxY-minY),Math.max(40,this.h-100)/(maxX-minX),base*2.2,52);this.zoom=this.scale/base;
 }
 project(x,y){return {x:this.w/2+(y-this.cam.y)*this.scale,y:this.h/2-(x-this.cam.x)*this.scale}}
 unproject(x,y){return {x:this.cam.x-(y-this.h/2)/this.scale,y:this.cam.y+(x-this.w/2)/this.scale}}
 visiblePoint(x,y){const d=this.display||{cam:this.cam,scale:this.scale,w:this.w,h:this.h};return {x:d.cam.x-(y-d.h/2)/d.scale,y:d.cam.y+(x-d.w/2)/d.scale}}
 pan(dx,dy){this.cam.x=clamp(this.cam.x-dy/this.scale,2,38);this.cam.y=clamp(this.cam.y+dx/this.scale,2,24)}
 zoomAt(f,x,y){const old=this.unproject(x,y);this.zoom=clamp(this.zoom*f,.25,2.2);this.scale=Math.min(this.w/12.6,this.h/18.5,52)*this.zoom;const next=this.unproject(x,y);this.cam.x+=old.x-next.x;this.cam.y+=old.y-next.y}
 terrain(seed){if(this.ground&&this.seed===seed)return;this.seed=seed;const u=40,c=this.makeCanvas(G.W*u,G.H*u),x=c.getContext('2d'),r=rng(seed);
 x.fillStyle='#586356';x.fillRect(0,0,c.width,c.height);
 // Continuous low-frequency patches, then bounded fine grain. Baked once, no screen grid.
 for(let i=0;i<330;i++){const px=r()*c.width,py=r()*c.height,rad=35+r()*170;const g=x.createRadialGradient(px,py,0,px,py,rad);g.addColorStop(0,i%3?'#73806b28':'#292e3038');g.addColorStop(1,'#56624f00');x.fillStyle=g;x.fillRect(px-rad,py-rad,rad*2,rad*2)}
 x.fillStyle='#858071';x.fillRect(4*u,7.1*u,23*u,3.8*u);x.fillStyle='#686a62';x.fillRect(4*u,7.5*u,23*u,3*u);
 // Worn tarmac, road verge, broken seams and pads.
 for(let i=0;i<9000;i++){let px=r()*c.width,py=r()*c.height;x.fillStyle=i%3?'#ded3ae0d':'#121d1918';x.fillRect(px,py,1+r()*3,1+r()*3)}
 for(let i=0;i<100;i++){const px=(5+r()*22)*u,py=(7.6+r()*2.8)*u;x.strokeStyle='#343c3545';x.lineWidth=.6+r();x.beginPath();x.moveTo(px,py);x.lineTo(px+8+r()*18,py-3+r()*8);x.lineTo(px+22+r()*10,py+r()*7);x.stroke()}
 x.fillStyle='#c6be9755';for(let a=5;a<27;a+=1.6)x.fillRect(a*u,8.96*u,.6*u,2);
 for(const [a,b]of [[23,9],[7,13]]){x.fillStyle='#303734';x.fillRect((a-1.8)*u,(b-1.7)*u,3.6*u,3.4*u);x.fillStyle='#94998d';x.fillRect((a-1.65)*u,(b-1.55)*u,3.3*u,3.1*u);x.strokeStyle='#646d61';x.lineWidth=1;for(let d=-1.5;d<1.6;d+=.6){x.beginPath();x.moveTo((a+d)*u,(b-1.5)*u);x.lineTo((a+d)*u,(b+1.5)*u);x.stroke()}}
 for(let i=0;i<380;i++){const a=r()*40,b=r()*26;if((b>6.5&&b<11.5&&a>3&&a<28)||Math.hypot(a-7,b-13)<3)continue;const px=a*u,py=b*u;x.fillStyle='#263b2a6b';x.beginPath();x.ellipse(px+2,py+3,3+r()*8,2+r()*4,0,0,Math.PI*2);x.fill();x.strokeStyle='#7b886080';x.lineWidth=1;for(let j=0;j<4;j++){x.beginPath();x.moveTo(px,py);x.lineTo(px-4+r()*8,py-4-r()*6);x.stroke()}}
 this.ground=c;
 }
 tank(c,e){c.save();c.translate(e.x,e.y);c.rotate(e.angle);
 c.fillStyle='#0007';c.beginPath();c.ellipse(.12,.14,.85,.51,0,0,Math.PI*2);c.fill();
 for(const y of [-.42,.31]){c.fillStyle='#151d20';c.fillRect(-.66,y,1.32,.23);c.fillStyle='#485456';c.fillRect(-.64,y,1.28,.045);c.fillStyle='#87908b';for(let n=-.59;n<.65;n+=.14)c.fillRect(n,y+.045,.045,.15)}
 const g=c.createLinearGradient(-.5,-.35,.6,.36);g.addColorStop(0,'#bed0cc');g.addColorStop(.2,'#799aa5');g.addColorStop(1,'#314d60');c.fillStyle=g;c.beginPath();c.moveTo(-.62,-.31);c.lineTo(.44,-.31);c.lineTo(.69,-.18);c.lineTo(.69,.18);c.lineTo(.44,.31);c.lineTo(-.62,.31);c.closePath();c.fill();
 c.strokeStyle='#d1e3dd';c.lineWidth=.025;c.stroke();c.fillStyle='#23313a';c.fillRect(-.51,-.23,.25,.46);c.strokeStyle='#5b747a';c.lineWidth=.025;for(let a=-.48;a<-.26;a+=.04){c.beginPath();c.moveTo(a,-.2);c.lineTo(a,.2);c.stroke()}
 c.fillStyle='#65d4ff';c.fillRect(.43,-.22,.08,.44);c.fillStyle='#e0d3a3';c.fillRect(.63,-.17,.06,.08);c.fillRect(.63,.09,.06,.08);
 c.rotate(e.turret-e.angle);c.fillStyle='#172a36';c.beginPath();c.ellipse(.04,.05,.35,.3,0,0,Math.PI*2);c.fill();c.fillStyle='#375768';c.fillRect(.16,-.075,.85,.15);c.fillStyle='#afbbb2';c.fillRect(.24,-.065,.73,.045);c.fillStyle='#172731';c.fillRect(.96,-.09,.1,.18);
 c.fillStyle='#90a8ac';c.beginPath();c.moveTo(-.3,-.23);c.lineTo(.21,-.25);c.lineTo(.37,0);c.lineTo(.21,.25);c.lineTo(-.3,.23);c.closePath();c.fill();c.strokeStyle='#d1d9ca';c.lineWidth=.025;c.stroke();c.fillStyle='#405c66';c.beginPath();c.arc(-.06,0,.13,0,Math.PI*2);c.fill();c.strokeStyle='#acc8c9';c.stroke();c.restore();
 }
 soldier(c,e){c.save();c.translate(e.x,e.y);c.rotate(e.turret);c.fillStyle='#0007';c.beginPath();c.ellipse(.08,.1,.37,.28,0,0,Math.PI*2);c.fill();c.fillStyle='#342b27';c.fillRect(-.26,-.2,.32,.13);c.fillRect(-.26,.07,.32,.13);c.fillStyle='#a46954';c.fillRect(-.16,-.22,.33,.44);c.fillStyle='#ed9a80';c.fillRect(.02,-.22,.1,.06);c.fillStyle='#322d28';c.fillRect(-.22,-.35,.77,.15);c.fillStyle='#9a9b84';c.fillRect(-.24,-.35,.58,.055);c.fillStyle='#f25d56';c.fillRect(.36,-.36,.12,.17);c.fillStyle='#7d8270';c.beginPath();c.arc(.04,0,.17,0,Math.PI*2);c.fill();c.strokeStyle='#bdc0a0';c.lineWidth=.03;c.stroke();c.restore()}
 base(c,e){c.save();c.translate(e.x,e.y);const blue=e.team===0,accent=blue?'#58c3ef':'#ed745d';
 c.fillStyle='#0006';c.fillRect(-1.26,-1.16,2.83,2.85);c.fillStyle='#303d42';c.fillRect(-1.3,-1.25,2.6,2.5);c.fillStyle='#7f8d8a';c.fillRect(-1.3,-1.25,2.5,2.38);c.strokeStyle='#c8d0bb';c.lineWidth=.04;c.strokeRect(-1.25,-1.2,2.4,2.28);
 c.fillStyle='#3c5058';c.fillRect(-.85,-1.25,1.7,2.4);c.fillStyle='#a4b1a9';c.fillRect(-.9,-1.28,1.7,2.22);c.fillStyle='#bdc7b7';c.fillRect(-.9,-1.28,.12,2.22);
 c.fillStyle='#495b5c';for(let y=-1.1;y<1;y+=.23)c.fillRect(-.7,y,1.3,.04);
 c.fillStyle='#273b43';c.fillRect(-.65,-.78,.85,.9);c.fillStyle='#84958e';c.fillRect(-.7,-.85,.85,.9);c.strokeStyle='#c9d3c1';c.strokeRect(-.7,-.85,.85,.9);c.fillStyle='#405254';for(let y=-.75;y<0;y+=.11)c.fillRect(-.6,y,.64,.045);
 c.fillStyle='#34464a';c.fillRect(.37,-.83,.32,.68);c.fillStyle='#a7b5a5';c.fillRect(.35,-.86,.3,.62);c.fillStyle=accent;c.fillRect(-1.31,-1.1,.14,2.05);c.fillRect(.96,-1.1,.17,2.05);
 c.fillStyle='#27343a';c.fillRect(-.65,.52,1.25,.55);c.fillStyle='#c1b77d';for(let z=-.59;z<.6;z+=.24)c.fillRect(z,.98,.12,.07);
 c.fillStyle='#c6cfc0';c.beginPath();c.arc(.61,.4,.37,0,Math.PI*2);c.fill();c.fillStyle='#5b7373';c.beginPath();c.arc(.61,.4,.27,0,Math.PI*2);c.fill();c.strokeStyle='#c1cec3';c.lineWidth=.05;c.beginPath();c.moveTo(.36,.4);c.lineTo(.86,.4);c.moveTo(.61,.15);c.lineTo(.61,.65);c.stroke();
 for(const [x,y]of [[-1.15,-1.1],[1,-1.1],[-1.15,1],[1,1]]){c.fillStyle='#18272b';c.beginPath();c.arc(x,y,.055,0,Math.PI*2);c.fill()}
 if(!blue){c.save();c.rotate(e.turret);c.fillStyle='#233139';c.fillRect(0,-.09,1.65,.18);c.fillStyle='#b1bcae';c.fillRect(.4,-.09,1.1,.05);c.fillStyle='#647b7e';c.beginPath();c.arc(0,0,.34,0,Math.PI*2);c.fill();c.restore()}
 c.restore();
 }
 draw(g,ui={},now=0){this.display={cam:{...this.cam},scale:this.scale,w:this.w,h:this.h};const s=g.sim,c=this.ctx;this.terrain(s.seed);c.setTransform(this.dpr,0,0,this.dpr,0,0);c.fillStyle='#4d5c50';c.fillRect(0,0,this.w,this.h);c.save();c.translate(this.w/2,this.h/2);c.transform(0,-this.scale,this.scale,0,0,0);c.translate(-this.cam.x,-this.cam.y);c.imageSmoothingEnabled=true;c.drawImage(this.ground,0,0,40,26);
 for(const w of s.wrecks){c.save();c.translate(w.x,w.y);c.rotate(w.angle);c.fillStyle='#1f2727bb';c.fillRect(-.7,-.43,1.4,.86);c.strokeStyle='#b6784355';c.lineWidth=.06;c.strokeRect(-.5,-.3,1,.6);c.restore()}
 for(const e of s.entities){if(G.SPEC[e.type].building)this.base(c,e);else if(e.type==='ranger')this.tank(c,e);else this.soldier(c,e)}
 for(const p of s.projectiles){const f=clamp((s.tick-p.tick)/p.duration,0,1),x=p.x+(p.tx-p.x)*f,y=p.y+(p.ty-p.y)*f;c.strokeStyle=p.team?'#ff9a69':'#fff2b5';c.lineWidth=p.kind==='rocket'?.055:.04;c.beginPath();c.moveTo(x-(p.tx-p.x)*.07,y-(p.ty-p.y)*.07);c.lineTo(x,y);c.stroke();c.fillStyle='#fff7c5';c.beginPath();c.arc(x,y,.055,0,Math.PI*2);c.fill()}
 for(const e of s.events){if(!['impact','destroy'].includes(e.kind))continue;const f=(s.tick-e.tick)/20;if(f>1)continue;c.globalAlpha=1-f;c.fillStyle='#f2bc68';c.beginPath();c.arc(e.x,e.y,.12+f*(e.kind==='destroy'?1:.5),0,Math.PI*2);c.fill();c.globalAlpha=1}
 c.restore();this.regions=[];
 for(const e of s.entities){if(e.type==='hq')continue;const p=this.project(e.x,e.y),selected=ui.selected?.includes(e.id),r=e.type==='goal'?1.5*this.scale:e.type==='rocket'?Math.max(12,.45*this.scale):Math.max(17,.72*this.scale),ally=e.team===0,color=ally?'#6cddff':'#ff8a72';
 if(selected){c.strokeStyle='#e9fcff';c.lineWidth=2.5;const q=r+4;for(const [a,b]of [[-1,-1],[1,-1],[-1,1],[1,1]]){c.beginPath();c.moveTo(p.x+a*q,p.y+b*(q-9));c.lineTo(p.x+a*q,p.y+b*q);c.lineTo(p.x+a*(q-9),p.y+b*q);c.stroke()}}
 c.strokeStyle=color;c.lineWidth=1.5;c.beginPath();c.arc(p.x,p.y,r,0,Math.PI*2);c.stroke();
 const width=e.type==='goal'?Math.max(86,r*2):Math.max(34,r*1.4),top=p.y-r-12;c.fillStyle='#15262bdd';c.fillRect(p.x-width/2,top,width,5);c.fillStyle=color;c.fillRect(p.x-width/2,top,width*e.hp/G.SPEC[e.type].hp,5);
 const label=e.type==='goal'?'◆ 敌方前哨':ally?String(e.callsign):'反坦克';c.font=`600 ${ally?13:12}px "Noto Sans CJK SC", sans-serif`;c.textAlign='center';c.textBaseline='middle';const lw=ally?22:e.type==='goal'?100:58,lx=ally?p.x+(e.callsign===2?1:-1)*(r+10):e.type==='rocket'?p.x+(e.y<9?-1:1)*(r+33):p.x,ly=e.type==='goal'?p.y-r-29:ally?p.y:p.y+14;c.fillStyle=selected?'#d6f7ff':'#15262be8';c.fillRect(lx-lw/2,ly-10,lw,20);c.fillStyle=selected?'#123744':color;c.fillText(label,lx,ly);this.regions.push({id:e.id,team:e.team,x:p.x,y:p.y,r,label:{x:lx-lw/2,y:ly-10,w:lw,h:20}});
 if(selected&&e.order){const t=e.order.kind==='attack'?s.entities.find(a=>a.id===e.order.target):e.order;if(t){const z=this.project(t.x,t.y);c.save();c.setLineDash([5,7]);c.strokeStyle=e.order.kind==='attack'?'#ffb39a90':'#b2eaff90';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(z.x,z.y);c.stroke();c.restore()}}
 }
 if(this.mark&&now-this.mark.at<900){const p=this.project(this.mark.x,this.mark.y),f=(now-this.mark.at)/900;c.strokeStyle=this.mark.attack?'#ffb19d':'#c7f1ff';c.lineWidth=2;c.beginPath();c.arc(p.x,p.y,8+f*16,0,Math.PI*2);c.stroke();c.beginPath();c.moveTo(p.x-12,p.y);c.lineTo(p.x+12,p.y);c.moveTo(p.x,p.y-12);c.lineTo(p.x,p.y+12);c.stroke()}
 if(ui.box){const b=ui.box;c.fillStyle='#9be9ff18';c.strokeStyle='#a7e8fa';c.lineWidth=1.5;c.fillRect(b.x,b.y,b.w,b.h);c.strokeRect(b.x,b.y,b.w,b.h)}
 }
 pick(x,y){for(const r of [...this.regions].reverse()){const l=r.label;if((x>=l.x&&x<=l.x+l.w&&y>=l.y&&y<=l.y+l.h)||Math.hypot(x-r.x,y-r.y)<=r.r)return r}return null}
 box(b){return this.regions.filter(r=>r.team===0&&r.x>=Math.min(b.x,b.x+b.w)&&r.x<=Math.max(b.x,b.x+b.w)&&r.y>=Math.min(b.y,b.y+b.h)&&r.y<=Math.max(b.y,b.y+b.h)).map(r=>r.id)}
}
root.CommandView=CommandView;
})(globalThis);
