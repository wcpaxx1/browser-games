import {projectPoint} from './camera.mjs';
/** Presentation only. No move, engine state, canonical save, or historical-role authority. */
export const PERIOD_MS=7000;
export const FACTIONS=Object.freeze(['A','B','C']);
export const PERSONAS=Object.freeze({
 A:Object.freeze([{id:'cao-cao',name:'曹操',role:'主公',office:''},{id:'xun-yu',name:'荀彧',role:'谋士',office:'汉侍中、尚书令'},{id:'sima-yi',name:'司马懿',role:'太傅',office:'曹魏太傅'}].map(Object.freeze)),
 B:Object.freeze([{id:'liu-bei',name:'刘备',role:'主公',office:''},{id:'zhuge-liang',name:'诸葛亮',role:'丞相',office:'蜀汉丞相'},{id:'pang-tong',name:'庞统',role:'谋士',office:'军师中郎将'}].map(Object.freeze)),
 C:Object.freeze([{id:'sun-quan',name:'孙权',role:'主公',office:''},{id:'zhou-yu',name:'周瑜',role:'都督',office:'前部大督'},{id:'lu-su',name:'鲁肃',role:'谋士',office:'赞军校尉；后为横江将军'}].map(Object.freeze))
});
export const HISTORY_NOTE='汉末三国群英集结，采用各人生涯代表身份，并非同一年在任阵容。历史题材美术形象，非史实肖像复原。';
const time=value=>Number.isFinite(value)?value:0;
const freeze=x=>Object.freeze({...x,indices:Object.freeze(x.indices),elapsed:Object.freeze(x.elapsed)});
export function createClock(now=0){return freeze({indices:{A:0,B:0,C:0},elapsed:{A:0,B:0,C:0},lastNow:time(now),activeFaction:null,lastFaction:null});}
export function updateClock(clock,context={},now=clock.lastNow){
 const at=Math.max(clock.lastNow,time(now));
 const running=FACTIONS.includes(context.turn)&&!context.paused&&!context.hidden&&!context.replay&&!context.ended&&!context.reducedMotion&&context.motionEnabled!==false;
 const activeFaction=running?context.turn:null,indices={...clock.indices},elapsed={...clock.elapsed};
 if(activeFaction&&clock.lastFaction&&activeFaction!==clock.lastFaction)elapsed[activeFaction]=0;
 // A turn/context boundary freezes the outgoing portrait exactly. Hidden gaps and late timers never catch up multiple slides.
 if(activeFaction&&activeFaction===clock.activeFaction){const total=elapsed[activeFaction]+Math.min(PERIOD_MS,at-clock.lastNow);if(total>=PERIOD_MS){indices[activeFaction]=(indices[activeFaction]+1)%PERSONAS[activeFaction].length;elapsed[activeFaction]=total%PERIOD_MS;}else elapsed[activeFaction]=total;}
 return freeze({indices,elapsed,lastNow:at,activeFaction,lastFaction:activeFaction||clock.lastFaction});
}
export function snapshot(clock){return {indices:{...clock.indices},elapsed:{...clock.elapsed},activeFaction:clock.activeFaction};}
export function nextDelay(clock){return clock.activeFaction?Math.max(16,PERIOD_MS-clock.elapsed[clock.activeFaction]):null;}
export function factionAnchor(nodes,faction,distance=92){const n=nodes.find(n=>n.id===`${faction}:0:0`),next=nodes.find(n=>n.id===`${faction}:0:1`),outward={x:(n.x-next.x)/64,y:(n.y-next.y)/64};return {x:n.x+outward.x*distance,y:n.y+outward.y*distance,outward,back:{x:n.x,y:n.y}};}

const GLYPH_METRICS={"主":{"glyph_bounds_units":[53,-47,947,818],"svg_x_per_font_size":-0.5,"svg_baseline_y_per_font_size":0.3855},"公":{"glyph_bounds_units":[69,-76,958,743],"svg_x_per_font_size":-0.5135,"svg_baseline_y_per_font_size":0.3335},"谋":{"glyph_bounds_units":[43,-108,993,810],"svg_x_per_font_size":-0.518,"svg_baseline_y_per_font_size":0.351},"士":{"glyph_bounds_units":[48,-38,956,771],"svg_x_per_font_size":-0.502,"svg_baseline_y_per_font_size":0.3665},"丞":{"glyph_bounds_units":[33,-57,974,779],"svg_x_per_font_size":-0.5035,"svg_baseline_y_per_font_size":0.361},"相":{"glyph_bounds_units":[43,-105,899,788],"svg_x_per_font_size":-0.471,"svg_baseline_y_per_font_size":0.3415},"车":{"glyph_bounds_units":[50,-108,955,811],"svg_x_per_font_size":-0.5025,"svg_baseline_y_per_font_size":0.3515},"马":{"glyph_bounds_units":[92,-98,904,764],"svg_x_per_font_size":-0.498,"svg_baseline_y_per_font_size":0.333},"炮":{"glyph_bounds_units":[35,-91,965.6,812],"svg_x_per_font_size":-0.5003,"svg_baseline_y_per_font_size":0.3605},"兵":{"glyph_bounds_units":[43,-98,961,807],"svg_x_per_font_size":-0.502,"svg_baseline_y_per_font_size":0.3545}};
export function glyphLayout(label){const size=label.length>1?28:38;return [...label].map((character,i)=>{const m=GLYPH_METRICS[character];return {character,size,x:m.svg_x_per_font_size*size,y:(label.length>1?(i?12.25:-12.25):0)+m.svg_baseline_y_per_font_size*size};});}
export function manualPortrait(clock,faction,delta,now=clock.lastNow){if(!FACTIONS.includes(faction))return clock;return freeze({...clock,indices:{...clock.indices,[faction]:(clock.indices[faction]+delta%3+3)%3},elapsed:{...clock.elapsed,[faction]:0},lastNow:Math.max(clock.lastNow,time(now))});}
export function portraitSlots(nodes,angle=0){return FACTIONS.map(faction=>{const anchor=factionAnchor(nodes,faction),head=projectPoint(anchor,angle),back=projectPoint(anchor.back,angle),outward=projectPoint(anchor.outward,angle),slot=head.y>0?'bottom':head.x>0?'right':'left';const caption=slot==='bottom'?{x:134,y:526}:{x:slot==='right'?510:-510,y:-178},seal=slot==='bottom'?{x:-66,y:526}:{x:slot==='right'?523:-523,y:-294};return {faction,head,back,outward,slot,caption,seal,protected:[{...head,width:70,height:100},{...caption,width:104,height:48},{...seal,width:32,height:32}]};});}
