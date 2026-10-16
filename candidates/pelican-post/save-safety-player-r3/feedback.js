/* Player-facing feedback only. No physics, storage or route mutations. */
(function(root){
'use strict';
const hazardName=type=>type==='crab'?'螃蟹':'木头';
function jumpState(run){return run.jump>0?{key:'air',label:'腾空',symbol:'↑'}:run.cooldown>0?{key:'cooldown',label:'落地冷却',symbol:'…'}:{key:'ready',label:'跳跃就绪',symbol:'↑'};}
function nearestHazard(state,route){
 const r=state.run;
 if(r.status!=='riding')return null;
 return route.items.filter(o=>o.type!=='stamp'&&o.lane===r.lane&&!r.hit.includes(o.id)&&o.x-r.x>=-27&&o.x-r.x<=110).sort((a,b)=>a.x-b.x)[0]||null;
}
function live(state,route){
 const jump=jumpState(state.run),hazard=nearestHazard(state,route);
 return {jump,hazard,text:jump.label+(hazard?' · '+['左道','中道','右道'][hazard.lane]+'：'+hazardName(hazard.type)+'靠近':'')};
}
function failure(state,route,speed){
 const r=state.run,remaining=Math.ceil(Math.max(0,route.length-r.x)/speed),last=route.items.find(o=>o.id===r.hit[r.hit.length-1]);
 if(r.hp===0)return {title:'车况耗尽',copy:'邮票 '+r.stamps+'/'+route.quota+' · 距灯塔约 '+remaining+' 秒',tip:(last?'最后碰到'+hazardName(last.type)+'。':'')+(r.stamps>=route.quota?'邮票已够，下一次优先避障到灯塔。':'换道避开障碍，或在靠近时跳过。')};
 return {title:'邮票还差 '+Math.max(0,route.quota-r.stamps)+' 枚',copy:(r.x>=route.length?'已到灯塔':'旅程中断')+' · 邮票 '+r.stamps+'/'+route.quota+' · 车况 '+r.hp+'/3',tip:'沿邮票所在车道收集，收够再抵达灯塔。'};
}
function preparation(state,route){return '第 '+state.stage+' 站 · '+(route.wind<0?'逆风':route.wind>0?'顺风':'平风')+' · 车况 '+state.run.hp+'/3';}
function hitText(state,route,landed){const o=route.items.find(o=>o.id===state.run.hit[state.run.hit.length-1]);return (landed?'落地碰到':'碰到')+(o?hazardName(o.type):'障碍')+' · ♥ −1';}
const api={hazardName,jumpState,nearestHazard,live,failure,preparation,hitText};if(typeof module==='object'&&module.exports)module.exports=api;else root.PelicanFeedback=api;
})(typeof globalThis!=='undefined'?globalThis:this);
