/* Command-view 0.4.1: new presentation over the archived deterministic RTS rules. */
(function(root){'use strict';
const G=root.Tempest, clone=G.clone;
function create(seed=72134){
 const sim=G.createFirstBattle(seed);sim.entities=[];sim.resources=[];sim.terrain.fill(0);sim.events=[];sim.projectiles=[];sim.wrecks=[];sim.credits=[0,0];
 G.spawn(sim,'hq',0,7,13);
 [[12,8.3],[12,9.7],[11,9]].forEach(([x,y],i)=>{const e=G.spawn(sim,'ranger',0,x,y);e.callsign=i+1});
 G.spawn(sim,'goal',1,23,9);G.spawn(sim,'rocket',1,20,8.1);G.spawn(sim,'rocket',1,20,9.9);
 return {schema:1,kind:'tempest-command',encounter:'outpost-guards-v1',sim,orders:0};
}
function command(g,c){
 if(!c||!['move','attack','stop'].includes(c.kind)||!Array.isArray(c.ids))return false;
 const ids=g.sim.entities.filter(e=>e.team===0&&e.type==='ranger'&&c.ids.includes(e.id)).map(e=>e.id);
 const ok=G.command(g.sim,ids,c.kind,c.x,c.y,c.target);if(ok)g.orders++;return ok;
}
function step(g){G.step(g.sim)}
function validate(g){
 const bad=()=>{throw Error('不是此指挥战局的有效存档')};
 if(!g||g.schema!==1||g.kind!=='tempest-command'||g.encounter!=='outpost-guards-v1'||!Number.isInteger(g.orders)||g.orders<0||g.orders>1e8)bad();
 const s=G.validate(g.sim);if(s.mode!=='firstBattle'||s.resources.length||s.terrain.some(Boolean)||s.entities.some(e=>e.manual||e.holdFire||e.queue.length))bad();
 const signs=new Set();for(const e of s.entities){if(!(e.team===0?['hq','ranger']:['goal','rocket']).includes(e.type))bad();if(e.type==='ranger'){if(![1,2,3].includes(e.callsign)||signs.has(e.callsign))bad();signs.add(e.callsign)}}
 for(const [type,max]of [['hq',1],['goal',1],['ranger',3],['rocket',2]])if(s.entities.filter(e=>e.type===type).length>max)bad();
 return {...clone(g),sim:s};
}
root.CommandBattle={create,step,command,validate};
})(globalThis);
