/* Shared opaque world geometry, exact camera and nearest-ray queries. Renderer and gameplay consume the same faces. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),hash=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x)},TAN=Math.tan(Math.PI*.2),NEAR=.075;
function camera(g,view={}){const p=g.sim.entities.find(e=>e.id===g.pilot)||g.sim.wrecks.at(-1)||{x:17,y:9},w=view.width||1280,h=view.height||800,f=w/(2*TAN);return {x:p.x,y:p.y,z:1.13+(view.reduced?0:Math.sin(g.sim.tick*.7)*.012*(view.moving?1:0)),yaw:g.yaw,w,h,f,horizon:h*.43+(view.reduced?0:g.recoil*11)+g.pitch*f};}
function cameraPoint(cam,v){const dx=v[0]-cam.x,dy=v[1]-cam.y;return{x:-dx*Math.sin(cam.yaw)+dy*Math.cos(cam.yaw),z:dx*Math.cos(cam.yaw)+dy*Math.sin(cam.yaw),y:v[2]-cam.z};}
function cockpitPolygon(w,h){const b=h*.855;return [[0,h*.82],[w*.23,b],[w*.39,b+.015*h],[w*.43,h*.81],[w*.57,h*.81],[w*.61,b+.015*h],[w*.77,b],[w,h*.82],[w,h],[0,h]];}
function inside(poly,x,y){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;}
function screenRay(cam,nx=0,ny=0){const x=cam.w/2+nx*cam.w/2,y=cam.h*.43+ny*cam.w/2,scale=Math.min(cam.w/1100,cam.h/700);if(x<14*scale||x>cam.w-14*scale||y<12*scale||y>cam.h||inside(cockpitPolygon(cam.w,cam.h),x,y))return null;
 const side=(x-cam.w/2)/cam.f,up=(cam.horizon-y)/cam.f,c=Math.cos(cam.yaw),s=Math.sin(cam.yaw),d=[c-side*s,s+side*c,up],len=Math.hypot(...d);return{o:[cam.x,cam.y,cam.z],d:d.map(v=>v/len),near:NEAR*len,limit:60};}
class Mesh{constructor(cam){this.cam=cam;this.faces=[];this.smoke=[];this.owner=0;this.material=null;this.vertices=[];this.pool=new Map();}point(v){return cameraPoint(this.cam,v)}polygon(vs,color){for(let i=1;i<vs.length-1;i++){const tri=[vs[0],vs[i],vs[i+1]],a=tri[0],b=tri[1],c=tri[2],u=b.map((v,i)=>v-a[i]),v=c.map((v,i)=>v-a[i]),normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],points=tri.map(world=>{const key=(this.part||'')+':'+world.join(',');let p=this.pool.get(key);if(!p){p={world,part:this.part||'hull',x:0,y:0,iz:0,cz:0,cy:0,cx:0};this.pool.set(key,p);this.vertices.push(p);}return p;});this.faces.push({vs:tri,points,normal,color,sortDepth:0.1,owner:this.owner,material:this.material,part:this.part||'hull'});}}

 bevel(x,y,z,l,w,h,col,angle=0){const r=.035,p=(a,b,k)=>this.local(x,y,z,angle,a,b,k),base=[p(-l/2,-w/2,r),p(l/2,-w/2,r),p(l/2,w/2,r),p(-l/2,w/2,r)],top=[p(-l/2+r,-w/2+r,h),p(l/2-r,-w/2+r,h),p(l/2-r,w/2-r,h),p(-l/2+r,w/2-r,h)];for(let i=0;i<4;i++)this.polygon([base[i],base[(i+1)%4],top[(i+1)%4],top[i]],col.map(v=>v*(.68+i*.07)));this.polygon(top,col.map(v=>v*1.13));}
 local(x,y,z,angle,a,b,h){return [x+Math.cos(angle)*a-Math.sin(angle)*b,y+Math.sin(angle)*a+Math.cos(angle)*b,z+h];}
 box(x,y,z,l,w,h,color,angle=0){const p=(a,b,k)=>this.local(x,y,z,angle,a,b,k),a=p(-l/2,-w/2,0),b=p(l/2,-w/2,0),d=p(-l/2,w/2,0),e=p(l/2,w/2,0),A=p(-l/2,-w/2,h),B=p(l/2,-w/2,h),D=p(-l/2,w/2,h),E=p(l/2,w/2,h);
 this.polygon([a,b,B,A],color.map(v=>v*.62));this.polygon([e,d,D,E],color.map(v=>v*.81));this.polygon([d,a,A,D],color.map(v=>v*.73));this.polygon([b,e,E,B],color.map(v=>v*.92));this.polygon([A,B,E,D],color.map(v=>v*1.12));}
 cylinder(x,y,z,r,h,color,n=12){const top=[],bottom=[];for(let i=0;i<n;i++){const a=i/n*Math.PI*2,b=(i+1)/n*Math.PI*2,p=[x+Math.cos(a)*r,y+Math.sin(a)*r,z],q=[x+Math.cos(b)*r,y+Math.sin(b)*r,z];top.push([p[0],p[1],z+h]);bottom.push(p);this.polygon([p,q,[q[0],q[1],z+h],[p[0],p[1],z+h]],color.map(v=>v*(.55+.4*(1+Math.cos(a-2))/2)));}this.polygon(top,color.map(v=>v*1.1));}
 rock(x,y,r,h,seed,z=0,col=[125,124,103]){const lo=[],hi=[];for(let i=0;i<7;i++){const a=i/7*Math.PI*2,b=r*(.7+hash(i+seed)*.4);lo.push([x+Math.cos(a)*b,y+Math.sin(a)*b,z]);hi.push([x+Math.cos(a)*b*.48,y+Math.sin(a)*b*.48,z+h*(.7+hash(i*2+seed)*.3)]);}for(let i=0;i<7;i++)this.polygon([lo[i],lo[(i+1)%7],hi[(i+1)%7],hi[i]],col.map(v=>v*(.7+hash(i)*.35)));this.polygon(hi,col);}
 shadow(x,y,l,w,angle=0){const p=(a,b)=>this.local(x,y,.006,angle,a,b,0);this.polygon([p(-l/2,-w/2),p(l/2,-w/2),p(l/2,w/2),p(-l/2,w/2)],[69,66,50]);}
 tank(e,dead=false){this.part='hull';this.owner=e.id||0;this.material="metal";const a=e.angle,c=dead?[57,54,47]:[82,104,93],p=(x,y,z)=>this.local(e.x,e.y,0,a,x,y,z);
 for(const side of [-1,1]){const t=p(0,.32*side,.13);this.box(...t,.94,.20,.24,[38,40,35],a);for(let i=0;i<7;i++){const q=p(-.39+i*.13,.431*side,.235),s=.045;this.box(...q,.095,.02,.105,[85,85,69],a);const b=p(-.42+i*.14,.32*side,.36);this.box(...b,.055,.215,.016,[72,73,58],a);}}
 let t=p(0,0,.34);this.bevel(...t,.93,.59,.17,c,a);t=p(.32,0,.39);this.bevel(...t,.22,.56,.12,c.map(v=>v+12),a);t=p(-.22,0,.51);this.box(...t,.28,.47,.035,[68,76,63],a);
 for(let i=0;i<6;i++){t=p(-.34+i*.04,0,.55);this.box(...t,.017,.35,.013,[35,43,39],a);}
 this.part='turret';this.bevel(e.x,e.y,.5,.54,.47,.22,c,e.turret??a);this.part='hatch';this.cylinder(e.x-.06*Math.cos(a),e.y-.06*Math.sin(a),.72,.115,.045,[55,66,55]);this.part='hull';
 this.part='turret';const turret=e.turret??a;t=this.local(e.x,e.y,.62,turret,.53,0,0);this.box(...t,.76,.078,.075,[66,77,66],turret);t=this.local(e.x,e.y,.62,turret,.90,0,0);this.box(...t,.10,.12,.11,[34,41,35],turret);this.part='hull';
 t=p(-.12,-.26,.54);this.box(...t,.22,.018,.12,e.team?[159,51,34]:[65,154,159],a);
 for(const side of [-1,1]){t=p(.46,side*.19,.48);this.box(...t,.013,.055,.04,[204,203,159],a);}
 this.part='antenna';t=p(-.29,.20,.57);this.box(...t,.014,.014,.59,[31,37,32]);this.part='hull';
 }
 outpost(e,s,encounter){this.owner=e.id;this.material="concrete";const x=e.x,y=e.y,damage=1-e.hp/root.Tempest.SPEC.goal.hp;
 this.box(x,y,0,2.22,2.75,.17,[98,98,84]);this.box(x,y,.17,1.9,2.3,.95,[159,163,147]);this.box(x,y,1.12,2.05,2.43,.15,[98,107,91]);
 if(encounter==='flank-v1'){
 // Thick face armour and a recessed north-side radiator. The orange radiator
 // and its grille are vulnerable; the backing/frame stays armored.
 this.material='metal';for(let i=0;i<5;i++)this.box(x-1.02,y-.91+i*.45,.25,.10,.40,.70,[70,92,103]);
 this.box(x,y-1.43,.31,1.15,.18,1.08,[43,55,55]);this.box(x,y-1.50,.30,1.26,.05,.08,[93,98,81]);this.box(x,y-1.50,1.34,1.26,.05,.08,[93,98,81]);
 this.material='weakpoint';this.polygon([[x-.50,y-1.521,.38],[x+.50,y-1.521,.38],[x+.50,y-1.521,1.30],[x-.50,y-1.521,1.30]],[245,132,47]);
 this.material='weakpoint';for(let i=0;i<5;i++)this.box(x-.4+i*.2,y-1.53,.4,.018,.028,.86,[94,54,29]);this.material='concrete';
 }
 // Armoured service door, inset slats, side bays, concrete joints and small faction panels.
 this.box(x-.99,y,.16,.06,.65,.04,[84,91,81]);this.box(x-.99,y,1.0,.06,.65,.06,[86,94,83]);for(const side of [-1,1]){this.box(x-1.0,y+side*.31,.18,.075,.045,.84,[72,83,75]);this.box(x-.99,y+side*.50,.3,.025,.025,.72,[77,84,70]);}
 this.box(x-.965,y,.18,.04,.56,.75,[49,60,55]);for(let i=0;i<8;i++)this.box(x-.995,y,.23+i*.083,.017,.51,.016,[84,91,76]);
 for(const side of [-1,1]){this.box(x-.98,y+side*.80,.52,.05,.55,.28,[32,44,40]);for(let i=0;i<4;i++)this.box(x-1.018,y+side*.80,.55+i*.049,.018,.49,.018,[86,91,73]);this.box(x-.98,y+side*1.03,.83,.037,.08,.15,[174,60,40]);
  this.box(x+.3,y+side*1.22,.28,.65,.24,.50,[94,111,95]);for(let i=0;i<7;i++)this.box(x+.05+i*.085,y+side*1.35,.31,.025,.024,.39,[36,52,46]);}
 for(let i=0;i<6;i++){this.box(x-.956,y-1.1+i*.43,.18,.014,.015,.94,[104,110,95]);this.box(x-.962,y,.39+i*.125,.016,2.27,.011,[116,123,106]);}
 for(const sy of [-1,1]){for(let i=0;i<4;i++)this.box(x-.68+i*.46,y+sy*1.11,1.27,.025,.025,.19,[65,77,65]);this.box(x,y+sy*1.11,1.44,1.62,.022,.021,[72,83,70]);}
 this.box(x+.45,y+.73,1.26,.73,.57,.14,[65,76,65]);this.cylinder(x+.45,y+.73,1.4,.22,.055,[42,54,45]);
 this.cylinder(x-.25,y-.3,1.25,.40,.32,[101,108,88]);this.box(x-.75,y-.3,1.43,1.00,.135,.14,[48,59,50]);this.box(x-1.24,y-.3,1.41,.12,.2,.19,[28,37,30]);
 this.box(x+.63,y-.86,1.27,.035,.035,2.2,[45,57,49]);for(let i=0;i<4;i++)this.box(x+.63,y-.86,2.1+i*.28,.65-i*.12,.018,.018,[54,65,55]);this.box(x+.63,y-.86,3.48,.055,.055,.055,[250,93,43]);
 for(let i=0;i<12;i++){const yy=y-1.6+i*.3;this.bevel(x-1.35,yy,.025,.28,.29,.14,[125+hash(i)*15,113,84],.1*Math.sin(i));if(i<4||i>7)this.bevel(x-1.35,yy,.17,.27,.27,.14,[147,135,102],-.1);}
 for(let i=0;i<6;i++)this.box(x+.9,y+1.4+i*.06,0,.37,.04,.39,[76,78,65]);
 if(damage>.12){for(let i=0;i<7;i++){const u=(s.tick/37+i*.18)%1;this.smoke.push({x:x+.25+Math.sin(i)*u*.3,y:y+.1,z:1.3+u*2.7,r:.12+u*.55,alpha:.38*(1-u)});}}
 }
 ground(s){this.material="ground";this.owner=0;const px=Math.floor(this.cam.x),py=Math.floor(this.cam.y);for(let x=Math.max(-6,px-24);x<Math.min(48,px+39);x++)for(let y=Math.max(-9,py-26);y<Math.min(36,py+27);y++){
 const q=this.point([x+.5,y+.5,0]);if(q.z<-.7||q.z>48||Math.abs(q.x)>q.z*1.0+2)continue;
 const n=hash(x*49+y*13+s.seed),m=(Math.sin(x*.18)+Math.cos(y*.21))*4,road=Math.abs(y-9)<1.55&&x>10&&x<24;
 const col=road?[109+m+n*8,105+m+n*7,83+m+n*5]:[142+m+n*6,132+m+n*5,98+m+n*5];this.polygon([[x,y,0],[x+1,y,0],[x+1,y+1,0],[x,y+1,0]],col);
 for(let k=0;k<5;k++){const a=x+hash(x*154+y*19+k*42),b=y+hash(x*53+y*113+k*31),r=.013+hash(k+y+x)*.048;this.polygon([[a-r,b-r,.002],[a+r,b-r,.002],[a+r*.5,b+r,.003],[a-r*.7,b+r*.4,.002]],col.map(v=>v*(k%2?.77:1.11)));}
 if(road)for(const side of [-1,1]){const b=9+side*.95;this.polygon([[x,b-.1,.005],[x+1,b-.1,.005],[x+1,b+.1,.005],[x,b+.1,.005]],[83+m,82+m,64+m]);}
 }this.material=null;}
 scenery(s){this.owner=0;for(let i=0;i<54;i++){const x=9+hash(i*21+s.seed)*30,y=hash(i*39+11+s.seed)*24;if(Math.abs(y-9)<2.7||s.entities.some(e=>root.Tempest.SPEC[e.type].building&&Math.hypot(e.x-x,e.y-y)<2.3))continue;const v=hash(i*9),h=.15+v*.55;this.rock(x,y,.2+v*.35,h,i);if(i%6===0){this.box(x,y,0,.075,.075,.9,[78,77,49]);for(let k=0;k<4;k++)this.rock(x+Math.sin(k)*.10,y+Math.cos(k)*.12,.17,.26,i+k,.48+k*.09,[70,88,51]);}}
 // Distant base silhouettes use real depth, never an overhead inset.
 for(const e of s.entities.filter(e=>e.team===0&&root.Tempest.SPEC[e.type].building)){this.owner=e.id;this.box(e.x,e.y,0,1.8,1.8,.9,[113,127,108]);this.box(e.x,e.y,.9,2,2,.14,[70,92,81]);this.box(e.x-.95,e.y,.6,.025,.3,.18,[54,143,149]);}
 }

}
function build(g,view={},options={}){const cam=options.camera||camera(g,view),m=new Mesh(cam),s=g.sim,exclude=options.excludeId??g.pilot;
 if(!options.rayOnly&&!options.skipGround)m.ground(s);{m.material="ground";for(const e of s.entities.filter(e=>e.id!==exclude)){m.owner=0;const l=root.Tempest.SPEC[e.type].building?2.6:1.15;m.shadow(e.x+.17,e.y+.17,l,l*.72,e.angle);}}
 m.material=null;m.scenery(s);for(const e of s.entities){if(e.id===exclude)continue;if(e.type==='ranger')m.tank(e);else if(e.type==='goal')m.outpost(e,s,g.encounter);}
 for(const e of s.wrecks){m.owner=0;if(e.type==='ranger')m.tank(e,true);else if(e.type==='goal'){m.box(e.x,e.y,0,2.2,2.5,.22,[59,65,53]);for(let i=0;i<18;i++)m.box(e.x+hash(i)*2-1,e.y+hash(i*2)*2-1,.15,.25,.25,hash(i*3)*.4,[81,85,65],i);}}
 return m;
}
const tankTemplates=new Map();
function actorMesh(e){const key=e.team;let template=tankTemplates.get(key);if(!template){template=new Mesh({});template.owner=0;template.material='ground';template.part='shadow';template.shadow(.17,.17,1.15,1.15*.72,0);template.tank({...e,id:1,x:0,y:0,angle:0,turret:0});tankTemplates.set(key,template);}
 const vertices=template.vertices.map(p=>({...p,world:[...p.world],local:p.world})),map=new Map(template.vertices.map((p,i)=>[p,vertices[i]])),faces=template.faces.map(f=>({...f,owner:f.material==='ground'?0:e.id,normal:[...f.normal],localNormal:f.normal,points:f.points.map(p=>map.get(p)),vs:f.points.map(p=>map.get(p).world)})),mesh={vertices,faces};refitActor(mesh,e);return mesh;}
function refitActor(mesh,e){const a=e.angle,t=e.turret??a,ca=Math.cos(a),sa=Math.sin(a),ct=Math.cos(t),st=Math.sin(t);for(const p of mesh.vertices){if(p.part==='antenna'){p.world[0]=e.x-.29*ca-.20*sa+p.local[0]+.29;p.world[1]=e.y-.29*sa+.20*ca+p.local[1]-.20;p.world[2]=p.local[2];continue;}if(p.part==='hatch'){p.world[0]=e.x-.06*ca+p.local[0]+.06;p.world[1]=e.y-.06*sa+p.local[1];p.world[2]=p.local[2];continue;}const turret=p.part==='turret',shadow=p.part==='shadow',c=turret?ct:ca,s=turret?st:sa,ox=shadow?.17:0,x=p.local[0]-ox,y=p.local[1]-ox;p.world[0]=e.x+ox+c*x-s*y;p.world[1]=e.y+ox+s*x+c*y;p.world[2]=p.local[2];}for(const f of mesh.faces){const c=(f.part==='hatch'||f.part==='antenna')?1:f.part==='turret'?ct:ca,s=(f.part==='hatch'||f.part==='antenna')?0:f.part==='turret'?st:sa,n=f.localNormal;f.normal[0]=c*n[0]-s*n[1];f.normal[1]=s*n[0]+c*n[1];f.normal[2]=n[2];}}
const cache=new WeakMap();
function scene(g,view={}){const s=g.sim;let state=cache.get(g);if(!state){state={statics:null,staticKey:'',units:new Map(),wreckKey:'',wreck:null,scene:null};cache.set(g,state);}const cam=camera(g,view);
 const buildings=s.entities.filter(e=>root.Tempest.SPEC[e.type].building),staticKey=JSON.stringify([s.seed,g.encounter,buildings.map(e=>[e.id,e.type,e.x,e.y])]);let changed=false;
 if(state.staticKey!==staticKey){const m=new Mesh(cam);m.scenery({...s,entities:buildings});for(const e of buildings){m.material='ground';m.owner=0;m.shadow(e.x+.17,e.y+.17,2.6,2.6*.72,e.angle);if(e.type==='goal')m.outpost(e,s,g.encounter);}state.statics=m;state.staticKey=staticKey;changed=true;}
 const live=new Set();for(const e of s.entities){if(e.id===g.pilot||e.type!=='ranger')continue;live.add(e.id);const key=[e.type,e.team,e.x,e.y,e.angle,e.turret].join('|'),old=state.units.get(e.id);if(!old){state.units.set(e.id,{key,mesh:actorMesh(e)});changed=true;}else if(old.key!==key){refitActor(old.mesh,e);old.key=key;}}
 for(const id of state.units.keys())if(!live.has(id)){state.units.delete(id);changed=true;}
 const wreckKey=JSON.stringify(s.wrecks);if(state.wreckKey!==wreckKey){const m=new Mesh(cam);for(const e of s.wrecks){m.owner=0;if(e.type==='ranger')m.tank(e,true);else if(e.type==='goal'){m.box(e.x,e.y,0,2.2,2.5,.22,[59,65,53]);for(let i=0;i<18;i++)m.box(e.x+hash(i)*2-1,e.y+hash(i*2)*2-1,.15,.25,.25,hash(i*3)*.4,[81,85,65],i);}}state.wreck=m;state.wreckKey=wreckKey;changed=true;}
 if(changed||!state.scene){const parts=[state.statics,...[...state.units.values()].map(v=>v.mesh),state.wreck].filter(Boolean);state.scene={faces:parts.flatMap(m=>m.faces),vertices:parts.flatMap(m=>m.vertices),parts,staticMesh:state.statics};}return state.scene;}

const sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
function triangle(ray,a,b,c,limit=ray.limit){const ex=b[0]-a[0],ey=b[1]-a[1],ez=b[2]-a[2],fx=c[0]-a[0],fy=c[1]-a[1],fz=c[2]-a[2],dx=ray.d[0],dy=ray.d[1],dz=ray.d[2],hx=dy*fz-dz*fy,hy=dz*fx-dx*fz,hz=dx*fy-dy*fx,det=ex*hx+ey*hy+ez*hz;if(det<1e-10)return null;const inv=1/det,sx=ray.o[0]-a[0],sy=ray.o[1]-a[1],sz=ray.o[2]-a[2],u=(sx*hx+sy*hy+sz*hz)*inv;if(u< -1e-9||u>1+1e-9)return null;const qx=sy*ez-sz*ey,qy=sz*ex-sx*ez,qz=sx*ey-sy*ex,v=(dx*qx+dy*qy+dz*qz)*inv;if(v< -1e-9||u+v>1+1e-9)return null;const t=(fx*qx+fy*qy+fz*qz)*inv;return t>=ray.near&&t<=limit?t:null;}

function cast(mesh,ray){if(!ray)return null;let best=null,distance=ray.limit;
 // The opaque terrain surface is the shared z=0 plane. Decorative road/gravel/shadow overlays never act as blockers.
 if(ray.d[2]<0){const d=-ray.o[2]/ray.d[2];if(d>=ray.near&&d<=distance){distance=d;best={owner:0,distance:d,point:ray.o.map((v,i)=>v+ray.d[i]*d),kind:'ground'};}}
 for(const f of mesh.faces){if(f.material==='ground'||f.owner===ray.ignoreOwner)continue;const v=f.vs;for(let i=1;i<v.length-1;i++){const t=triangle(ray,v[0],v[i],v[i+1],distance);if(t!==null&&t<distance-1e-8){distance=t;best={owner:f.owner,distance:t,point:ray.o.map((v,i)=>v+ray.d[i]*t),face:f,kind:'geometry'};}}}return best;}
function pick(g,nx=0,ny=0,view={}){const cam=camera(g,view),ray=screenRay(cam,nx,ny);return {ray,hit:cast(scene(g,view),ray),camera:cam};}
root.CockpitGeometry={camera,cameraPoint,screenRay,cockpitPolygon,inside,build,scene,cast,pick,triangle,NEAR};
})(globalThis);
