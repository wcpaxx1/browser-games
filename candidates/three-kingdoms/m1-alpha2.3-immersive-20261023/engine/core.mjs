/** Internal deterministic v0.3 rule implementation. UI imports index.mjs, not this file. */
export const RULE_VERSION = 'three-kingdoms-xiangqi-v0.3-m1';
export const STATE_SCHEMA = 'three-kingdoms-engine-state/1';
export const SAVE_SCHEMA = 'three-kingdoms-replay/1';
export const PLAYERS = Object.freeze(['A', 'B', 'C']);
export const PIECE_NAMES = Object.freeze({K:'主公', A:'谋士', E:'丞相', R:'车', N:'马', C:'炮', P:'兵'});
export class EngineError extends Error {
  constructor(code, message) { super(message); this.name = 'EngineError'; this.code = code; }
}
export function fail(code, message) { throw new EngineError(code, message); }
export function requireCondition(condition, code, message) { if (!condition) fail(code, message); }
export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const item of Object.values(value)) deepFreeze(item);
    Object.freeze(value);
  }
  return value;
}
export function exactObject(value, keys, label) {
  requireCondition(value !== null && typeof value === 'object' && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null),
    'BAD_INPUT', `${label}必须是普通对象。`);
  const ownKeys = Reflect.ownKeys(value);
  requireCondition(ownKeys.every(k=>typeof k==='string'),'BAD_INPUT', `${label}不允许符号字段。`);
  const actual = ownKeys.sort();
  const expected = [...keys].sort();
  requireCondition(actual.length === expected.length && actual.every((k,i)=>k===expected[i]),
    'BAD_INPUT', `${label}字段不符合固定合同。`);
  // Reject accessor properties before reading them. Public inputs are data, never executable callbacks.
  requireCondition(keys.every(k => Object.hasOwn(Object.getOwnPropertyDescriptor(value,k), 'value')),
    'BAD_INPUT', `${label}不允许访问器字段。`);
}
export const nodeId = (s,f,r) => `${s}:${f}:${r}`;
const nodes = [];
export const NODE_INFO = new Map();
for (const s of PLAYERS) for (let f=-4;f<=4;f++) for (let r=0;r<=4;r++) {
  const id=nodeId(s,f,r); nodes.push(id); NODE_INFO.set(id,Object.freeze({id,s,f,r}));
}
export const NODE_IDS = Object.freeze(nodes);
const seq = s => PLAYERS[(PLAYERS.indexOf(s)+1)%3];
const charts = [];
for (const s of PLAYERS) {
  charts.push({name:`H_${s}`, points:NODE_IDS.filter(id=>NODE_INFO.get(id).s===s).map(id=>{
    const p=NODE_INFO.get(id); return {id,x:p.f,y:p.r};
  })});
  const points=[];
  for(let k=0;k<=4;k++) for(let r=0;r<=4;r++) {
    points.push({id:nodeId(s,k,r),x:k,y:r});
    points.push({id:nodeId(seq(s),-k,r),x:k,y:9-r});
  }
  charts.push({name:`X_${s}`,points});
}
const rays = new Map(), horses = new Map(), elephants = new Map();
const byFrom = {R:new Map(),N:new Map(),E:new Map()};
for (const kind of Object.keys(byFrom)) for (const node of NODE_IDS) byFrom[kind].set(node,[]);
function register(map,kind,from,to,blockers) {
  const key=`${from}>${to}`, prior=map.get(key);
  if(prior) {
    requireCondition(JSON.stringify(prior)===JSON.stringify(blockers), 'GEOMETRY_CONFLICT', '同一着的路径、腿或眼不一致。');
  } else {
    map.set(key,Object.freeze(blockers)); byFrom[kind].get(from).push(to);
  }
}
for (const chart of charts) {
  const at=new Map(chart.points.map(p=>[`${p.x},${p.y}`,p.id]));
  for(const a of chart.points) for(const b of chart.points) {
    const dx=b.x-a.x,dy=b.y-a.y,ax=Math.abs(dx),ay=Math.abs(dy);
    if((dx===0)!==(dy===0)) {
      const n=Math.max(ax,ay), path=[];
      for(let i=1;i<n;i++) path.push(at.get(`${a.x+Math.sign(dx)*i},${a.y+Math.sign(dy)*i}`));
      register(rays,'R',a.id,b.id,path);
    }
    if((ax===2&&ay===1)||(ax===1&&ay===2)) {
      const leg=at.get(`${a.x+(ax===2?Math.sign(dx):0)},${a.y+(ay===2?Math.sign(dy):0)}`);
      register(horses,'N',a.id,b.id,[leg]);
    }
    if(ax===2&&ay===2) register(elephants,'E',a.id,b.id,[at.get(`${(a.x+b.x)/2},${(a.y+b.y)/2}`)]);
  }
}
for(const kind of Object.keys(byFrom)) for(const targets of byFrom[kind].values()) targets.sort();
export const GEOMETRY_COUNTS=Object.freeze({nodes:NODE_IDS.length,rays:rays.size,horses:horses.size,elephants:elephants.size});
export function getTemplate(kind,from,to) {
  const map=kind==='R'||kind==='C'?rays:kind==='N'?horses:kind==='E'?elephants:null;
  const blockers=map?.get(`${from}>${to}`);
  return blockers ? [...blockers] : null;
}
function inPalace(p,origin) { return p.s===origin && Math.abs(p.f)<=1 && p.r>=0 && p.r<=2; }
function pawnDestinations(piece) {
  const p=NODE_INFO.get(piece.node), targets=[];
  if(p.s===piece.origin) {
    if(p.r<4) targets.push(nodeId(p.s,p.f,p.r+1));
    else {
      if(p.f>=0) targets.push(nodeId(seq(p.s),-p.f,4));
      if(p.f<=0) targets.push(nodeId(seq(seq(p.s)),-p.f,4));
    }
  } else {
    if(p.r>0) targets.push(nodeId(p.s,p.f,p.r-1));
    if(p.f>-4) targets.push(nodeId(p.s,p.f-1,p.r));
    if(p.f<4) targets.push(nodeId(p.s,p.f+1,p.r));
  }
  return targets;
}
function destinations(piece) {
  const p=NODE_INFO.get(piece.node);
  if(piece.kind==='P') return pawnDestinations(piece);
  if(piece.kind==='K'||piece.kind==='A') {
    const deltas=piece.kind==='K'?[[1,0],[-1,0],[0,1],[0,-1]]:[[1,1],[1,-1],[-1,1],[-1,-1]];
    return deltas.map(([df,dr])=>NODE_INFO.get(nodeId(p.s,p.f+df,p.r+dr))).filter(q=>q&&inPalace(p,piece.origin)&&inPalace(q,piece.origin)).map(q=>q.id);
  }
  return byFrom[piece.kind==='C'?'R':piece.kind].get(piece.node);
}
export function occupancy(pieces) { return new Map(pieces.map(p=>[p.node,p])); }
export function geometryAllows(piece,to,occupied) {
  const p=NODE_INFO.get(piece.node),q=NODE_INFO.get(to);
  if(!p||!q||piece.node===to) return false;
  if(piece.kind==='K'||piece.kind==='A') {
    if(!inPalace(p,piece.origin)||!inPalace(q,piece.origin)) return false;
    const df=Math.abs(p.f-q.f),dr=Math.abs(p.r-q.r);
    return piece.kind==='K'?df+dr===1:df===1&&dr===1;
  }
  if(piece.kind==='P') return pawnDestinations(piece).includes(to);
  const map=piece.kind==='R'||piece.kind==='C'?rays:piece.kind==='N'?horses:elephants;
  const path=map.get(`${piece.node}>${to}`);
  if(!path) return false;
  const blockers=path.reduce((n,id)=>n+(occupied.has(id)?1:0),0);
  if(piece.kind==='C') return blockers===(occupied.has(to)?1:0);
  return blockers===0;
}
export function facingLords(pieces) {
  const occupied=occupancy(pieces), kings=pieces.filter(p=>p.kind==='K');
  for(let i=0;i<kings.length;i++) for(let j=i+1;j<kings.length;j++) {
    if(NODE_INFO.get(kings[i].node).s===NODE_INFO.get(kings[j].node).s) continue;
    const path=rays.get(`${kings[i].node}>${kings[j].node}`);
    if(path && path.every(id=>!occupied.has(id))) return [kings[i].id,kings[j].id];
  }
  return null;
}
export function attackers(pieces,active,player) {
  if(!active.includes(player)) return [];
  const king=pieces.find(p=>p.kind==='K'&&p.origin===player);
  if(!king) return [];
  const occupied=occupancy(pieces);
  return pieces.filter(p=>p.controller!==player&&active.includes(p.controller)&&geometryAllows(p,king.node,occupied)).map(p=>p.id).sort();
}
export function computeChecks(pieces,active) {
  return Object.fromEntries(PLAYERS.map(player=>[player,attackers(pieces,active,player)]));
}
function nextActive(current,active) {
  for(let n=1;n<=3;n++) { const p=PLAYERS[(PLAYERS.indexOf(current)+n)%3]; if(active.includes(p)) return p; }
  return null;
}
export function rawPositionKey(state) {
  const cells=state.pieces.map(p=>`${p.node}=${p.kind},${p.controller},${p.origin}`).sort();
  const kings=state.pieces.filter(p=>p.kind==='K').map(p=>p.origin).sort();
  return JSON.stringify({ruleVersion:RULE_VERSION,cells,kings,active:[...state.active].sort(),turn:state.turn});
}
export function initialRaw(firstPlayer='A') {
  requireCondition(PLAYERS.includes(firstPlayer),'BAD_FIRST_PLAYER','先手必须为 A、B 或 C。');
  const pieces=[];
  for(const player of PLAYERS) {
    const counts={};
    const put=(kind,f,r)=>{ const n=counts[kind]=(counts[kind]||0)+1; pieces.push({id:`${player}-${kind}-${n}`,kind,origin:player,controller:player,node:nodeId(player,f,r)}); };
    ['R','N','E','A','K','A','E','N','R'].forEach((kind,i)=>put(kind,i-4,0));
    put('C',-3,2);put('C',3,2);
    for(let f=-4;f<=4;f+=2)put('P',f,3);
  }
  pieces.sort((a,b)=>a.id.localeCompare(b.id));
  const state={schema:STATE_SCHEMA,ruleVersion:RULE_VERSION,firstPlayer,pieces,active:[...PLAYERS],withdrawn:[],eliminated:[],turn:firstPlayer,ply:0,noCapturePly:0,consecutivePasses:[],history:[],log:[],checks:computeChecks(pieces,PLAYERS),events:[{type:'start',firstPlayer},{type:'turn',player:firstPlayer}],result:null};
  state.history.push(rawPositionKey(state));
  return state;
}
export function normalizeAction(action) {
  requireCondition(action && typeof action==='object'&&!Array.isArray(action),'BAD_ACTION','操作必须是对象。');
  const descriptor=Object.getOwnPropertyDescriptor(action,'type');
  requireCondition(descriptor&&Object.hasOwn(descriptor,'value')&&typeof descriptor.value==='string','BAD_ACTION','操作缺少有效 type。');
  const type=descriptor.value;
  if(type==='move') {
    exactObject(action,['type','pieceId','to'],'走子');
    requireCondition(typeof action.pieceId==='string'&&/^[ABC]-[KAERNCP]-[1-5]$/.test(action.pieceId),'BAD_PIECE_ID','棋子身份无效。');
    requireCondition(typeof action.to==='string'&&NODE_INFO.has(action.to),'BAD_NODE','目标不在 135 个合法落点内。');
    return {type,pieceId:action.pieceId,to:action.to};
  }
  if(type==='pass') {exactObject(action,['type'],'困守');return {type};}
  if(type==='withdraw'||type==='agreeDraw') {
    exactObject(action,['type','players'],type==='withdraw'?'退出':'同意和棋');
    const list=action.players;
    requireCondition(Array.isArray(list)&&Object.getPrototypeOf(list)===Array.prototype&&list.length>0&&list.length<=3,'BAD_PLAYERS','必须列出不重复的有效参战方。');
    requireCondition(Reflect.ownKeys(list).length===list.length+1,'BAD_PLAYERS','参战方列表不能包含空位或额外字段。');
    const players=[];
    for(let i=0;i<list.length;i++) {
      const field=Object.getOwnPropertyDescriptor(list,String(i));
      requireCondition(field&&Object.hasOwn(field,'value')&&PLAYERS.includes(field.value),'BAD_PLAYERS','参战方列表必须是普通数据。');
      players.push(field.value);
    }
    requireCondition(new Set(players).size===players.length,'BAD_PLAYERS','参战方不能重复。');
    return {type,players:PLAYERS.filter(p=>players.includes(p))};
  }
  fail('BAD_ACTION','不支持此操作类型。');
}
function trialMove(state,action,throwFailure=false) {
  const reject=(code,message)=>{if(throwFailure)fail(code,message);return null;};
  const moving=state.pieces.find(p=>p.id===action.pieceId);
  if(!moving)return reject('MISSING_PIECE','这枚棋子已不在盘上。');
  if(moving.controller!==state.turn)return reject('WRONG_CONTROLLER','只能走当前参战方控制的棋子。');
  const occupied=occupancy(state.pieces),target=occupied.get(action.to);
  if(target?.controller===state.turn)return reject('FRIENDLY_TARGET','不能吃己方控制的棋子。');
  if(!geometryAllows(moving,action.to,occupied))return reject('ILLEGAL_GEOMETRY','走法、途中阻挡、炮架、马腿或相眼不允许此着。');
  let pieces=state.pieces.filter(p=>p!==target).map(p=>p===moving?{...p,node:action.to}:p);
  let active=[...state.active], eliminated=[...state.eliminated];
  const events=[{type:'move',player:state.turn,pieceId:moving.id,from:moving.node,to:action.to}];
  if(target)events.push({type:'capture',player:state.turn,piece:{...target}});
  if(target?.kind==='K') {
    const defeated=target.origin;
    const annexed=pieces.filter(p=>p.controller===defeated).map(p=>p.id);
    pieces=pieces.map(p=>p.controller===defeated?{...p,controller:state.turn}:p);
    active=active.filter(p=>p!==defeated); eliminated=PLAYERS.filter(p=>eliminated.includes(p)||p===defeated);
    events.push({type:'annexation',player:state.turn,defeated,pieceIds:annexed});
  }
  if(facingLords(pieces))return reject('FACING_LORDS','任意两枚仍在盘主公不能沿跨河直路无遮挡照面。');
  if(attackers(pieces,active,state.turn).length)return reject('UNSAFE_LORD','完整结算后己方主公仍受攻击，此着非法。');
  return {pieces,active,eliminated,events,captured:!!target};
}
export function rawLegalMoves(state) {
  if(state.result||state.turn===null)return [];
  const moves=[];
  for(const piece of state.pieces) if(piece.controller===state.turn) {
    for(const to of destinations(piece)) {
      const action={type:'move',pieceId:piece.id,to};
      if(trialMove(state,action))moves.push(action);
    }
  }
  return moves.sort((a,b)=>a.pieceId.localeCompare(b.pieceId)||a.to.localeCompare(b.to));
}
function finishTransition(state,{recordPosition=true}={}) {
  state.checks=computeChecks(state.pieces,state.active);
  if(recordPosition)state.history=[...state.history,rawPositionKey(state)];
  const kings=state.pieces.filter(p=>p.kind==='K');
  // Endings are resolved on the completed atomic position, never before safety validation.
  if(state.active.length===0)state.result={type:'aborted',winner:null,reason:'all-withdrawn'};
  else if(kings.length===1)state.result={type:'win',winner:kings[0].origin,reason:'last-lord'};
  else if(state.active.length===1)state.result={type:'win',winner:state.active[0],reason:'technical-withdrawal'};
  else {
    const key=rawPositionKey(state);
    if(state.history.reduce((n,k)=>n+(k===key?1:0),0)>=3)state.result={type:'draw',winner:null,reason:'threefold'};
    else if(state.noCapturePly>=150)state.result={type:'draw',winner:null,reason:'no-capture-150'};
    else if(state.consecutivePasses.length>=state.active.length && state.active.every(p=>state.consecutivePasses.includes(p)))state.result={type:'draw',winner:null,reason:'full-pass-round'};
    else if(state.pieces.every(p=>p.kind==='K'))state.result={type:'draw',winner:null,reason:'only-lords'};
  }
  for(const player of state.active) if(state.checks[player].length)state.events.push({type:'check',player,attackerIds:[...state.checks[player]]});
  if(state.result)state.events.push({type:'end',result:{...state.result}});
  else state.events.push({type:'turn',player:state.turn});
  return state;
}
export function rawApplyAction(old,untrustedAction) {
  requireCondition(!old.result,'GAME_ENDED','对局已结束，不能追加操作改写结果。');
  const action=normalizeAction(untrustedAction);
  const state={...old,events:[],log:[...old.log,action]};
  if(action.type==='move') {
    const trial=trialMove(old,action,true);
    Object.assign(state,trial); delete state.captured;
    state.ply=old.ply+1; state.noCapturePly=trial.captured?0:old.noCapturePly+1;
    state.consecutivePasses=[]; state.turn=nextActive(old.turn,state.active);
  } else if(action.type==='pass') {
    requireCondition(rawLegalMoves(old).length===0,'VOLUNTARY_PASS','仍有安全合法着，不能自愿空过。');
    state.ply=old.ply+1;state.noCapturePly=old.noCapturePly+1;
    state.consecutivePasses=[...old.consecutivePasses,old.turn];
    state.turn=nextActive(old.turn,old.active);state.events=[{type:'pass',player:old.turn}];
  } else if(action.type==='withdraw') {
    requireCondition(action.players.every(p=>old.active.includes(p)),'INACTIVE_PLAYER','只有仍参战玩家可正式退出。');
    state.active=old.active.filter(p=>!action.players.includes(p));
    state.withdrawn=PLAYERS.filter(p=>old.withdrawn.includes(p)||action.players.includes(p));
    state.turn=state.active.includes(old.turn)?old.turn:nextActive(old.turn,state.active);
    state.consecutivePasses=[];state.events=[{type:'withdrawal',players:[...action.players]}];
  } else {
    requireCondition(action.players.length===old.active.length&&old.active.every(p=>action.players.includes(p)),'CONSENT_REQUIRED','和棋必须由全部仍参战玩家一致同意。');
    state.result={type:'draw',winner:null,reason:'agreement'};
    state.events=[{type:'draw-agreement',players:[...action.players]},{type:'end',result:{...state.result}}];
    return state;
  }
  return finishTransition(state);
}
