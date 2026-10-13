/* Original tidal-ferry rules. No DOM, time, network, or randomness. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.Tide=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const CYCLE=Object.freeze([2,4,1,3]);
const LEVELS=Object.freeze([
 {id:0,title:'初次摆渡',subtitle:'两只箱子，一起出发。',weights:[1,1],offset:0,limit:1,hints:['点亮西岸的两只箱子。','箱子上的数字是重量，总和不能超过本回合载重。','同时选择 A 与 B，然后出航。']},
 {id:1,title:'借一次涨潮',subtitle:'潮水有自己的节奏。',weights:[2,2],offset:0,limit:2,hints:['看下一回合的潮汐预报。','等待也会推进潮位。下一回合载重为 4。','先等待，再把 A 与 B 一起送到东岸。']},
 {id:2,title:'留一程归路',subtitle:'别忘了，船还要回来。',weights:[1,2,3],offset:0,limit:4,hints:['三只箱子不必同时上船。谁可以搭伴？','载重 4 时运 1+3；载重 1 时空船返回。','等待 → A+C 出航 → 空船返回 → B 出航。']},
 {id:3,title:'错峰装船',subtitle:'相同的潮序，不同的起点。',weights:[2,2,3],offset:2,limit:4,hints:['这次从低潮开始。不要沿用上一关的组合。','先利用载重 3 运 C，再把载重 4 留给两只重 2 的箱子。','等待 → C 出航 → 空船返回 → A+B 出航。']},
 {id:4,title:'大箱子先行',subtitle:'为最笨重的行李留一场满潮。',weights:[1,2,3,4],offset:0,limit:6,hints:['重量 4 的箱子只能在满潮出发。','第一场满潮运 D，第 4 回合载重 3 时运 C，第 6 回合载重 4 时运 A+B。','等待 → D 出航 → 空返 → C 出航 → 空返 → A+B 出航。']},
 {id:5,title:'灯塔前的末班船',subtitle:'七个回合，把最后一批货送到灯下。',weights:[2,2,3,3,4],offset:3,limit:7,hints:['把可用的四次去程载重写成 3、4、3、4。','重量 3 的两只箱子各占一程。重量 4 的箱子与 2+2 各占一场满潮。','C 出航 → 空返 → E 出航 → 空返 → D 出航 → 空返 → A+B 出航。']}
].map(l=>Object.freeze({...l,weights:Object.freeze(l.weights),hints:Object.freeze(l.hints)})));
function start(level=0){if(!Number.isInteger(level)||!LEVELS[level])throw Error('Unknown level');return {level,phase:'play',side:0,east:0,turn:0,selected:0,history:[],last:'ready'};}
function cap(s,delta=0){return CYCLE[(LEVELS[s.level].offset+s.turn+delta)%4];}
function weight(s,mask=s.selected){return LEVELS[s.level].weights.reduce((sum,w,i)=>sum+((mask>>i&1)?w:0),0);}
function available(s){let all=(1<<LEVELS[s.level].weights.length)-1;return s.side?s.east:all^s.east;}
function reduce(s,a){
 if(a.type==='retry')return start(s.level);
 if(a.type==='pause'&&s.phase==='play')return {...s,phase:'paused'};
 if(a.type==='resume'&&s.phase==='paused')return {...s,phase:'play'};
 if(s.phase!=='play')return s;
 if(a.type==='select'){
  if(!Number.isInteger(a.index)||a.index<0||a.index>=LEVELS[s.level].weights.length||!(available(s)&(1<<a.index)))return s;
  return {...s,selected:s.selected^(1<<a.index),last:'select'};
 }
 if(a.type!=='sail'&&a.type!=='wait')return s;
 let selected=s.selected;
 if(a.type==='sail'&&a.cargo!==undefined){
  if(!Array.isArray(a.cargo)||a.cargo.some(i=>!Number.isInteger(i)||i<0||i>=LEVELS[s.level].weights.length)||new Set(a.cargo).size!==a.cargo.length)return s;
  selected=a.cargo.reduce((m,i)=>m|(1<<i),0);
 }
 if(a.type==='sail'&&((selected&available(s))!==selected||weight(s,selected)>cap(s)))return s;
 const entry={turn:s.turn+1,type:a.type,side:s.side,cargo:a.type==='sail'?selected:0,capacity:cap(s)};
 const next={...s,selected:0,turn:s.turn+1,history:[...s.history,entry],last:a.type};
 if(a.type==='sail'){next.east=s.east^selected;next.side=1-s.side;}
 if(next.east===(1<<LEVELS[s.level].weights.length)-1)next.phase='won';
 else if(next.turn>=LEVELS[s.level].limit)next.phase='lost';
 return next;
}
return {CYCLE,LEVELS,start,cap,weight,available,reduce};
});
