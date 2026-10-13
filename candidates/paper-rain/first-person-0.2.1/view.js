/* Original navigable 3-D scene, projected into Canvas2D or SVG.
   Geometry, camera and target plane are shared with core.js. */
(function(root){'use strict';
const C=typeof module==='object'&&module.exports?require('./core.js'):root.PaperCore;
const P={paper:'#EEE2C6',blue:'#244A63',ink:'#20262B',red:'#BC5846'};
const blend=(a,b,t)=>{const rgb=s=>[1,3,5].map(i=>parseInt(s.slice(i,i+2),16));const x=rgb(a),y=rgb(b);return '#'+x.map((v,i)=>Math.round(v+(y[i]-v)*t).toString(16).padStart(2,'0')).join('');};
function createProjector(player,w,h){const {f,r,u}=C.camera(player),{focal,cx,cy}=C.lens(w,h);const camera=v=>{const x=v[0]-player.x,y=v[1]-C.EYE,z=v[2]-player.z;return [x*r.x+y*r.y+z*r.z,x*u.x+y*u.y+z*u.z,x*f.x+y*f.y+z*f.z];};const project=q=>[cx+q[0]*focal/q[2],cy-q[1]*focal/q[2]];return {camera,project,focal,cx,cy,point:v=>{const q=camera(v);return q[2]>C.NEAR?[...project(q),q[2]]:null;}};}
function clipNear(points,near=C.NEAR){let out=[];for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],ia=a[2]>=near,ib=b[2]>=near;if(ia)out.push(a);if(ia!==ib){const t=(near-a[2])/(b[2]-a[2]);out.push(a.map((v,j)=>v+(b[j]-v)*t));}}return out;}
class CanvasSurface{
 constructor(ctx){this.ctx=ctx;this.ops=0;}
 begin(w,h){this.ops=0;if(typeof this.ctx.reset==='function')this.ctx.reset();else this.ctx.clearRect(0,0,w,h);}
 poly(a,fill,stroke=null,width=1,alpha=1){if(a.length<2)return;const g=this.ctx;g.globalAlpha=alpha;g.beginPath();g.moveTo(...a[0]);for(let i=1;i<a.length;i++)g.lineTo(...a[i]);g.closePath();if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}g.globalAlpha=1;this.ops++;}
 line(a,color,width=1,alpha=1){if(a.length<2)return;const g=this.ctx;g.globalAlpha=alpha;g.beginPath();g.moveTo(...a[0]);for(let i=1;i<a.length;i++)g.lineTo(...a[i]);g.strokeStyle=color;g.lineWidth=width;g.stroke();g.globalAlpha=1;this.ops++;}
 lines(segments,color,width=1,alpha=1){const g=this.ctx;g.globalAlpha=alpha;g.beginPath();for(const a of segments){g.moveTo(...a[0]);for(let i=1;i<a.length;i++)g.lineTo(...a[i]);}g.strokeStyle=color;g.lineWidth=width;g.stroke();g.globalAlpha=1;this.ops++;}
 circle(x,y,r,fill,stroke=null,width=1,alpha=1){const g=this.ctx;g.globalAlpha=alpha;g.beginPath();g.arc(x,y,Math.max(0,r),0,Math.PI*2);if(fill){g.fillStyle=fill;g.fill();}if(stroke){g.strokeStyle=stroke;g.lineWidth=width;g.stroke();}g.globalAlpha=1;this.ops++;}
 image(img,x,y,w,h,alpha=1){if(!img)return;const g=this.ctx;g.globalAlpha=alpha;g.drawImage(img,x,y,w,h);g.globalAlpha=1;this.ops++;}
 texture(img,pts,uv){const g=this.ctx,w=img.width,h=img.height,s=uv.map(p=>[p[0]*w,p[1]*h]);const den=s[0][0]*(s[1][1]-s[2][1])+s[1][0]*(s[2][1]-s[0][1])+s[2][0]*(s[0][1]-s[1][1]);if(Math.abs(den)<1e-9)return;const coeff=v=>[(v[0]*(s[1][1]-s[2][1])+v[1]*(s[2][1]-s[0][1])+v[2]*(s[0][1]-s[1][1]))/den,(v[0]*(s[2][0]-s[1][0])+v[1]*(s[0][0]-s[2][0])+v[2]*(s[1][0]-s[0][0]))/den,(v[0]*(s[1][0]*s[2][1]-s[2][0]*s[1][1])+v[1]*(s[2][0]*s[0][1]-s[0][0]*s[2][1])+v[2]*(s[0][0]*s[1][1]-s[1][0]*s[0][1]))/den];const x=coeff(pts.map(p=>p[0])),y=coeff(pts.map(p=>p[1]));g.save();g.beginPath();const mid=[(pts[0][0]+pts[1][0]+pts[2][0])/3,(pts[0][1]+pts[1][1]+pts[2][1])/3],cp=pts.map(p=>{const d=Math.hypot(p[0]-mid[0],p[1]-mid[1])||1;return [p[0]+(p[0]-mid[0])/d*.55,p[1]+(p[1]-mid[1])/d*.55];});g.moveTo(...cp[0]);g.lineTo(...cp[1]);g.lineTo(...cp[2]);g.closePath();g.clip();g.transform(x[0],y[0],x[1],y[1],x[2],y[2]);g.drawImage(img,0,0);g.restore();this.ops++;}
 end(){}
}
class SVGSurface{
 constructor(svg){this.svg=svg;this.parts=[];this.serial=0;this.ops=0;}
 begin(w,h){this.parts=[];this.serial=0;this.ops=0;this.svg.setAttribute('viewBox',`0 0 ${w} ${h}`);}
 poly(a,fill,stroke=null,width=1,alpha=1){this.parts.push(`<polygon points="${a.map(p=>p.join(',')).join(' ')}" fill="${fill||'none'}" stroke="${stroke||'none'}" stroke-width="${width}" opacity="${alpha}"/>`);this.ops++;}
 line(a,color,width=1,alpha=1){this.parts.push(`<polyline points="${a.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${alpha}"/>`);this.ops++;}
 lines(segments,color,width=1,alpha=1){this.parts.push(`<path d="${segments.map(a=>'M'+a.map(p=>p.join(',')).join('L')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${alpha}"/>`);this.ops++;}
 circle(x,y,r,fill,stroke=null,width=1,alpha=1){this.parts.push(`<circle cx="${x}" cy="${y}" r="${Math.max(0,r)}" fill="${fill||'none'}" stroke="${stroke||'none'}" stroke-width="${width}" opacity="${alpha}"/>`);this.ops++;}
 image(img,x,y,w,h,alpha=1){if(!img)return;const src=img.currentSrc||img.src||img.toDataURL?.();if(src)this.parts.push(`<image href="${src}" x="${x}" y="${y}" width="${w}" height="${h}" opacity="${alpha}"/>`);this.ops++;}
 texture(img,pts,uv){const src=img.currentSrc||img.src||img.toDataURL?.();if(!src)return;const s=uv,den=s[0][0]*(s[1][1]-s[2][1])+s[1][0]*(s[2][1]-s[0][1])+s[2][0]*(s[0][1]-s[1][1]);if(Math.abs(den)<1e-9)return;const c=v=>[(v[0]*(s[1][1]-s[2][1])+v[1]*(s[2][1]-s[0][1])+v[2]*(s[0][1]-s[1][1]))/den,(v[0]*(s[2][0]-s[1][0])+v[1]*(s[0][0]-s[2][0])+v[2]*(s[1][0]-s[0][0]))/den,(v[0]*(s[1][0]*s[2][1]-s[2][0]*s[1][1])+v[1]*(s[2][0]*s[0][1]-s[0][0]*s[2][1])+v[2]*(s[0][0]*s[1][1]-s[1][0]*s[0][1]))/den];const x=c(pts.map(p=>p[0])),y=c(pts.map(p=>p[1])),id=`t${this.serial++}`;this.parts.push(`<clipPath id="${id}"><polygon points="${pts.map(p=>p.join(',')).join(' ')}"/></clipPath><g clip-path="url(#${id})"><image href="${src}" width="1" height="1" preserveAspectRatio="none" transform="matrix(${x[0]} ${y[0]} ${x[1]} ${y[1]} ${x[2]} ${y[2]})"/></g>`);this.ops++;}
 end(){this.svg.innerHTML=this.parts.join('');}
}
// Inscribed opaque disk measured in the original paddle artwork. The physical
// effective face fits this disk; artwork is projected at world scale, never screen width.
const HAND_ART={cx:.267,cy:.27,radius:.20};
function paddleVisual(s,w,h,guard,aspect=1199/1312){
 const contact=s.lastContact,ca=contact?s.t-contact.t:Infinity,stroke=s.stroke,sa=stroke?s.t-stroke.at:Infinity;
 const restW=w/h<.8?Math.min(w*.72,h*.38):Math.min(w*.40,h*.62),restH=restW*aspect,restX=w-restW*.91,restY=h-restH*.89;
 let center=null,n=null,mix=0;
 if(contact&&ca>=0&&ca<.24){
  // Lateral/downward recovery reveals departure; the camera and ball are untouched.
  const withdraw=C.clamp(ca/.075,0,1),recoil=.09*Math.sin(Math.min(1,ca/.16)*Math.PI);n=contact.normal;
  center=[contact.paddleCenter.x-n.x*recoil+n.z*.68*withdraw,contact.paddleCenter.y-.25*withdraw,contact.paddleCenter.z-n.z*recoil-n.x*.68*withdraw];mix=ca<.10?1:Math.max(0,1-(ca-.10)/.14);
 }else if(stroke&&sa>=0&&sa<.24){n=stroke.normal;const travel=C.PADDLE.start+stroke.speed*Math.min(sa,C.PADDLE.duration);center=[stroke.origin.x+n.x*travel,stroke.origin.y+n.y*travel,stroke.origin.z+n.z*travel];mix=sa<C.PADDLE.duration?1:Math.max(0,1-(sa-C.PADDLE.duration)/.08);
 }else if(guard){n=C.paddleNormal(s.player);center=[s.player.x+n.x*(C.PADDLE.start+.12),C.EYE+C.PADDLE.height,s.player.z+n.z*(C.PADDLE.start+.12)];mix=1;}
 const rest=[restX,restY,restW,restH];if(!center)return {rest,mix:0};
 const worldW=C.PADDLE.radius/HAND_ART.radius,worldH=worldW*aspect,r={x:n.z,z:-n.x};
 const point=(u,v)=>[center[0]+r.x*(u-HAND_ART.cx)*worldW,center[1]-(v-HAND_ART.cy)*worldH,center[2]+r.z*(u-HAND_ART.cx)*worldW];
 const pr=createProjector(s.player,w,h),triangles=[];
 // 2x2 subdivision keeps free-pitch projection aligned to the actual plane.
 for(let row=0;row<2;row++)for(let col=0;col<2;col++){
  const uv=[[col/2,row/2],[(col+1)/2,row/2],[(col+1)/2,(row+1)/2],[col/2,(row+1)/2]],v=uv.map(q=>[...pr.camera(point(...q)),...q]);
  for(const ids of [[0,1,2],[0,2,3]]){const clip=clipNear(ids.map(i=>v[i]));for(let j=1;j<clip.length-1;j++){const a=[clip[0],clip[j],clip[j+1]],tex=a.map(q=>q.slice(3)),pts=a.map((q,i)=>{const p=pr.project(q),rx=restX+tex[i][0]*restW,ry=restY+tex[i][1]*restH;return[rx+(p[0]-rx)*mix,ry+(p[1]-ry)*mix];});triangles.push({pts,uv:tex});}}
 }
 const projectUV=(u,v)=>{const q=pr.point(point(u,v));if(!q)return null;const rx=restX+u*restW,ry=restY+v*restH;return[rx+(q[0]-rx)*mix,ry+(q[1]-ry)*mix];};
 const sleeveA=projectUV(.83,.90),sleeveB=projectUV(1,.90),sleeve=[];
 if(sleeveA&&sleeveB&&Math.min(sleeveA[1],sleeveB[1])<h){const a=[sleeveA,sleeveB,[w+30,h+45],[w*.82,h+45]],uv=[[.83,.90],[1,.90],[1,1],[.83,1]];for(const ids of [[0,1,2],[0,2,3]])sleeve.push({pts:ids.map(i=>a[i]),uv:ids.map(i=>uv[i])});}
 return {rest,mix,center,normal:n,worldW,worldH,triangles,sleeve};
}
function makeWood(makeCanvas){if(!makeCanvas)return null;const c=makeCanvas(128,512),g=c.getContext('2d');g.fillStyle=blend(P.paper,P.blue,.18);g.fillRect(0,0,128,512);let seed=841;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let i=0;i<350;i++){const x=rnd()*128,y=rnd()*512;g.strokeStyle=i%5?P.ink:P.paper;g.globalAlpha=.035+rnd()*.1;g.lineWidth=.3+rnd()*.75;g.beginPath();g.moveTo(x,y);g.bezierCurveTo(x+6*rnd(),y+40,x-6*rnd(),y+100,x+2,y+120+rnd()*120);g.stroke();}g.globalAlpha=.17;g.strokeStyle=P.ink;for(let i=0;i<9;i++){g.beginPath();g.ellipse(41,297,2+i*2,7+i*7,-.06,0,Math.PI*2);g.stroke();}g.globalAlpha=1;return c;}
function makeTarget(makeCanvas){if(!makeCanvas)return null;const c=makeCanvas(640,640),g=c.getContext('2d');g.translate(320,320);g.beginPath();g.arc(0,0,301,0,Math.PI*2);g.fillStyle=P.ink;g.fill();g.beginPath();g.arc(-2,-3,296,0,Math.PI*2);g.fillStyle=P.paper;g.fill();g.beginPath();g.arc(-2,-3,284,0,Math.PI*2);g.fillStyle=P.red;g.fill();g.beginPath();g.arc(-2,-3,244,0,Math.PI*2);g.fillStyle=P.paper;g.fill();let seed=548;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let i=0;i<1900;i++){const x=(rnd()-.5)*580,y=(rnd()-.5)*580;if(x*x+y*y>288*288)continue;g.strokeStyle=i%3?P.ink:P.paper;g.globalAlpha=.055+rnd()*.12;g.lineWidth=.4+rnd()*.6;g.beginPath();g.moveTo(x,y);g.lineTo(x+2+rnd()*7,y+(rnd()-.5)*3);g.stroke();}g.globalAlpha=.8;g.strokeStyle=P.red;g.lineWidth=1.3;g.beginPath();g.arc(-2,-3,177,0,Math.PI*2);g.stroke();g.globalAlpha=.93;g.beginPath();g.arc(-2,-3,16,0,Math.PI*2);g.fillStyle=P.red;g.fill();g.globalAlpha=.35;g.strokeStyle=P.paper;g.lineWidth=.8;for(let i=0;i<160;i++){const a=i/160*Math.PI*2;g.beginPath();g.moveTo(Math.cos(a)*252,Math.sin(a)*252);g.lineTo(Math.cos(a+.002)*(276+rnd()*8),Math.sin(a+.002)*(276+rnd()*8));g.stroke();}g.globalAlpha=1;return c;}
function buildScene(){const faces=[];const face=(v,fill,opts={})=>faces.push({v,fill,...opts});const quad=(a,b,c,d,color,o)=>face([a,b,c,d],color,o);const box=(x0,y0,z0,x1,y1,z1,color,wood=false)=>{quad([x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],color,{wood,box:true});quad([x1,y0,z1],[x0,y0,z1],[x0,y1,z1],[x1,y1,z1],color,{wood,box:true});quad([x0,y0,z1],[x0,y0,z0],[x0,y1,z0],[x0,y1,z1],blend(color,P.ink,.52),{wood,box:true});quad([x1,y0,z0],[x1,y0,z1],[x1,y1,z1],[x1,y1,z0],blend(color,P.paper,.12),{wood,box:true});quad([x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1],blend(color,P.paper,.3));quad([x0,y0,z1],[x1,y0,z1],[x1,y0,z0],[x0,y0,z0],blend(color,P.ink,.62),{wood,box:true});};
 // Staggered full-dimensional plank floor: each board keeps grain orientation in world space.
 for(let x=-5;x<5;x+=1.25)for(let k=0;k<6;k++){const z=-3+k*3+(Math.round(x/1.25)%2)*.75;quad([x,0,z],[x+1.24,0,z],[x+1.24,0,z+2.98],[x,0,z+2.98],P.paper,{wood:true,floor:true});}
 // Soft, static paper canopy planes catch the side light, underneath timber rafters.
 for(let x=-5;x<5;x+=2.5){quad([x,5.13,-2],[x+2.5,5.13,-2],[x+2.5,5.13,13.2],[x,5.13,13.2],blend(P.paper,P.blue,.04+(x+5)/10*.06),{canopy:true});}
 // Rear paper wall is real world geometry; its botanical print follows the plane.
 quad([-5,0,13.1],[5,0,13.1],[5,5,13.1],[-5,5,13.1],P.paper,{reed:true});
 // Side paper screens, divided into timber bays. The lower panels carry the print.
 for(const side of [-1,1]){for(let z=-2;z<13;z+=3){const x=side*5;quad([x,0,z],[x,0,z+2.95],[x,4.65,z+2.95],[x,4.65,z],blend(P.paper,P.blue,side===-1?.08:.19),{reed:true,shade:side===-1?.08:.15});box(x-.10,0,z-.10,x+.10,4.85,z+.10,P.blue,true);box(x-.07,1.05,z,x+.07,1.13,z+3,P.blue,true);box(x-.07,3.8,z,x+.07,3.86,z+3,P.blue,true);for(let t=.58;t<3;t+=.58)box(x-.055,3.85,z+t,x+.055,4.7,z+t+.025,P.blue);}}
 for(let x=-5;x<=5;x+=2.5)box(x-.08,0,13,x+.08,4.95,13.18,P.blue,true);
 box(-5.15,4.6,-2,5.15,4.85,-1.75,P.blue,true);box(-5.15,4.6,5.6,5.15,4.85,5.82,P.blue,true);box(-5.15,4.6,12.8,5.15,4.85,13.12,P.blue,true);
 // Slatted overhead canopy and subtle, stationary cast shadows on the floor.
 for(let x=-5;x<5;x+=.8){box(x,4.95,-2,x+.105,5.05,13.2,P.blue,true);quad([x+.75,.008,-2],[x+1,.008,-2],[x+3.15,.008,13],[x+2.9,.008,13],P.blue,{alpha:.08});}
 // Working benches at the sides, with stacked printing boards. They lie outside walk bounds.
 for(const side of [-1,1]){const a=side<0?-5:-4.95+9.2,b=side<0?-4.25:4.95;box(a,.64,6,b,.75,11,blend(P.paper,P.blue,.27),true);for(let z=6.2;z<10.8;z+=2.2){box(a+.1,0,z,b-.1,.65,z+.11,P.blue,true);for(let i=0;i<3;i++)box(a+.06,.75+i*.045,z+.15,b-.05,.79+i*.045,z+1.65,i%2?P.paper:blend(P.paper,P.blue,.3),true);}}
 // Target frame: no sacred architecture or copied symbols.
 box(-.085,0,11.96,.085,.65,12.14,P.blue,true);box(-2.56,2.23,12.03,2.56,2.36,12.16,P.blue,true);
 for(const side of [-1,1]){const x=side*5;quad([x,.012,-2],[x-side*.48,.012,-2],[x-side*.48,.012,13],[x,.012,13],P.blue,{alpha:.14});quad([x,.012,-2],[x-side*.13,.012,-2],[x-side*.13,.012,13],[x,.012,13],P.ink,{alpha:.12});}quad([-5,.013,12.65],[5,.013,12.65],[5,.013,13],[-5,.013,13],P.blue,{alpha:.16});return faces;}
function lerp(a,b,t){return a.map((v,i)=>v+(b[i]-v)*t);}
function drawMesh(surface,pr,v,img,div=1){if(!img)return;const [a,b,c,d]=v;for(let row=0;row<div;row++)for(let col=0;col<div;col++){const u0=col/div,u1=(col+1)/div,v0=row/div,v1=(row+1)/div;const world=(u,t)=>lerp(lerp(a,b,u),lerp(d,c,u),t);const verts=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(uv=>[...pr.camera(world(...uv)),...uv]);for(const ids of [[0,1,2],[0,2,3]]){const points=clipNear(ids.map(i=>verts[i]));for(let j=1;j<points.length-1;j++){const tri=[points[0],points[j],points[j+1]];surface.texture(img,tri.map(q=>pr.project(q)),tri.map(q=>[q[3],1-q[4]]));}}}}
function circleWorld(surface,pr,x,y,z,r,fill,stroke,width=1){const points=Array.from({length:72},(_,i)=>pr.camera([x+Math.cos(i/72*Math.PI*2)*r,y+Math.sin(i/72*Math.PI*2)*r,z]));const clipped=clipNear(points);if(clipped.length>=3)surface.poly(clipped.map(pr.project),fill,stroke,width);}
function createRenderer({surface,assets={},makeCanvas=null}){const faces=buildScene().map(f=>{const a=f.v[0],b=f.v[1],c=f.v[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]);return {...f,outline:blend(P.ink,P.paper,.15),normal:[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]};}),wood=assets.wood||makeWood(makeCanvas),target=assets.target||makeTarget(makeCanvas);const grain=[];let seed=2381;const rnd=()=>((seed=Math.imul(seed,1664525)+1013904223>>>0)/4294967296);for(let i=0;i<130;i++)grain.push([rnd(),rnd(),rnd()*.013+.003]);
 function render(s,w,h,guard=false){surface.begin(w,h);const pr=createProjector(s.player,w,h),rect=(x,y,ww,hh,c,alpha=1)=>surface.poly([[x,y],[x+ww,y],[x+ww,y+hh],[x,y+hh]],c,null,1,alpha);
 rect(0,0,w,h,P.paper);rect(0,0,w,h*.52,P.blue,.12);
 const sorted=faces.filter(f=>!f.box||f.normal[0]*(f.v[0][0]-s.player.x)+f.normal[1]*(f.v[0][1]-C.EYE)+f.normal[2]*(f.v[0][2]-s.player.z)>0).map(f=>({f,q:f.v.map(pr.camera)})).filter(o=>o.q.some(p=>p[2]>.06)).sort((a,b)=>b.q.reduce((v,p)=>v+p[2],0)/b.q.length-a.q.reduce((v,p)=>v+p[2],0)/a.q.length);
 for(const {f,q} of sorted){const clip=clipNear(q);if(clip.length<3)continue;const pts=clip.map(pr.project);const area=pts.reduce((v,p,i)=>{const n=pts[(i+1)%pts.length];return v+p[0]*n[1]-n[0]*p[1];},0);if(f.box&&area>=0)continue;if(pts.every(p=>p[0]<0)||pts.every(p=>p[0]>w)||pts.every(p=>p[1]<0)||pts.every(p=>p[1]>h))continue;
 surface.poly(pts,f.fill,f.alpha?null:f.outline,f.floor?.7:.8,f.alpha||1);
 if(f.wood&&wood&&(f.floor||Math.abs(area)>6000)){const depth=q.reduce((n,p)=>n+p[2],0)/q.length,tint=f.floor?P.paper:f.fill,alpha=f.floor?(depth>6?.35:.18):.85,hasTexture=!f.floor||depth<9,handled=hasTexture&&surface.setMaterialTint?.(tint,alpha)===true;if(hasTexture)drawMesh(surface,pr,f.v,wood,1);if(!handled)surface.poly(pts,tint,null,1,alpha);surface.setMaterialTint?.(null,0);}
 if(f.reed&&assets.reed){const handled=f.shade&&surface.setMaterialTint?.(P.blue,f.shade)===true;drawMesh(surface,pr,f.v,assets.reed,1);if(f.shade&&!handled)surface.poly(pts,P.blue,null,1,f.shade);surface.setMaterialTint?.(null,0);}
 }
 // Flush only the world layer. Target, ball, hands and feedback remain full resolution.
 surface.worldDone?.();
 // A raised circular paper target and translucent block-print rings; exact physics geometry.
 const T=C.TARGET;circleWorld(surface,pr,T.x+.035,T.y-.035,T.z+.045,T.r+.035,P.ink,null);
 if(target){drawMesh(surface,pr,[[T.x-T.r*1.08,T.y-T.r*1.08,T.z-.02],[T.x+T.r*1.08,T.y-T.r*1.08,T.z-.02],[T.x+T.r*1.08,T.y+T.r*1.08,T.z-.02],[T.x-T.r*1.08,T.y+T.r*1.08,T.z-.02]],target,1);}else{circleWorld(surface,pr,T.x,T.y,T.z,T.r+.095,P.paper,P.ink,2);circleWorld(surface,pr,T.x,T.y,T.z-.008,T.r,P.red,P.ink,1.4);circleWorld(surface,pr,T.x,T.y,T.z-.015,T.r*.82,P.paper,null);circleWorld(surface,pr,T.x,T.y,T.z-.02,T.r*.60,null,P.red,1.2);circleWorld(surface,pr,T.x,T.y,T.z-.023,T.r*.07,P.red,null);}
 for(const x of [-1.25,1.25]){const rope=[[x,4.56,12.05],[x,3.84,12.04],[x*.98,3.77,12.01]].map(pr.point);if(rope.every(Boolean)){surface.line(rope.map(p=>p.slice(0,2)),P.ink,3);surface.line(rope.map(p=>[p[0]-.65,p[1]]),P.paper,1);}}
 for(const fl of s.flowers){const age=s.t-fl.t,g=C.clamp(age/.25,0,1),r=.65*g;for(let i=0;i<8;i++){const a=i*Math.PI/4,points=[[fl.x,fl.y,11.96],[fl.x+Math.cos(a-.15)*r*.64,fl.y+Math.sin(a-.15)*r*.64,11.96],[fl.x+Math.cos(a)*r,fl.y+Math.sin(a)*r,11.96],[fl.x+Math.cos(a+.3)*r*.5,fl.y+Math.sin(a+.3)*r*.5,11.96]].map(pr.camera);const cp=clipNear(points);if(cp.length>=3)surface.poly(cp.map(pr.project),i%2?P.blue:P.red,P.paper,1);}}
 // Ball shadow, then a hand-folded paper sphere with actual contour folds.
 const b=s.ball;if(b){const ballScreen=C.ballProjection(s.player,b,{width:w,height:h}),q=ballScreen?[ballScreen.x,ballScreen.y,ballScreen.depth]:null,shadow=pr.point([b.x,0.012,b.z]);if(shadow){const r=Math.min(w,pr.focal*.23/shadow[2]);surface.poly(Array.from({length:24},(_,i)=>[shadow[0]+Math.cos(i/24*Math.PI*2)*r,shadow[1]+Math.sin(i/24*Math.PI*2)*r*.18]),P.ink,null,1,.16);}if(q){const r=pr.focal*b.r/q[2];const reach=C.reachable(s.player,b,false,{width:w,height:h}),returned=b.kind==='returned';if(reach){const rr=r*1.23;for(let i=0;i<4;i++){const a=i*Math.PI/2+.16,points=Array.from({length:9},(_,j)=>[q[0]+Math.cos(a+j*.085)*rr,q[1]+Math.sin(a+j*.085)*rr]);surface.line(points,P.red,Math.max(1.5,r*.025));}}
 if(assets.ball){const ca=s.lastContact&&s.lastContact.id===b.id?s.t-s.lastContact.t:1,compress=ca>=0&&ca<.035?1-.10*(1-ca/.035):1;surface.image(assets.ball,q[0]-r*1.1,q[1]-r*1.1*compress,r*2.2,r*2.2*compress);}else{surface.circle(q[0],q[1],r,P.paper,P.ink,Math.max(1,r*.026));
 const edge=Array.from({length:9},(_,i)=>{const a=i/9*Math.PI*2-.2;return[q[0]+Math.cos(a)*r*.965,q[1]+Math.sin(a)*r*.965];});const inner=[q[0]-r*.08,q[1]-r*.07];for(let i=0;i<9;i++){const p=edge[i],n=edge[(i+1)%9],v=[inner[0]+Math.cos(i*2.3)*r*.3,inner[1]+Math.sin(i*1.7)*r*.3];surface.poly([p,n,v],i%3===0?blend(P.paper,P.blue,.27):i%3===1?blend(P.paper,P.red,.17):P.paper,P.ink,Math.max(.5,r*.006));surface.line([p,[v[0]+r*.018,v[1]+r*.027]],P.paper,Math.max(1,r*.008));}
 for(let i=0;i<14;i++){const g=grain[i];const yy=q[1]+(g[1]-.5)*r*1.4,xx=q[0]+(g[0]-.5)*r*1.4;surface.line([[xx,yy],[xx+r*.14,yy-r*.025]],P.blue,.5,.22);}
 }if(returned)surface.circle(q[0],q[1],r*1.10,null,P.red,1.5);
 }}
 // The camera never recoils. The opaque effective face follows the physical plane.
 const contact=s.lastContact,contactAge=contact?s.t-contact.t:Infinity,hand=paddleVisual(s,w,h,guard,assets.hand?assets.hand.height/assets.hand.width:1199/1312);
 if(assets.hand){if(hand.mix>0){for(const tri of hand.sleeve)surface.texture(assets.hand,tri.pts,tri.uv);for(const tri of hand.triangles)surface.texture(assets.hand,tri.pts,tri.uv);}else surface.image(assets.hand,...hand.rest);}else if(hand.center){const q=pr.point(hand.center);if(q)surface.circle(q[0],q[1],pr.focal*C.PADDLE.radius/q[2],P.paper,P.ink,3);}
 // One contact world point drives the local paper flash and the physical readout.
 if(contact&&contactAge>=0&&contactAge<.14){const p=pr.point([contact.point.x,contact.point.y,contact.point.z]);if(p){const gain=1-contactAge/.14,r=12+contactAge*80;for(let i=0;i<6;i++){const a=i*Math.PI/3;surface.line([[p[0]+Math.cos(a)*r,p[1]+Math.sin(a)*r],[p[0]+Math.cos(a)*(r+13*gain),p[1]+Math.sin(a)*(r+13*gain)]],contact.kind==='block'?P.blue:P.red,2.5*gain);}}}
 const age=s.t-s.lastAction.at,hit=s.lastAction.kind==='hit';
 const cx=pr.cx,cy=pr.cy;if(s.phase==='playing'||s.phase==='paused'){surface.circle(cx,cy,3,P.paper,P.ink,1);if(C.reachable(s.player,s.ball,false,{width:w,height:h}))surface.circle(cx,cy,9,null,P.red,1.5);if(guard){surface.line([[cx-35,cy+20],[cx,cy+34],[cx+35,cy+20]],P.blue,4);}}
 if(age>=0&&age<.4&&s.lastAction.kind==='miss'){rect(0,h-6,w,6,P.red,.7);surface.line([[cx-9,cy-9],[cx+9,cy+9]],P.red,2);surface.line([[cx+9,cy-9],[cx-9,cy+9]],P.red,2);}
 surface.end();return {projector:pr,operations:surface.ops};
 }
 return {render};}
const api={P,HAND_ART,paddleVisual,blend,createProjector,clipNear,CanvasSurface,SVGSurface,createRenderer,buildScene};if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperView=api;
})(typeof globalThis!=='undefined'?globalThis:this);
