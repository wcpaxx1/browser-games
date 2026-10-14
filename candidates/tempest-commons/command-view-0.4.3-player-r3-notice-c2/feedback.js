/* Read-only presentation facts. Never writes combat, orders, saves or clocks. */
(function(root){'use strict';
const G=root.Tempest;
const squad=s=>s.entities.filter(e=>e.team===0&&e.type==='ranger');
function health(e){
 const ratio=Math.max(0,Math.min(1,e.hp/G.SPEC[e.type].hp)),severity=ratio<=.25?'critical':ratio<=.5?'damaged':'normal';
 return {ratio,severity,label:severity==='critical'?'危急':severity==='damaged'?'受损':'',color:severity==='critical'?'#ff8b76':severity==='damaged'?'#ffd36a':'#82d9f9'};
}
function intent(s,e){
 if(e.order?.kind==='move')return '移动命令';
 if(e.order?.kind==='attack'){
  const target=s.entities.find(a=>a.id===e.order.target&&a.hp>0);
  if(target)return target.type==='goal'?'集火前哨':'集火反坦克';
 }
 return '待命 / 警戒';
}
function facts(g){
 const s=g.sim,guards=s.entities.filter(e=>e.team===1&&e.type==='rocket').length,goal=s.entities.find(e=>e.team===1&&e.type==='goal'),tanks=squad(s),percent=goal?Math.ceil(goal.hp/G.SPEC.goal.hp*100):0;
 const stage=goal?(guards?'反坦克兵剩 '+guards+' 名 · 前哨会开火':'反坦克兵已清除 · 前哨仍会开火'):'前哨已摧毁';
 const resultDetail=s.status==='won'?'保住 '+tanks.length+' 辆坦克 · '+Math.ceil(s.tick/G.HZ)+' 秒':s.status==='draw'?'前哨已摧毁，但没有坦克生还。':(guards?'仍剩 '+guards+' 名反坦克兵':'反坦克兵已全部清除')+'；前哨剩余 '+percent+'%（'+Math.ceil(goal?.hp||0)+' / '+G.SPEC.goal.hp+'）。';
 const resultAdvice=s.status==='won'?'':s.status==='draw'?'下次留意危急血量，集中火力并及时调整。':guards?'下次可先全队集火反坦克兵，再转向前哨。':'清掉守军后，及时全选并集火前哨，避免在炮火下等待。';
 return {guards,goal,percent,tanks,stage,resultDetail,resultAdvice};
}
class Observer{
 constructor(){this.game=null;this.previous=new Map();this.hits=new Map();this.lossUntil=0;this.lossText=''}
 observe(g,now){
  const s=g.sim,tanks=squad(s);
  // Replacements (restart/load/import) are snapshots, never new damage or losses.
  if(this.game!==g){this.game=g;this.previous=new Map(tanks.map(e=>[e.id,{hp:e.hp,callsign:e.callsign}]));this.hits.clear();this.lossUntil=0;this.lossText=''}
  const live=new Set(tanks.map(e=>e.id)),lost=[];
  for(const [id,old]of this.previous)if(!live.has(id))lost.push(old.callsign);
  if(lost.length){this.lossText='坦克 '+lost.sort((a,b)=>a-b).join('、')+' 已损失';this.lossUntil=now+3500}
  const units={};
  for(const e of tanks){const old=this.previous.get(e.id);if(old&&e.hp<old.hp)this.hits.set(e.id,now+900);units[e.id]={...health(e),hit:(this.hits.get(e.id)||0)>now,intent:intent(s,e)}}
  this.previous=new Map(tanks.map(e=>[e.id,{hp:e.hp,callsign:e.callsign}]));
  for(const [id,until]of this.hits)if(!live.has(id)||until<=now)this.hits.delete(id);
  const critical=tanks.filter(e=>units[e.id].severity==='critical').map(e=>e.callsign),hit=tanks.filter(e=>units[e.id].hit).map(e=>e.callsign);
  const alert=s.status!=='playing'?'':now<this.lossUntil?this.lossText:critical.length?'危急：坦克 '+critical.join('、')+' 生命危急（≤25%）':hit.length?'坦克 '+hit.join('、')+' 刚刚受击':'';
  return {units,alert};
 }
}
root.CommandFeedback={health,intent,facts,Observer};
})(globalThis);
