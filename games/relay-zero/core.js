(function(root,factory){if(typeof module==='object')module.exports=factory();else root.RelayCore=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const VERSION=2,KEY='relay-zero:v2:profile',OLDKEY='relay-zero:v1:profile';
const MAP=[
'111111111111111111',
'100000000000000001',
'100000000000000001',
'100011100011100001',
'100010000000100001',
'100010000000100001',
'100000011000000001',
'100000011000000001',
'101110000001110001',
'100000000000000001',
'100000110000000001',
'100000110011100001',
'100000000010000001',
'101110000010000001',
'100000000000000001',
'100000000000000001',
'100000000000000001',
'111111111111111111'];
const SPAWNS=[[6.5,4.5],[14.5,5.5],[4.5,10.5],[13.5,13.5]],PAD={x:15.3,y:15.3};
const defaults=()=>({version:VERSION,level:'relay-yard',settings:{sensitivity:1,sound:true,quality:'balanced'},progress:{wins:0,attempts:0,best:null},round:null});
const wall=(x,y)=>!MAP[Math.floor(y)]||MAP[Math.floor(y)][Math.floor(x)]!=='0';
function clear(x,y,r=.22){for(const dx of [-r,r])for(const dy of [-r,r])if(wall(x+dx,y+dy))return false;return true;}
function cast(x,y,a,max=30){const dx=Math.cos(a),dy=Math.sin(a);let mx=Math.floor(x),my=Math.floor(y),sx=dx<0?-1:1,sy=dy<0?-1:1;
const ddx=Math.abs(1/(dx||1e-12)),ddy=Math.abs(1/(dy||1e-12));let tx=(dx<0?x-mx:mx+1-x)*ddx,ty=(dy<0?y-my:my+1-y)*ddy,d=0,side=0;
for(let i=0;i<100&&d<max;i++){if(tx<ty){d=tx;tx+=ddx;mx+=sx;side=0;}else{d=ty;ty+=ddy;my+=sy;side=1;}if(wall(mx,my))return {d:Math.min(d,max),side,x:x+dx*d,y:y+dy*d};}return {d:max,side,x:x+dx*max,y:y+dy*max};}
function sight(a,b){const d=Math.hypot(b.x-a.x,b.y-a.y);return cast(a.x,a.y,Math.atan2(b.y-a.y,b.x-a.x),d+.1).d>=d;}
function random(s){s.rng=(Math.imul(s.rng,1664525)+1013904223)>>>0;return s.rng/4294967296;}
function create(seed=24017){return {seed:seed>>>0,rng:seed>>>0,state:'ready',time:120,elapsed:0,player:{x:2.5,y:2.5,a:.35,hp:100},ammo:12,reserve:72,cool:0,reload:0,secure:0,kills:0,shots:0,hits:0,enemies:SPAWNS.map((p,i)=>({id:i,x:p[0],y:p[1],hp:60,cool:1.8+i*.4,alert:0,mode:'patrol',patrol:0})),events:[]};}
function move(body,dx,dy){if(clear(body.x+dx,body.y))body.x+=dx;if(clear(body.x,body.y+dy))body.y+=dy;}
function nextCell(a,b){let start=[Math.floor(a.x),Math.floor(a.y)],goal=[Math.floor(b.x),Math.floor(b.y)];if(start[0]===goal[0]&&start[1]===goal[1])return b;
let queue=[start],seen=new Map([[start.join(),null]]);for(let i=0;i<queue.length;i++){let p=queue[i];if(p[0]===goal[0]&&p[1]===goal[1]){let key=p.join(),prev=seen.get(key);while(prev&&prev.join()!==start.join()){p=prev;prev=seen.get(p.join());}return{x:p[0]+.5,y:p[1]+.5};}for(const [dx,dy]of[[1,0],[0,1],[-1,0],[0,-1]]){let n=[p[0]+dx,p[1]+dy],key=n.join();if(!wall(n[0],n[1])&&!seen.has(key)){seen.set(key,p);queue.push(n);}}}return a;}
function fire(s){if(s.state!=='active'||s.cool>0||s.reload>0||s.ammo<=0)return false;s.ammo--;s.shots++;s.cool=.21;s.events.push('shot');let p=s.player,dx=Math.cos(p.a),dy=Math.sin(p.a),nearest=cast(p.x,p.y,p.a).d,target=null;
for(const e of s.enemies){if(e.hp<=0)continue;let ex=e.x-p.x,ey=e.y-p.y,along=ex*dx+ey*dy,perp=ex*dy-ey*dx;if(along<=0||Math.abs(perp)>.32)continue;let near=Math.max(0,along-Math.sqrt(.32*.32-perp*perp));if(near<nearest&&near>=0){nearest=near;target=e;}}
if(target){s.hits++;target.hp=Math.max(0,target.hp-30);target.alert=7;s.events.push('hit');if(!target.hp){s.kills++;s.events.push('down');}}for(const e of s.enemies)if(e.hp>0&&Math.hypot(e.x-p.x,e.y-p.y)<7)e.alert=7;return true;}
function reload(s){if(s.state==='active'&&!s.reload&&s.ammo<12&&s.reserve>0){s.reload=1.45;s.events.push('reload');return true;}return false;}
function finish(s,state,reason){if(s.state!=='active')return;s.state=state;s.reason=reason;s.events.push(state);}
function step(s,input={},dt=1/60){if(s.state!=='active')return;dt=Math.max(0,Math.min(.05,dt));s.events=[];s.elapsed+=dt;s.time=Math.max(0,s.time-dt);s.cool=Math.max(0,s.cool-dt);
if(s.reload>0){s.reload=Math.max(0,s.reload-dt);if(s.reload===0){let n=Math.min(12-s.ammo,s.reserve);s.ammo+=n;s.reserve-=n;}}
let p=s.player;p.a=(p.a+(input.turn||0)*dt+Math.max(-.5,Math.min(.5,input.look||0)))%(Math.PI*2);let f=input.forward||0,r=input.strafe||0,len=Math.max(1,Math.hypot(f,r)),speed=input.slow?1.65:2.7;move(p,(Math.cos(p.a)*f-Math.sin(p.a)*r)/len*speed*dt,(Math.sin(p.a)*f+Math.cos(p.a)*r)/len*speed*dt);
if(input.reload)reload(s);if(input.fire)fire(s);
for(const e of s.enemies){if(e.hp<=0){e.mode='disabled';continue;}e.cool=Math.max(0,e.cool-dt);e.alert=Math.max(0,e.alert-dt);let d=Math.hypot(e.x-p.x,e.y-p.y),visible=d<9&&sight(e,p);if(visible)e.alert=7;
if(visible&&d<7){e.mode='aim';if(e.cool<=0){e.cool=1.4+random(s)*.7;s.events.push('enemy-shot');if(random(s)<.66){p.hp=Math.max(0,p.hp-9);s.events.push('hurt');}}}
else{e.mode=e.alert>0?'seek':'patrol';let target=e.alert>0?p:{x:SPAWNS[e.id][0]+(e.patrol?1:0),y:SPAWNS[e.id][1]};if(Math.hypot(target.x-e.x,target.y-e.y)<.16)e.patrol=1-e.patrol;let n=nextCell(e,target),nd=Math.hypot(n.x-e.x,n.y-e.y);if(nd>.05)move(e,(n.x-e.x)/nd*dt*(e.alert?1.15:.5),(n.y-e.y)/nd*dt*(e.alert?1.15:.5));}}
if(p.hp<=0){finish(s,'lost','训练护盾耗尽');return;}if(s.time<=0){finish(s,'lost','回合时间耗尽');return;}
let atPad=Math.hypot(p.x-PAD.x,p.y-PAD.y)<1.15;s.secure=atPad&&s.kills===4&&input.interact?Math.min(3,s.secure+dt):0;if(s.secure>=3)finish(s,'won','中继已校准');
}
function pause(s){if(s.state==='active')s.state='paused';}function resume(s){if(s.state==='ready'||s.state==='paused')s.state='active';}
const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
function validRound(s){return s&&['active','paused'].includes(s.state)&&Number.isInteger(s.seed)&&finite(s.seed,0,4294967295)&&Number.isInteger(s.rng)&&finite(s.rng,0,4294967295)&&s.player&&clear(s.player.x,s.player.y)&&finite(s.player.x,1,17)&&finite(s.player.y,1,17)&&finite(s.player.a,-7,7)&&finite(s.player.hp,1,100)&&finite(s.time,.001,120)&&finite(s.elapsed,0,200)&&Number.isInteger(s.ammo)&&finite(s.ammo,0,12)&&Number.isInteger(s.reserve)&&finite(s.reserve,0,72)&&finite(s.cool,0,.22)&&finite(s.reload,0,1.46)&&finite(s.secure,0,3)&&Number.isInteger(s.kills)&&finite(s.kills,0,4)&&Number.isInteger(s.shots)&&finite(s.shots,0,84)&&Number.isInteger(s.hits)&&finite(s.hits,0,s.shots)&&Array.isArray(s.enemies)&&s.enemies.length===4&&s.enemies.every((e,i)=>e.id===i&&finite(e.x,1,17)&&finite(e.y,1,17)&&clear(e.x,e.y)&&finite(e.hp,0,60)&&finite(e.cool,0,5)&&finite(e.alert,0,7)&&[0,1].includes(e.patrol)&&['patrol','seek','aim','disabled'].includes(e.mode))&&s.kills===s.enemies.filter(e=>e.hp===0).length;}
function snapshot(s){if(!['active','paused'].includes(s.state))return null;const pick=(o,ks)=>Object.fromEntries(ks.map(k=>[k,o[k]]));let c=pick(s,['seed','rng','time','elapsed','ammo','reserve','cool','reload','secure','kills','shots','hits']);c.player=pick(s.player,['x','y','a','hp']);c.enemies=s.enemies.map(e=>pick(e,['id','x','y','hp','cool','alert','mode','patrol']));c.state='paused';c.events=[];return c;}
function validate(o){if(!o||o.version!==VERSION||o.level!=='relay-yard'||!o.settings||!o.progress)throw Error('format');let d=defaults(),t=o.settings,p=o.progress;if(!finite(t.sensitivity,.25,2)||typeof t.sound!=='boolean'||!['balanced','sharp'].includes(t.quality))throw Error('settings');if(!Number.isInteger(p.wins)||!finite(p.wins,0,1e6)||!Number.isInteger(p.attempts)||!finite(p.attempts,p.wins,1e6)||!(p.best===null||finite(p.best,0,120)))throw Error('progress');d.settings={sensitivity:t.sensitivity,sound:t.sound,quality:t.quality};d.progress={wins:p.wins,attempts:p.attempts,best:p.best};if(o.round!==null){if(!validRound(o.round))throw Error('round');d.round=snapshot(o.round);}return d;}
function load(storage){try{let raw=storage.getItem(KEY);if(raw){if(raw.length>30000)throw Error('size');return {profile:validate(JSON.parse(raw)),status:'ok'};}let old=storage.getItem(OLDKEY);if(old){if(old.length>30000)throw Error('size');let o=JSON.parse(old),d=defaults();if(!o||o.version!==1||!finite(o.wins,0,1e6)||!Number.isInteger(o.wins))throw Error('migration');if(finite(o.wins,0,1e6)&&Number.isInteger(o.wins)){d.progress.wins=o.wins;d.progress.attempts=o.wins;}return {profile:d,status:'migrated'};}return {profile:defaults(),status:'new'};}catch(e){return {profile:defaults(),status:e.name==='SecurityError'?'disabled':'corrupt'};}}
function save(storage,profile){try{storage.setItem(KEY,JSON.stringify(validate(profile)));return 'saved';}catch(e){return e.name==='QuotaExceededError'?'quota':e.name==='SecurityError'?'disabled':'failed';}}
function reset(storage,confirmed){if(!confirmed)return false;try{storage.removeItem(KEY);storage.removeItem(OLDKEY);return true;}catch(e){return false;}}
return {VERSION,KEY,OLDKEY,MAP,SPAWNS,PAD,defaults,wall,clear,cast,sight,create,move,nextCell,fire,reload,step,pause,resume,random,snapshot,validRound,validate,load,save,reset};
});

