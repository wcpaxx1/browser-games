export const VERSION = 1;
export const clamp = (n,a,b)=>Math.min(b,Math.max(a,n));
export function initialState(){return {version:VERSION,seed:2718,boat:{x:333,y:753,free:false},cloud:0,reeds:0,petals:[],birds:[],currents:[],found:[],strokes:0};}
export function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);}
export function simplify(points){const out=[];for(const p of points){const q={x:Math.round(clamp(p.x,0,1200)),y:Math.round(clamp(p.y,0,1000))};if(!out.length||distance(q,out.at(-1))>=9)out.push(q);}if(out.length<=180)return out;return Array.from({length:180},(_,i)=>out[Math.round(i*(out.length-1)/179)]);}
export function pathLength(p){return p.slice(1).reduce((sum,q,i)=>sum+distance(q,p[i]),0);}
function near(points,x,y,rx,ry){const p=points.map(q=>({x:(q.x-x)/rx,y:(q.y-y)/ry}));if(p.some(q=>q.x*q.x+q.y*q.y<=1))return true;return p.slice(1).some((b,i)=>{const a=p[i],dx=b.x-a.x,dy=b.y-a.y,t=clamp(-(a.x*dx+a.y*dy)/(dx*dx+dy*dy||1),0,1);return (a.x+t*dx)**2+(a.y+t*dy)**2<=1;});}
export function gesture(state,raw){const p=simplify(raw);if(p.length<2||pathLength(p)<25)return {state,events:[],changed:false};const s=structuredClone(state),a=p[0],b=p.at(-1),dx=b.x-a.x,dy=b.y-a.y;let events=[];
 s.strokes++;s.currents.push(p);s.currents=s.currents.slice(-4);
 if(near(p,320,731,110,102)||near(p,s.boat.x,s.boat.y,70,50)){
  s.reeds=clamp(dx/110,-1,1);if(dx>35||s.boat.free){s.boat.free=true;s.boat.x=clamp(s.boat.x+dx*.65,280,840);s.boat.y=clamp(s.boat.y+dy*.22,665,835);events.push('boat');}else events.push('reeds');
 }
 if(near(p,615+s.cloud*.3,340,200,108)&&Math.abs(dx)>25){s.cloud=clamp(s.cloud+dx*.75,-230,230);events.push('cloud');}
 if(near(p,815,518,150,148)){let q=p.length>1?p:[a,b];for(let i=0;i<22;i++){const f=i/22*(q.length-1),j=Math.floor(f),n=q[Math.min(j+1,q.length-1)],r=q[j];s.petals.push({x:clamp(r.x+(n.x-r.x)*(f-j)+Math.sin(i*7.1)*19,150,1100),y:clamp(r.y+(n.y-r.y)*(f-j)+26+Math.cos(i*2.6)*20,260,895),r:(i*67+Math.round(dx))%360});}s.petals=s.petals.slice(-88);s.birds=[{x:clamp(684+dx*.35,400,970),y:clamp(610+dy*.2,420,725),dir:dx<0?-1:1},{x:clamp(742+dx*.3,420,1000),y:clamp(572+dy*.18,390,720),dir:dx<0?-1:1}];events.push('plum');}
 for(const e of events)if(e!=='reeds'&&!s.found.includes(e))s.found.push(e);
 return {state:s,events,changed:true};
}
export function validState(s){return !!s&&s.version===VERSION&&Number.isInteger(s.seed)&&s.seed>=0&&s.seed<=1e7&&Number.isInteger(s.strokes)&&s.strokes>=0&&s.strokes<1e6&&s.boat&&[s.boat.x,s.boat.y,s.cloud,s.reeds].every(Number.isFinite)&&s.boat.x>=280&&s.boat.x<=840&&s.boat.y>=665&&s.boat.y<=835&&typeof s.boat.free==='boolean'&&Math.abs(s.cloud)<=230&&Math.abs(s.reeds)<=1&&Array.isArray(s.petals)&&s.petals.length<=88&&s.petals.every(p=>[p.x,p.y,p.r].every(Number.isFinite)&&p.x>=0&&p.x<=1200&&p.y>=0&&p.y<=1000)&&Array.isArray(s.birds)&&s.birds.length<=2&&s.birds.every(p=>[p.x,p.y,p.dir].every(Number.isFinite)&&Math.abs(p.dir)===1&&p.x>=0&&p.x<=1200&&p.y>=0&&p.y<=1000)&&Array.isArray(s.currents)&&s.currents.length<=4&&s.currents.every(p=>Array.isArray(p)&&p.length<=180&&p.every(q=>Number.isFinite(q.x)&&Number.isFinite(q.y)&&q.x>=0&&q.x<=1200&&q.y>=0&&q.y<=1000))&&Array.isArray(s.found)&&s.found.length<=3&&s.found.every(x=>['boat','cloud','plum'].includes(x));}
export function encodeScene(s){if(!validState(s))throw Error('Invalid scene');return 'JF1.'+btoa(JSON.stringify(s));}
export function decodeScene(text){if(typeof text!=='string'||text.length>30000||!text.startsWith('JF1.'))throw Error('Invalid scene');const s=JSON.parse(atob(text.slice(4)));if(!validState(s))throw Error('Invalid scene');return s;}
