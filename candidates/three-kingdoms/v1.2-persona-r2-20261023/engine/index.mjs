/** Frozen production interface. Save data is replayed, never installed as an arbitrary board. */
import {RULE_VERSION,STATE_SCHEMA,SAVE_SCHEMA,PLAYERS,PIECE_NAMES,NODE_IDS,EngineError,initialRaw,rawLegalMoves,rawApplyAction,rawPositionKey,deepFreeze,requireCondition,exactObject} from './core.mjs';
export {RULE_VERSION,SAVE_SCHEMA,PLAYERS,PIECE_NAMES,NODE_IDS,EngineError};
const trusted=new WeakSet();
function own(state){deepFreeze(state);trusted.add(state);return state;}
function assertState(state){requireCondition(state!==null&&typeof state==='object'&&trusted.has(state),'UNTRUSTED_STATE','状态必须由本引擎创建，或由 restore 完整重放恢复。');}
export function createInitialState(options={}) {
  exactObject(options,Object.hasOwn(options??{},'firstPlayer')?['firstPlayer']:[],'开局选项');
  return own(initialRaw(options.firstPlayer===undefined?'A':options.firstPlayer));
}
export function legalMoves(state){assertState(state);return deepFreeze(rawLegalMoves(state));}
export function applyAction(state,action){assertState(state);return own(rawApplyAction(state,action));}
export function positionKey(state){assertState(state);return rawPositionKey(state);}
export function getPieceAt(state,node){assertState(state);requireCondition(typeof node==='string'&&NODE_IDS.includes(node),'BAD_NODE','落点不在棋盘内。');return state.pieces.find(p=>p.node===node)||null;}
function snapshot(state){const {log,history,...rest}=state;return {...rest,history:{count:history.length,digest:checksum(stableJSON(history))}};}
function stableJSON(value){
  if(Array.isArray(value))return `[${value.map(stableJSON).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableJSON(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
// Detect ordinary byte corruption early. Not a secret or authentication signature; legal replay is the authority.
function checksum(text){let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0).toString(16).padStart(8,'0');}
export function serialize(state){
  assertState(state);
  const payload={schema:SAVE_SCHEMA,ruleVersion:RULE_VERSION,firstPlayer:state.firstPlayer,actions:state.log,snapshot:snapshot(state)};
  return JSON.stringify({...payload,checksum:checksum(stableJSON(payload))});
}
export function restore(text){
  requireCondition(typeof text==='string'&&text.length>0&&text.length<=16*1024*1024,'BAD_SAVE','存档必须是大小不超过 16 MiB 的 JSON 字符串。');
  requireCondition(new TextEncoder().encode(text).byteLength<=16*1024*1024,'BAD_SAVE','存档 UTF-8 字节数超过 16 MiB。');
  let data;
  try{data=JSON.parse(text);}catch{throw new EngineError('BAD_SAVE','存档 JSON 已损坏，未载入任何局面。');}
  exactObject(data,['schema','ruleVersion','firstPlayer','actions','snapshot','checksum'],'存档');
  requireCondition(data.schema===SAVE_SCHEMA,'UNKNOWN_SCHEMA','不支持此存档结构版本。');
  requireCondition(data.ruleVersion===RULE_VERSION,'UNKNOWN_RULE_VERSION','存档规则版本与本版「允许冒险、实吃主公」不匹配。旧规则棋谱已保留，请在旧版继续；不能自动转为新规则。');
  requireCondition(PLAYERS.includes(data.firstPlayer),'BAD_FIRST_PLAYER','存档先手无效。');
  requireCondition(Array.isArray(data.actions)&&data.actions.length<=8000,'BAD_SAVE','存档动作日志无效或超出本规则的可达长度。');
  requireCondition(data.snapshot&&typeof data.snapshot==='object'&&!Array.isArray(data.snapshot)&&data.snapshot.schema===STATE_SCHEMA,'BAD_SAVE','存档快照无效。');
  requireCondition(typeof data.checksum==='string'&&/^[0-9a-f]{8}$/.test(data.checksum),'BAD_CHECKSUM','存档校验字段无效。');
  const {checksum:expected,...payload}=data;
  let actual;
  try{actual=checksum(stableJSON(payload));}catch{throw new EngineError('BAD_SAVE','存档结构过深或无效。');}
  requireCondition(expected===actual,'BAD_CHECKSUM','存档校验失败，未载入任何局面。');
  let state=initialRaw(data.firstPlayer);
  try{for(const action of data.actions)state=rawApplyAction(state,action);}
  catch(error){if(error instanceof EngineError)throw new EngineError('ILLEGAL_REPLAY',`存档包含非法动作：${error.message}`);throw error;}
  requireCondition(stableJSON(snapshot(state))===stableJSON(data.snapshot),'SNAPSHOT_MISMATCH','存档身份、坐标、历史或最终状态与规则重放不符。');
  return own(state);
}
