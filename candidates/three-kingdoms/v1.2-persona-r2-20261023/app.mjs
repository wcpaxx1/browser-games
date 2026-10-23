import * as Engine from './engine/index.mjs';
import {BOARD} from './board-data.mjs';
import * as Camera from './camera.mjs';
import * as Revision from './revision.mjs';
import {MatchStore,decode,envelope,loadSettings,saveSettings,ACTIVE_KEY,findLegacySave} from './storage.mjs';
import * as Persona from './persona.mjs';
import * as HudPlacement from './hud-placement.mjs';
import {PORTRAITS_READY,PORTRAIT_ASSETS} from './portrait-assets.mjs';
globalThis.__TKBoot?.mark('app-entered');
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const NAMES={A:'魏',B:'蜀',C:'吴'},SIGNS={A:'▲',B:'◆',C:'■'};
const COLORS={A:'#244B87',B:'#A43729',C:'#76551C'},FILLS={A:'#244B87',B:'#A43729',C:'#76551C'};
const COUNTRY={A:'wei',B:'shu',C:'wu'};
const NAME=Engine.PIECE_NAMES;
const nodeMap=new Map(BOARD.nodes.map(n=>[n.id,n]));
const store=new MatchStore(text=>{globalThis.__TKBoot?.mark('save-validation');const restored=Engine.restore(text);globalThis.__TKBoot?.mark('save-validated');return restored;});
globalThis.__TKBoot?.mark('save-read');
const loaded=store.load();
globalThis.__TKBoot?.mark('save-handled');
const legacySave=findLegacySave();
let state=loaded||Engine.createInitialState();
let selected=null,reselection=null,legal=[],started=false,paused=true,overview=false,zoom=.9;
let replayIndex=null,replayState=null,replayGeneration=0,replayBusy=false,importGeneration=0,modalType='',focusNode=state.pieces.find(p=>p.controller===state.turn&&p.kind==='P')?.node||'A:0:3';
let lastSaved=false,saveText='尚未开始',gesture=null,ignoreClickUntil=0,restoreFocus=null;
let viewAngle=0,inspectedPiece=null;
const GLYPHS={K:'主公',A:'谋士',E:'丞相',R:'车',N:'马',C:'炮',P:'兵'};
let fitted=true,immersive=false,panelName=null,panelRestoreFocus=null,viewWidth=0,viewHeight=0,boardOffsetX=0,boardOffsetY=0;
let cameraDockQueued=false,cameraDockPosition=null;
const settingsLoad=loadSettings();let settings=settingsLoad.settings,settingsWritable=settingsLoad.writable;
const board=$('board'),viewport=$('board-viewport'),modal=$('modal');
const personaViews=new Map(),motionMedia=typeof window.matchMedia==='function'?window.matchMedia('(prefers-reduced-motion: reduce)'):null;let motionEnabled=true,personaClock=Persona.createClock(performance.now()),personaTimer=null;
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const faction=p=>`${SIGNS[p]} ${NAMES[p]}`;
const coord=id=>{const n=nodeMap.get(id);return n?`${NAMES[n.sector]}${n.f+5}路${n.r+1}排`:id;};
function svgEl(tag,attrs={},text=''){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text)el.textContent=text;return el;}
function line(a,b,cl,color){return svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:cl,stroke:color||''});}
function announce(text){$('live-announcement').textContent=text;}
function clearSelection(){selected=null;reselection=null;}
function renderedState(){return replayIndex===null?(reselection?.before||state):replayState;}
function interactive(){return started&&!paused&&!modal.open&&replayIndex===null&&(!state.result||Boolean(Revision.getRevision(state)));}
function setModal(type,title,html,actions,{cancel=null}={}){
 importGeneration++;modalType=type;if(!modal.open)restoreFocus=panelName?(panelRestoreFocus||$('menu-button')):document.activeElement;hidePanel(false);modal.setAttribute('data-kind',type);
 $('modal-content').innerHTML=`<p class="eyebrow">三国象棋 · 同屏对弈</p><h2 id="modal-title">${esc(title)}</h2>${html}<div class="dialog-actions"></div>`;
 const row=$('modal-content').querySelector('.dialog-actions');
 for(const a of actions){const b=document.createElement('button');b.textContent=a.label;b.id=a.id||'';b.className=a.primary?'primary':a.danger?'danger':'';b.addEventListener('click',a.run);if(a.disabled)b.disabled=true;row.append(b);}
 modal.oncancel=e=>{e.preventDefault();if(cancel)cancel();};
 if(!modal.open)modal.showModal();syncPersonas();
 requestAnimationFrame(()=>row.querySelector('button')?.focus());
}
function restoreTurnPrompt(){if(state.result){paused=false;return;}if(replayIndex!==null)return;if(paused)showPause();}
function closeModal(){importGeneration++;modal.close();modalType='';syncPersonas();if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});else $('menu-button').focus({preventScroll:true});queueMicrotask(()=>{if(started&&!modal.open)restoreTurnPrompt();});}
function persist(){let r;try{r=store.save(Engine.serialize(state));}catch{r={ok:false,reason:'存档生成失败。当前局未丢失，请先导出。'};}lastSaved=r.ok;saveText=r.ok?'已保存在此浏览器':r.reason;updateSaveStatus();return r.ok;}
function updateSaveStatus(){const e=$('save-status');e.textContent=saveText;e.classList.toggle('warning',!lastSaved&&started);e.title=saveText;const warning=$('save-warning');warning.hidden=lastSaved||!started||(!state.ply&&!store.blocked&&!store.error);warning.textContent=!warning.hidden?saveText+' 可从菜单导出备份。':'';}
function exportLegacy(){if(legacySave.raw!==null)download(legacySave.raw,'三国象棋-旧规则原始存档.json');}
const newRulesNotice='<p class="callout">新规则 v0.4：只限制棋子走法。可以不应将、主动冒险；主公真正被吃掉才出局和收编。主公仍只走原宫横竖一步，不会飞吃。旧版对局不会自动转换。</p>';
function welcome(){
 if(store.blocked){showRecovery();return;}
 if(loaded){setModal('welcome','继续这盘三国棋',`${newRulesNotice}<p>已找回第 ${state.ply+1} 手前的对局。${state.result?esc(resultTitle(state.result)):`轮到 ${esc(faction(state.turn))}。`}</p><p class="callout">恢复的是从真实开局逐着验证的棋谱；没有自动代走。</p>`,[{label:'继续对局',primary:true,id:'continue-game',run:()=>begin(false)},{label:'另开新局',id:'welcome-new',run:()=>newGameDialog()}]);return;}
 setModal('welcome','一盘棋，三方争胜',`${newRulesNotice}${legacySave.found?'<p class="callout">发现旧规则存档，已原样保留。你可以先导出备份，在旧版继续；本页另开新规则对局。</p>':''}${legacySave.problem?'<p>'+esc(legacySave.problem)+'</p>':''}<p>让三位玩家坐在同一屏前，依次执掌魏、蜀、吴。点一下拿起棋，再点合法落点就落下。下一家落子前，点刚落下的棋可从原位置重下。</p><ol class="modal-list"><li><strong>魏 → 蜀 → 吴</strong>，没有插队应将。</li><li><strong>实吃主公才收军。</strong>余军原地归斩将者，原籍与兵向不变。</li><li><strong>丞相可出师。</strong>仍走田字、仍塞眼，每着至多跨一河。</li></ol><p class="callout">三人同屏，不是人机或联网对战。存档仅在本浏览器；可随时导出备份。</p>`,[...(legacySave.raw!==null?[{label:'导出旧规则存档',id:'export-legacy-welcome',run:exportLegacy}]:[]),{label:'新规则开局，魏国先行',primary:true,id:'start-game',run:()=>begin(true)}]);
}
function begin(save){started=true;paused=false;closeModal();if(save)persist();else{lastSaved=Boolean(loaded);saveText=lastSaved?'已读取本地对局':'尚未保存';}render();showOverview();if(state.result)announce(resultDescription(state));}
function showRecovery(){setModal('recovery','旧存档已保护',`<p>这份存档无法安全恢复，可能是版本不同、内容损坏，或浏览器拒绝读取。</p><p class="callout">不会覆盖它，也不会把未经验证的局面当成正式对局。你可以先导出可读到的原始数据，再开独立新局。</p>`,[{label:'返回棋盘',id:'close-recovery',run:()=>{closeModal();render();}},{label:'导出原始数据',id:'export-problem',disabled:!store.rawProblem,run:()=>download(store.rawProblem,'三国象棋-待检查原始存档.txt','text/plain')},{label:'新建独立局',primary:true,id:'new-independent',run:()=>startNew()}],{cancel:()=>{closeModal();render();}});}
function startNew(){importGeneration++;state=Engine.createInitialState();store.independent();clearSelection();replayIndex=null;replayState=null;replayGeneration++;started=true;paused=false;closeModal();persist();render();showOverview();announce('新局开始。魏国先行。');}
function newGameDialog(){setModal('new','另开一盘',`<p>新局使用独立存档。旧局不会被删除，但不会再自动打开；建议先导出当前局留作备份。</p>`,[{label:'导出当前局',id:'new-export',run:exportCurrent},{label:'取消',run:()=>{closeModal();if(!started)welcome();}},{label:'新局，魏先行',primary:true,id:'confirm-new-game',run:startNew}],{cancel:()=>{closeModal();if(!started)welcome();}});}
function download(content,name,type='application/json'){
 const frozenContent=String(content),frozenName=String(name);const a=document.createElement('a'),url=URL.createObjectURL(new Blob([frozenContent],{type}));a.href=url;a.download=frozenName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
 announce('已发起文件下载，请检查浏览器下载列表。');
}
function exportCurrent(){try{const raw=envelope(Engine.serialize(state));const name=`三国象棋-v0.4-${new Date().toISOString().slice(0,10)}-${state.ply}手.json`;download(raw,name);}catch(e){announce('导出失败：'+e.message);}}
function showMenu(){setModal('menu','三国象棋',`<div class="menu-grid"><button id="menu-overview">全盘<span>回到完整棋盘</span></button><button id="menu-status">局势<span>三国与战报</span></button><button id="menu-history">棋谱<span>历史与复盘</span></button><button id="menu-view">视角<span>全盘、放大、全屏</span></button><button id="help-button">玩法<span>走法与胜负</span></button><button id="menu-save">存档<span>导入、导出、对局</span></button><button id="menu-immersive">${immersive?'恢复界面':'沉浸'}<span>只看棋盘</span></button></div>`,[{label:'继续下棋',primary:true,id:'menu-close',run:()=>{closeModal();render();}}],{cancel:()=>{closeModal();render();}});
 for(const [id,name]of [['menu-status','status'],['menu-history','history'],['menu-view','view']])$(id).onclick=()=>{closeModal();openPanel(name,$('menu-button'));};
 $('menu-overview').onclick=()=>{closeModal();showOverview();};$('help-button').onclick=showRules;$('menu-save').onclick=showSaveMenu;$('menu-immersive').onclick=()=>{closeModal();setImmersive(!immersive);};
}
function showSettings(){setModal('settings','显示设置',`<label class="consent"><input type="checkbox" id="coordinates-setting" ${settings.showCoordinates?'checked':''}>显示棋点坐标</label><p class="subtle">显示设置保存在此浏览器。沉浸与缩放只影响本次打开，不会修改棋谱。</p>`,[{label:'返回棋盘',primary:true,id:'settings-close',run:()=>{closeModal();render();}}],{cancel:()=>{closeModal();render();}});
 $('coordinates-setting').onchange=e=>{settings={schema:1,showCoordinates:e.target.checked};if(settingsWritable){if(!saveSettings(settings))announce('设置未能保存；当前页面仍可使用。');}else announce('旧设置版本不受支持，已保留。此更改只用于本次打开。');renderBoard();};
}
function openPanel(name,trigger=document.activeElement){
 if(immersive)setImmersive(false);if(panelName&&panelName!==name&&replayIndex!==null&&!['history','inspect'].includes(name))closeReplay();panelName=name;panelRestoreFocus=trigger;
 for(const key of ['status','history','view','inspect','dossier'])$(key+'-panel').hidden=key!==name;
 $('info-panel').hidden=false;$('panel-title').textContent={status:'三国局势',history:'棋谱与复盘',view:'棋盘与显示',inspect:'棋子详情',dossier:'军师志'}[name];$('status-button').setAttribute('aria-expanded',String(name==='status'));
 if(name==='view')updateFullscreenState();requestAnimationFrame(()=>$('panel-close').focus({preventScroll:true}));
}
function hidePanel(restore=true){
 if(!panelName)return;const wasHistory=panelName==='history';panelName=null;$('info-panel').hidden=true;$('status-button').setAttribute('aria-expanded','false');
 if(restore&&wasHistory&&replayIndex!==null)closeReplay();if(restore)(panelRestoreFocus?.isConnected?panelRestoreFocus:$('menu-button')).focus({preventScroll:true});
}
function setImmersive(value){
 hidePanel();immersive=Boolean(value);document.body.classList.toggle('immersive',immersive);$('restore-ui').hidden=!immersive;queueCameraDock();
 if(immersive)$('restore-ui').focus({preventScroll:true});else $('menu-button').focus({preventScroll:true});announce(immersive?'沉浸模式。可点恢复界面或按 Esc 退出。':'已恢复界面。');
}
function updateFullscreenState(message=''){
 const supported=typeof document.documentElement?.requestFullscreen==='function'&&document.fullscreenEnabled!==false;
 $('fullscreen-button').disabled=!supported&&!document.fullscreenElement;$('fullscreen-button').textContent=document.fullscreenElement?'退出浏览器全屏':'进入浏览器全屏';
 $('fullscreen-status').textContent=message||(!supported?'此浏览器不提供全屏功能。棋盘仍会铺满当前窗口，沉浸模式照常可用。':'浏览器全屏由你主动开启；按 Esc 或此按钮退出。');
}
async function toggleFullscreen(){
 // Only a button click reaches this API. Viewport fill and immersion never depend on it.
 try{if(document.fullscreenElement){if(typeof document.exitFullscreen==='function')await document.exitFullscreen();}else if(typeof document.documentElement?.requestFullscreen==='function'&&document.fullscreenEnabled!==false){await document.documentElement.requestFullscreen();}else{updateFullscreenState('此浏览器不支持系统全屏，可使用「隐藏辅助界面」沉浸下棋。');return;}updateFullscreenState();resizeBoard();}
 catch{updateFullscreenState('浏览器未允许全屏。当前棋局不受影响，可使用「隐藏辅助界面」。');announce('没有进入浏览器全屏，棋局未改变。');}
}
function showSaveMenu(){setModal('save','存档与对局',`<div class="modal-menu">${store.blocked||store.rawProblem?'<button id="menu-recovery">查看受保护原档与恢复选项</button>':''}${legacySave.raw!==null?'<button id="menu-export-legacy">导出已保留的旧规则存档</button>':''}<button id="menu-pause">暂停，稍后继续</button><button id="menu-export">导出当前局 JSON</button><button id="menu-import">导入已导出的对局</button><button id="menu-new">另开新局（保留旧档）</button><button id="menu-independent">当前局另存为独立局</button><button id="menu-draw" ${state.result||replayIndex!==null?'disabled':''}>所有参战玩家协议和棋</button><button id="menu-withdraw" ${state.result||replayIndex!==null?'disabled':''}>当前玩家正式退局</button></div><p class="subtle">${esc(saveText)}。本地存档按浏览器、设备和网址隔离；清理网站数据或无痕模式可能丢档。没有自动云同步。</p>`,[{label:'返回棋盘',primary:true,id:'menu-close',run:()=>{closeModal();render();}}],{cancel:()=>{closeModal();render();}});
 if($('menu-export-legacy'))$('menu-export-legacy').onclick=exportLegacy;if($('menu-recovery'))$('menu-recovery').onclick=showRecovery;
 $('menu-pause').onclick=()=>{paused=true;clearSelection();closeModal();render();};$('menu-export').onclick=exportCurrent;$('menu-import').onclick=()=>{$('import-input').value='';$('import-input').click();};$('menu-new').onclick=newGameDialog;$('menu-draw').onclick=showDraw;$('menu-withdraw').onclick=showWithdraw;
 $('menu-independent').onclick=()=>{store.independent();persist();closeModal();render();announce(saveText);};
}
function showDraw(){const active=state.active.slice();setModal('draw','三方各自确认，再和棋',`<p>同屏模式无法认证身份，请每位仍参战的玩家亲自确认自己的选项。</p>${active.map(p=>`<label class="consent"><input type="checkbox" data-draw-consent="${p}">${esc(faction(p))} 同意和棋</label>`).join('')}`, [{label:'继续下棋',run:()=>{closeModal();render();}},{label:'一致同意，结束和棋',primary:true,id:'confirm-draw',disabled:true,run:()=>{const checked=[...document.querySelectorAll('[data-draw-consent]:checked')].map(e=>e.dataset.drawConsent);if(checked.length!==active.length)return;closeModal();commit({type:'agreeDraw',players:checked});}}],{cancel:()=>{closeModal();render();}});document.querySelectorAll('[data-draw-consent]').forEach(e=>e.onchange=()=>{$('confirm-draw').disabled=document.querySelectorAll('[data-draw-consent]:checked').length!==active.length;});}
function showWithdraw(){const p=state.turn;setModal('withdraw',`${NAMES[p]}国正式退局？`,`<p>这不是暂停。${NAMES[p]}失去行棋与获胜资格，但主公和军队留在原地，仍挡路、塞眼、作炮架，直到被实际吃掉或收编。</p><p class="callout">暂时离席请返回后点「暂停」，不要正式退局。</p>`,[{label:'不退局',run:()=>{closeModal();render();}},{label:`确认${NAMES[p]}正式退局`,danger:true,id:'confirm-withdraw',run:()=>{closeModal();commit({type:'withdraw',players:[p]});}}],{cancel:()=>{closeModal();render();}});}
function pauseGame(){if(!started||state.result||replayIndex!==null)return;paused=true;clearSelection();render();if(modal.open)return;showPause();}
function showPause(){if(state.result){paused=false;return;}if(replayIndex!==null)return;setModal('pause','棋局已暂停',`<p>切换页面或暂时离席不会代走，也不会触发困守。待选落点已取消，正式落子记录保留。</p>`,[{label:'导出当前局',run:exportCurrent},{label:'继续此回合',primary:true,id:'resume-game',run:()=>{paused=false;closeModal();render();restoreTurnPrompt();}}]);}
function resultTitle(r){return r.type==='win'?`${NAMES[r.winner]}${r.reason==='technical-withdrawal'?'技术胜':'获胜'}`:r.type==='draw'?'本局和棋':'本局技术中止';}
const resultReasons={'last-lord':'合法斩将后，仅余一位主公。','technical-withdrawal':'只剩一位参战玩家；其他主公未被虚构吃掉。',threefold:'相同稳定局面第三次出现。','no-capture-150':'连续150手没有吃子。','full-pass-round':'所有参战国家连续困守一轮。','only-lords':'全盘只剩主公。',agreement:'所有仍参战玩家一致同意和棋。','all-withdrawn':'所有剩余玩家退出，无胜者。'};
function commit(action){
 try{
  $('entry-notice').hidden=true;
  const replacing=Boolean(reselection)&&action.type==='move',next=replacing?Revision.replaceMove(state,reselection,action.to):Revision.applyAction(state,action);
  state=next;replayState=null;replayGeneration++;clearSelection();paused=false;persist();render();
  announce(`${replacing?'已从原位置重下。':'已落子。'}${resultDescription(state)}${state.result?'':`轮到${faction(state.turn)}，可直接行棋。`}`);
 }catch(e){render();announce('未落子：'+e.message);$('selection-description').textContent='未落子：'+e.message;}
}
function pickRevision(revision){
 reselection=revision;selected=revision.pieceId;focusNode=revision.from;render();
 if(!fitted)centerOnNode(revision.from);
 announce(`从原位置重下：${coord(revision.from)}。点合法落点立即替换上一着；取消则保留已落棋局。`);
}

function resultDescription(s){const an=s.events.find(e=>e.type==='annexation');const cap=s.events.find(e=>e.type==='capture');if(s.result)return resultTitle(s.result)+'。'+(resultReasons[s.result.reason]||'');if(an)return `${NAMES[an.player]}斩${NAMES[an.defeated]}主公，原地收编${an.pieceIds.length}枚余军。`;if(s.events.some(e=>e.type==='pass'))return '本方无符合走法的着法，困守空过。军队和主公仍在盘。';if(s.events.some(e=>e.type==='withdrawal'))return '退局军队仍占点与挡路，不主动攻击；真实斩主公后才收编。';if(cap)return `${NAMES[cap.player]}吃掉${NAMES[cap.piece.origin]}籍${NAME[cap.piece.kind]}。普通吃子不收编。`;if(s.ply===0)return '丞相可以出师，仍走田字、仍塞眼。';return '一着已落。沿魏 → 蜀 → 吴轮流，跳过已淘汰或退局席位。';}
function render(){const s=renderedState();legal=reselection?reselection.moves:state.result?[]:Engine.legalMoves(state);renderBoard();renderHUD(s);renderRecords();syncPersonas();queueCameraDock();}
function renderHUD(s){
 const p=s.turn||'A',revision=Revision.getRevision(state),isReplay=replayIndex!==null,piece=s.pieces.find(x=>x.id===selected);
 document.body.classList.toggle('selection-active',Boolean(selected)&&!isReplay);document.body.classList.toggle('critical-state',Boolean(s.result)||!legal.length||isReplay);$('action-bar').classList.toggle('selection-context',Boolean(selected)&&!isReplay);
 $('turn-badge').className='faction-badge faction-'+p;$('turn-badge').textContent=faction(p);
 $('turn-title').textContent=isReplay?'只读复盘':reselection?'重下':s.result?resultTitle(s.result):s.checks[p]?.length?`${NAMES[p]}国 · 被将军`:piece?`${GLYPHS[piece.kind]}·${NAMES[piece.origin]}籍`:`${NAMES[p]}国行棋`;
 $('turn-description').textContent=isReplay?'查看历史，不改变当前对局。':reselection?`从原位置重下 · ${coord(reselection.from)}，不是从刚才落点再走。`:s.result?(revision?'最后落子仍可重下：直接点击刚落下的棋。':'本局已结束，棋谱与终局保留。'):s.checks[p]?.length?'主公正受威胁，是否应对由棋手决定。':'点棋拿起 → 点合法位置落下，无需确认';
 $('move-count').textContent=reselection?`第 ${state.ply} 手 · 重下`:`${s.result?'共':'第'} ${s.result?s.ply:s.ply+1} 手`;
 $('army-list').innerHTML=Engine.PLAYERS.map(f=>{const count=s.pieces.filter(x=>x.controller===f).length;const status=s.eliminated.includes(f)?'已被斩将':s.withdrawn.includes(f)?'已退局':s.checks[f]?.length?'主公被将':f===s.turn&&!s.result?'当前回合':'等待';return `<div class="army ${f===s.turn?'active':''} ${s.active.includes(f)?'':'inactive'}"><span class="army-mark" style="color:${COLORS[f]}">${faction(f)}</span><span class="army-name">${count} 枚在盘</span><span class="army-state">${status}</span></div>`;}).join('');
 $('event-summary').textContent=reselection?'正在预览上一着之前的完整局面。落到新的合法位置才替换；取消即回到已落棋局。':resultDescription(s);
 $('status-detail').textContent=reselection?`原起点：${coord(reselection.from)}。吃子、收编与胜负均按重下后的这一着重新计算。`:s.result?'终局与技术结束分别记录，不将退局冒充斩将。':`${s.noCapturePly} / 150 手未吃子。威胁只是提示；实吃主公才出局。`;
 $('terminal-actions').hidden=!s.result;$('cancel-selection').hidden=!selected||isReplay;$('cancel-selection').textContent=reselection?'取消重下':'取消';$('cancel-selection').setAttribute('aria-label',reselection?'取消重下，保留原着':'取消选棋');
 $('pass-button').hidden=Boolean(state.result)||Boolean(reselection)||legal.length>0||isReplay;
 const moves=legal.filter(a=>a.pieceId===selected);
 $('selection-description').textContent=isReplay?(replayIndex===0?`开局 · ${NAMES[state.firstPlayer]}先行，48子待命。`:`复盘第 ${replayIndex} 条 · ${actionLabels()[replayIndex-1]}`):reselection?`从原位置重下：${NAME[piece.kind]} · ${coord(reselection.from)} · ${moves.length} 个合法落点。点原棋或取消可保留已落的一着。`:state.result?(revision?`本局已结束。${NAMES[revision.player]}可点${coord(revision.to)}的${NAME[state.pieces.find(p=>p.id===revision.pieceId).kind]}从原位置重下。`:'本局已结束，可复盘或另开新局。'):piece?`${NAMES[piece.origin]}籍${NAME[piece.kind]}，${NAMES[piece.controller]}指挥 · ${moves.length} 个合法落点。再点本棋取消。${piece.kind==='P'?'箭头按原籍与所在国，不随收编掉头。':''}`:!legal.length?'没有符合走法的着法：可困守空过，不会提前转交军队。':revision?`轮到${NAMES[state.turn]}。下一家落子前，${NAMES[revision.player]}可点刚落下的棋从原位置重下。`:'点击本方棋子，再点空心标记立即落子。';
 $('selection-detail').textContent=$('selection-description').textContent;$('selection-detail').hidden=!selected||isReplay;
 const critical=Boolean(s.result)||(!legal.length&&!isReplay);
 $('event-details').hidden=!s.result||Boolean(selected)||isReplay;$('action-bar').hidden=!selected&&!critical&&!isReplay;$('action-bar').classList.toggle('critical',critical||isReplay);$('replay-quick-close').hidden=!isReplay;
 if(!selected&&!isReplay&&s.checks[p]?.length&&!s.result)$('selection-description').textContent='主公正受威胁，是否应对由棋手决定。';
 $('status-button').setAttribute('aria-label',`${$('turn-title').textContent}，${$('move-count').textContent}。查看局势与战报。`);
 updateSaveStatus();
}
function renderBoard(){const s=renderedState(),activeElement=document.activeElement?.dataset?.node;
 board.replaceChildren(svgEl('title',{},'三方对称矩形棋盘'),svgEl('desc',{},'135个棋点、15条跨境线。中央战场与山河边界没有额外落点。'));
 const defs=svgEl('defs');
 const silk=svgEl('linearGradient',{id:'camp-silk',x1:0,y1:0,x2:'.5',y2:1});for(const [offset,color]of [['0','#e9dcbf'],['.55','#e0ceaa'],['1','#d6c098']])silk.append(svgEl('stop',{offset,'stop-color':color}));
 const ivory=svgEl('radialGradient',{id:'piece-ivory',cx:'.38',cy:'.23',r:'.85'});for(const [offset,color]of [['0','#fff9e9'],['.8','#f0e1bf'],['1','#dcc394']])ivory.append(svgEl('stop',{offset,'stop-color':color}));
 const weave=svgEl('pattern',{id:'camp-weave',width:4,height:4,patternUnits:'userSpaceOnUse'});weave.append(svgEl('path',{d:'M0 0H4M0 2H4M0 0V4M2 0V4',stroke:'#5d492c','stroke-width':.18,opacity:.07}));
 const world=svgEl('g',{id:'board-world',transform:`rotate(${viewAngle})`});board.append(defs,world);
 const bg=svgEl('g',{'aria-hidden':'true','pointer-events':'none'});
 const poly=(ids,cls,stroke)=>svgEl('polygon',{points:ids.map(id=>{const n=nodeMap.get(id);return `${n.x},${n.y}`;}).join(' '),class:cls,stroke});
 const zones=[['A:0:4','B:0:4','C:0:4']];for(const f of Engine.PLAYERS){const t=Engine.PLAYERS[(Engine.PLAYERS.indexOf(f)+1)%3];zones.push([`${f}:0:4`,`${f}:4:4`,`${t}:-4:4`,`${t}:0:4`]);const ids=[`${f}:-4:0`,`${f}:4:0`,`${f}:4:4`,`${f}:-4:4`];bg.append(poly(ids,'faction-land','#6e5939'),poly(ids,'camp-weave','none'));}
 const clip=svgEl('clipPath',{id:'war-zone-clip',clipPathUnits:'userSpaceOnUse'});for(const ids of zones)clip.append(poly(ids,'','none'));defs.append(silk,ivory,weave,clip);
 const art=svgEl('g',{class:'war-map-art','clip-path':'url(#war-zone-clip)'});art.append(svgEl('image',{x:-320,y:-340,width:640,height:554,href:'./assets/war-map-exact-clipped.webp',preserveAspectRatio:'xMidYMid meet'}));bg.append(art);
 for(const e of BOARD.edges){const cl=e.kind==='bridge'?'bridge-line':e.kind==='palace'?'palace-line':'board-line';if(e.kind==='bridge')bg.append(line(nodeMap.get(e.a),nodeMap.get(e.b),'bridge-understroke'));const edge=line(nodeMap.get(e.a),nodeMap.get(e.b),cl);edge.setAttribute('data-edge-kind',e.kind);bg.append(edge);}

 world.append(bg);
 const last=reselection?null:s.events.find(e=>e.type==='move');
 const occupied=new Map(s.pieces.map(p=>[p.node,p]));
 const dests=new Set(replayIndex===null?legal.filter(a=>a.pieceId===selected).map(a=>a.to):[]);
 const focused=focusNode;
 for(const n of BOARD.nodes){const piece=occupied.get(n.id),isLegal=dests.has(n.id),g=svgEl('g',{transform:`translate(${n.x},${n.y})`,class:'node','data-node':n.id,role:'button',tabindex:n.id===focused?'0':'-1','aria-label':piece?`${NAMES[piece.controller]}指挥，${NAMES[piece.origin]}籍${NAME[piece.kind]}，${coord(n.id)}${isLegal?'，可吃':''}`:`${coord(n.id)}，${isLegal?'合法落点':'空点'}`,'aria-disabled':!interactive()&&replayIndex===null?'true':'false'});
 g.append(svgEl('circle',{r:31,class:'hit-area',fill:'transparent'}));g.append(svgEl('circle',{r:1.45,class:'board-node-dot'}));
 if(last&&(last.from===n.id||last.to===n.id))g.append(svgEl('rect',{x:-31,y:-31,width:62,height:62,rx:5,class:'last-move'}));
 if(piece){g.dataset.pieceId=piece.id;g.dataset.tkController=COUNTRY[piece.controller];const controller=piece.controller,origin=piece.origin;
 const face=svgEl('g',{transform:`rotate(${-viewAngle})`,class:'piece-face-upright','pointer-events':'none'});
 face.append(svgEl('circle',{cy:2.7,r:30.1,fill:'#624b2d',opacity:.23}),svgEl('circle',{cy:1.4,r:29.6,fill:'#c3a575'}),svgEl('circle',{r:29.5,class:'piece-outer',stroke:COLORS[controller]}),svgEl('circle',{r:26.2,class:'piece-inner',stroke:COLORS[controller]}));const label=GLYPHS[piece.kind],name=svgEl('text',{class:'piece-name'+(label.length>1?' piece-role-full':''),fill:COLORS[controller],'font-size':label.length>1?28:38});for(const glyph of Persona.glyphLayout(label))name.append(svgEl('tspan',{x:glyph.x,y:glyph.y},glyph.character));face.append(name);g.append(face);
 if(piece.id===selected){g.append(svgEl('path',{d:'M-35 -23v-12h12M23 -35h12v12M35 23v12H23M-23 35h-12V23',class:'selected-outline'}));}
 if(piece.kind==='K'&&s.checks[piece.controller]?.length)g.append(svgEl('path',{d:'M-37 0h9m-4 -4 4 4-4 4M37 0h-9m4 -4-4 4 4 4M0 37v-9m-4 4 4-4 4 4M0 -45v9m-4 -4 4 4 4-4',class:'check-ring'}));
 if(piece.kind==='P'&&selected===piece.id){const forward=piece.origin===n.sector?1:-1;const other=nodeMap.get(`${n.sector}:${n.f}:${n.r+forward}`);if(other){const dx=(other.x-n.x)/64,dy=(other.y-n.y)/64;g.append(svgEl('path',{d:`M${dx*34} ${dy*34} l${dx*15} ${dy*15} m${-dx*4-dy*4} ${-dy*4+dx*4} l${dx*4+dy*4} ${dy*4-dx*4} l${-dx*4+dy*4} ${-dy*4-dx*4}`,class:'pawn-arrow'}));}}
 }
 if(isLegal){if(piece)g.append(svgEl('circle',{r:34,class:'capture-ring'}));else{g.append(svgEl('circle',{r:13,class:'legal-dot'}),svgEl('circle',{r:4,fill:'#6240a0'}));}}
 if(reselection?.from===n.id){g.append(svgEl('circle',{r:39,class:'revision-origin'}));g.append(svgEl('text',{y:61,class:'revision-origin-label'},'原起点'));}
 g.append(svgEl('rect',{x:-39,y:-43,width:78,height:82,rx:5,class:'focus-outline'}));
 if(settings.showCoordinates)g.append(svgEl('text',{y:46,'font-size':10,'text-anchor':'middle',fill:'#5d6870'},`${n.f+5}·${n.r+1}`));
 g.addEventListener('click',e=>{if(performance.now()<ignoreClickUntil)return;const hit=pointerNode(e,n.id);if(hit)selectNode(hit);});g.addEventListener('keydown',e=>nodeKey(e,n));g.addEventListener('focus',()=>{focusNode=n.id;});world.append(g);
 }

 if(activeElement){const target=board.querySelector(`[data-node="${focusNode}"]`);target?.focus({preventScroll:true});}
}
function selectNode(id){
 if(interactive()||replayIndex!==null)retireEntryNotice();
 if(replayIndex!==null){const piece=renderedState().pieces.find(p=>p.node===id);if(piece)inspectPiece(piece);else announce('只读复盘中的空点。');return;}
 if(!interactive())return;
 if(reselection){
  if(id===reselection.from||id===reselection.to){clearSelection();render();announce('已取消重下，保留原来已落的一着。');return;}
  const move=reselection.moves.find(a=>a.to===id);
  if(move){focusNode=id;commit(move);}else announce(`这里不是从原起点${coord(reselection.from)}可走的合法落点。已落棋局未改变。`);
  return;
 }
 const revision=Revision.getRevision(state),p=state.pieces.find(x=>x.node===id);
 // An already selected current-turn piece owns its legal destinations, including
 // capturing the last moved enemy. Otherwise clicking that enemy picks it up to revise.
 const move=legal.find(a=>a.pieceId===selected&&a.to===id);
 if(move){focusNode=id;commit(move);return;}
 if(revision&&p?.id===revision.pieceId&&id===revision.to){pickRevision(revision);return;}
 if(state.result){announce('只能点击最后落下的棋重下，或查看复盘。');return;}
 if(p?.controller===state.turn){
  if(selected===p.id){clearSelection();render();announce('已取消选棋。');return;}
  selected=p.id;focusNode=id;render();announce(`${NAME[p.kind]}已拿起，${legal.filter(a=>a.pieceId===p.id).length}个合法落点。`);
 }else if(selected&&!p){clearSelection();render();announce('已取消选棋，棋局未改变。');}
 else if(selected){announce('这里不是合法落点，已选棋子和棋局未改变。');}
 else if(p)inspectPiece(p);else announce('请选择当前玩家控制的棋子，或刚落下的那枚棋重下。');
}
function nodeKey(e,n){if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id);return;}if(e.key==='Escape')return;const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!dirs[e.key])return;e.preventDefault();const {x:dx,y:dy}=Camera.unprojectPoint({x:dirs[e.key][0],y:dirs[e.key][1]},viewAngle);const candidates=BOARD.nodes.filter(a=>(a.x-n.x)*dx+(a.y-n.y)*dy>10).map(a=>({a,score:Math.hypot(a.x-n.x,a.y-n.y)+Math.abs((a.x-n.x)*dy-(a.y-n.y)*dx)*2})).sort((a,b)=>a.score-b.score);if(candidates[0]){focusNode=candidates[0].a.id;const el=board.querySelector(`[data-node="${focusNode}"]`);board.querySelector('[tabindex="0"]')?.setAttribute('tabindex','-1');el.setAttribute('tabindex','0');el.focus();}}
function cameraState(){return {angle:viewAngle,zoom,offsetX:boardOffsetX,offsetY:boardOffsetY,scrollLeft:viewport.scrollLeft,scrollTop:viewport.scrollTop};}
function safeInsets(){const css=typeof getComputedStyle==='function'?getComputedStyle($('scene-safe-insets')):null;return {left:Math.max(14,parseFloat(css?.paddingLeft)||0),right:Math.max(14,parseFloat(css?.paddingRight)||0),top:Math.max(14,parseFloat(css?.paddingTop)||0),bottom:Math.max(14,parseFloat(css?.paddingBottom)||0)};}
function fitScale(){const edge=safeInsets();return Math.max(.1,Math.min(Math.max(80,viewport.clientWidth-edge.left-edge.right)/Camera.VIEW_BOX.width,Math.max(80,viewport.clientHeight-edge.top-edge.bottom)/Camera.VIEW_BOX.height));}
function cameraCenter(){return Camera.viewportToWorld({x:(viewWidth||viewport.clientWidth)/2,y:(viewHeight||viewport.clientHeight)/2},cameraState());}
function layoutBoard(){
 viewWidth=viewport.clientWidth;viewHeight=viewport.clientHeight;
 if(fitted)zoom=fitScale();const width=Camera.VIEW_BOX.width*zoom,height=Camera.VIEW_BOX.height*zoom;
 const edge=safeInsets();boardOffsetX=edge.left+Math.max(0,(viewWidth-edge.left-edge.right-width)/2);boardOffsetY=edge.top+Math.max(0,(viewHeight-edge.top-edge.bottom-height)/2);
 for(const layer of [board,$('persona-layer')]){layer.style.width=width+'px';layer.style.height=height+'px';layer.style.marginLeft=boardOffsetX+'px';layer.style.marginTop=boardOffsetY+'px';layer.style.marginRight=edge.right+'px';layer.style.marginBottom=edge.bottom+'px';}layoutPersonas();
 viewport.classList.toggle('fitted',fitted);$('zoom-label').textContent=fitted?'全盘概览':Math.round(zoom*100)+'%';$('view-toggle').hidden=false;$('view-toggle').textContent=fitted?'＋ 放大行棋':'全盘';$('view-toggle').setAttribute('aria-label',fitted?'放大当前国家区域，拖动可查看其余棋盘':'显示完整棋盘，仍可直接行棋');
 queueCameraDock();
 requestAnimationFrame(placeEntryNotice);
 $('perspective-label').textContent=Object.keys(Camera.PERSPECTIVES).find(f=>Camera.PERSPECTIVES[f]===viewAngle)?faction(Object.keys(Camera.PERSPECTIVES).find(f=>Camera.PERSPECTIVES[f]===viewAngle))+'执棋视角':'棋盘视角';
}
function scrollToWorld(center,screen={x:viewport.clientWidth/2,y:viewport.clientHeight/2}){const p=Camera.projectPoint(center,viewAngle);viewport.scrollLeft=(p.x-Camera.VIEW_BOX.x)*zoom+boardOffsetX-screen.x;viewport.scrollTop=(p.y-Camera.VIEW_BOX.y)*zoom+boardOffsetY-screen.y;}
function centerOnNode(id){const n=nodeMap.get(id);if(n)scrollToWorld(n);}
function applyZoom(value,anchor=null,screen=null){
 retireEntryNotice();
 const center=anchor||cameraCenter();overview=false;if(value<=fitScale()+.01||(value<zoom&&value<.85)){fitted=true;layoutBoard();viewport.scrollLeft=0;viewport.scrollTop=0;}
 else{fitted=false;zoom=Math.min(2,Math.max(.85,value));layoutBoard();scrollToWorld(center,screen||undefined);}renderHUD(renderedState());
}
function setPerspective(f){retireEntryNotice();viewAngle=Camera.PERSPECTIVES[f]??0;renderBoard();layoutBoard();if(fitted){viewport.scrollLeft=0;viewport.scrollTop=0;}else centerOnNode(`${f}:0:2`);announce(faction(f)+'执棋视角。棋面文字保持正向。');}
function rotatePerspective(delta){const order=['A','B','C'],current=order.findIndex(f=>Camera.PERSPECTIVES[f]===viewAngle);setPerspective(order[(current+delta+3)%3]);}
function focusSector(f){viewAngle=Camera.PERSPECTIVES[f||'A'];applyZoom(Math.max(.9,zoom));centerOnNode(`${f||'A'}:0:2`);renderBoard();}
function showOverview(){retireEntryNotice();overview=false;fitted=true;clearSelection();layoutBoard();viewport.scrollLeft=0;viewport.scrollTop=0;render();}
function resizeBoard(){const center=cameraCenter();layoutBoard();if(fitted){viewport.scrollLeft=0;viewport.scrollTop=0;}else scrollToWorld(center);}
function pointerNode(event,fallback){
 if(event?.type==='click'&&event.detail===0)return fallback; // Keyboard/assistive activation has no physical coordinate.
 const world=$('board-world');if(!event||!Number.isFinite(event.clientX)||!Number.isFinite(event.clientY)||!world?.getScreenCTM||!board.createSVGPoint)return fallback;
 const matrix=world.getScreenCTM();if(!matrix)return fallback;
 try{const point=board.createSVGPoint();point.x=event.clientX;point.y=event.clientY;const p=point.matrixTransform(matrix.inverse());const n=nodeMap.get(fallback);return n&&Math.hypot(p.x-n.x,p.y-n.y)<=32?fallback:null;}catch{return null;}
}
function personaContext(){return {turn:state.turn,paused:paused||modal.open||Boolean(reselection)||Boolean(selected)||Boolean(gesture)||pointers.size>0,hidden:document.hidden,replay:replayIndex!==null,ended:Boolean(state.result),reducedMotion:Boolean(motionMedia?.matches),motionEnabled};}
function buildPersonas(){
 const layer=$('persona-layer'),defs=svgEl('defs');layer.append(defs);
 for(const f of Persona.FACTIONS){
  const clip=svgEl('clipPath',{id:'persona-clip-'+f,clipPathUnits:'userSpaceOnUse'}),boundary=svgEl('polygon');clip.append(boundary);defs.append(clip);
  const root=svgEl('g',{'data-persona-faction':f,class:'persona-gallery',role:'group','aria-label':NAMES[f]+'国人物'}),cropped=svgEl('g',{'clip-path':`url(#persona-clip-${f})`,'pointer-events':'none'}),position=svgEl('g'),motion=svgEl('g',{class:'persona-motion'}),previous=svgEl('image',{class:'persona-previous',opacity:0}),current=svgEl('image',{class:'persona-current',opacity:1});
  motion.append(previous,current);position.append(motion);cropped.append(position);
  const caption=svgEl('g',{class:'persona-caption',role:'button',tabindex:'0','aria-label':NAMES[f]+'国人物详情'}),plate=svgEl('rect',{x:-52,y:-24,width:104,height:48,rx:5}),name=svgEl('text',{y:-12,class:'persona-name'}),role=svgEl('text',{y:12,class:'persona-role'});caption.append(plate,name,role);caption.addEventListener('click',e=>{e.stopPropagation?.();showPersonaCard(f);});caption.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation?.();showPersonaCard(f);}});
  const seal=svgEl('g',{class:'persona-seal','aria-hidden':'true'});seal.append(svgEl('rect',{x:-16,y:-16,width:32,height:32,rx:3,stroke:COLORS[f]}),svgEl('text',{y:0,fill:COLORS[f]},NAMES[f]));const cue=svgEl('text',{y:31,class:'persona-turn-cue'},'行棋');seal.append(cue);
  root.append(cropped,caption,seal);layer.append(root);personaViews.set(f,{root,boundary,position,motion,previous,current,caption,name,role,seal,cue,index:null});
 }
}
function layoutPersonas(){
 if(!personaViews.size)buildPersonas();
 for(const slot of Persona.portraitSlots(BOARD.nodes,viewAngle)){const v=personaViews.get(slot.faction),o=slot.outward,t={x:-o.y,y:o.x},center={x:slot.back.x+o.x*34,y:slot.back.y+o.y*34},point=(along,away)=>`${center.x+t.x*along+o.x*away},${center.y+t.y*along+o.y*away}`;
  v.boundary.setAttribute('points',[point(-1000,0),point(1000,0),point(1000,1400),point(-1000,1400)].join(' '));v.position.setAttribute('transform',`translate(${slot.head.x} ${slot.head.y}) scale(${Math.min(1,84/(70*zoom))})`);v.caption.setAttribute('transform',`translate(${slot.caption.x} ${slot.caption.y})`);v.seal.setAttribute('transform',`translate(${slot.seal.x} ${slot.seal.y})`);v.name.setAttribute('font-size',Math.min(26,20/zoom));v.role.setAttribute('font-size',Math.min(22,16/zoom));
 }
}
function applyPortraitImage(image,person){const asset=PORTRAIT_ASSETS[person.id];if(!asset){image.setAttribute('visibility','hidden');return;}const h=asset.head,scale=Math.min(asset.scale||Infinity,210/asset.width,70/h.width,100/h.height);image.setAttribute('visibility','visible');image.setAttribute('href',asset.href);image.setAttribute('x',-(h.x+h.width/2)*scale);image.setAttribute('y',-(h.y+h.height/2)*scale);image.setAttribute('width',asset.width*scale);image.setAttribute('height',asset.height*scale);}
function syncPersonas(){
 const was=personaClock;personaClock=Persona.updateClock(personaClock,personaContext(),performance.now());if(personaTimer!==null){clearTimeout(personaTimer);personaTimer=null;}
 if(!personaViews.size)buildPersonas();
 for(const f of Persona.FACTIONS){const v=personaViews.get(f),index=personaClock.indices[f],person=Persona.PERSONAS[f][index],running=personaClock.activeFaction===f&&PORTRAITS_READY,changed=v.index!==index;
  if(changed){if(v.index!==null){v.previous=v.current;v.previous.setAttribute('class','persona-previous');v.current=svgEl('image',{class:'persona-current',opacity:1});v.motion.replaceChildren(v.previous,v.current);}applyPortraitImage(v.current,person);v.index=index;v.name.textContent=person.name;v.role.textContent=person.role;v.caption.setAttribute('aria-label',`${NAMES[f]}国 ${person.name}，${person.role}。打开人物详情`);}
  v.root.classList.toggle('persona-running',running);v.root.classList.toggle('persona-turn',state.turn===f&&!state.result&&replayIndex===null);v.root.classList.toggle('persona-crossfade',running&&changed&&was.indices[f]!==index);v.root.dataset.personaIndex=String(index);v.root.dataset.personaId=person.id;v.root.dataset.motionState=running?'running':'paused';v.motion.style.animationPlayState=running?'running':'paused';v.cue.setAttribute('visibility',state.turn===f&&!state.result&&replayIndex===null?'visible':'hidden');
  if(!running){v.previous.setAttribute('opacity','0');v.current.setAttribute('opacity','1');}
 }
 const pausedBySystem=Boolean(motionMedia?.matches);$('motion-toggle').setAttribute('aria-pressed',String(motionEnabled));$('motion-toggle').textContent='人物动态：'+(motionEnabled?'开启':'关闭');$('motion-description').textContent=pausedBySystem?'系统已要求减少动态，人物保持静止；可点人物姓名手动浏览。':'仅行棋方每7秒更换人物，其他阵营完全静止。可点姓名手动浏览。';
 const delay=Persona.nextDelay(personaClock);if(delay!==null&&PORTRAITS_READY)personaTimer=setTimeout(()=>{personaTimer=null;syncPersonas();},delay);
}
function showPersonaCard(f){
 const index=personaClock.indices[f],person=Persona.PERSONAS[f][index];
 setModal('persona',`${person.name} · ${person.role}`,`${PORTRAIT_ASSETS[person.id]?`<img class="persona-detail-image" src="${esc(PORTRAIT_ASSETS[person.id].href)}" alt="${esc(person.name)}的历史题材美术形象">`:''}<p>${esc(NAMES[f])}国阵营${person.office?' · '+esc(person.office):''}</p><p class="subtle">${esc(Persona.HISTORY_NOTE)}</p><p class="subtle">人物群像只用于阵营氛围，不改变棋子走法或赋予额外技能。</p>`,[{label:'上一位',id:'persona-prev',run:()=>changePersona(f,-1)},{label:'下一位',id:'persona-next',run:()=>changePersona(f,1)},{label:'回到棋盘',primary:true,id:'persona-close',run:()=>{closeModal();render();}}],{cancel:()=>{closeModal();render();}});syncPersonas();
}
function changePersona(f,delta){personaClock=Persona.manualPortrait(personaClock,f,delta,performance.now());syncPersonas();showPersonaCard(f);}

function inspectPiece(piece){inspectedPiece=piece.id;$('inspect-glyph').textContent=GLYPHS[piece.kind];$('inspect-glyph').style.color=COLORS[piece.controller];$('inspect-name').textContent=NAME[piece.kind];$('inspect-identity').textContent=`${NAMES[piece.origin]}籍 · ${NAMES[piece.controller]}国指挥 · ${coord(piece.node)}`;$('inspect-rule').textContent={K:'主公：原籍九宫内横竖一步。可以走入威胁，不飞吃。',A:'谋士：原籍九宫内斜走一步；收编后仍守原宫。',E:'丞相：走田字，不能越过相眼；一着至多渡一河。',R:'车：沿同一路移动，不能越过棋子。',N:'马：走日字，不能越过马腿。',C:'炮：不吃子时同车；吃子时恰好隔一个炮架。',P:'兵：方向由原籍与所在国决定，不会因收编而掉头。'}[piece.kind];openPanel('inspect');}
function showDossier(country=renderedState().turn||'A'){showPersonaCard(country);}
let recordSource=null,recordLabels=[],recordPage=null,recordPagingLog=null;
function actionLabels(){
 if(recordSource===state.log)return recordLabels;
 const pieces=Engine.createInitialState({firstPlayer:state.firstPlayer}).pieces.map(p=>({...p}));let turn=state.firstPlayer,active=['A','B','C'];const labels=[];
 const advance=()=>{for(let i=1;i<=3;i++){const next=Engine.PLAYERS[(Engine.PLAYERS.indexOf(turn)+i)%3];if(active.includes(next)){turn=next;return;}}};
 for(const a of state.log){
  if(a.type==='move'){const p=pieces.find(p=>p.id===a.pieceId),victim=pieces.find(p=>p.node===a.to);labels.push(`${NAMES[p.controller]} · ${NAME[p.kind]} ${coord(p.node)} → ${coord(a.to)}${victim?'（吃'+NAME[victim.kind]+'）':''}`);p.node=a.to;if(victim){pieces.splice(pieces.indexOf(victim),1);if(victim.kind==='K'){active=active.filter(f=>f!==victim.controller);for(const unit of pieces)if(unit.controller===victim.controller)unit.controller=p.controller;}}advance();
  }else if(a.type==='pass'){labels.push(`${NAMES[turn]} · 困守空过`);advance();}
  else if(a.type==='withdraw'){labels.push(a.players.map(p=>NAMES[p]).join('、')+' · 正式退局');active=active.filter(p=>!a.players.includes(p));if(!active.includes(turn))advance();}
  else labels.push('全体参战玩家 · 协议和棋');
 }
 recordSource=state.log;recordLabels=labels;return labels;
}
function recordWindow(total,requestedPage,focusIndex){
 const size=24,pages=Math.max(1,Math.ceil(total/size));
 const follow=Math.floor((Math.max(1,focusIndex)-1)/size);
 const page=Math.min(pages-1,Math.max(0,requestedPage===null?follow:requestedPage));
 return {page,pages,start:page*size,end:Math.min(total,(page+1)*size)};
}
function renderRecords(){
 const log=state.log,focusIndex=replayIndex===null?log.length:replayIndex;
 if(recordPagingLog!==log){recordPage=null;recordPagingLog=log;}
 const range=recordWindow(log.length,recordPage,focusIndex),labels=actionLabels();
 $('record-pages').hidden=!log.length;$('record-locate').hidden=!log.length;
 $('record-earlier').disabled=range.page===0;$('record-later').disabled=range.page===range.pages-1;
 $('record-page-label').textContent=`${log.length?range.start+1:0}–${range.end} / ${log.length} 条`;
 $('record-locate').textContent=replayIndex===null?'定位最新记录':'定位当前复盘记录';
 if(!log.length)$('move-list').innerHTML='<li class="empty-record">落子后，棋谱会记在这里。</li>';
 else $('move-list').innerHTML=labels.slice(range.start,range.end).map((label,i)=>{const index=range.start+i+1;return `<li><button class="record-button" data-record-index="${index}" ${replayIndex===index?'aria-current="step"':''} aria-label="复盘第${index}条：${esc(label)}"><span class="record-number">${index}.</span>${esc(label)}</button></li>`;}).join('');
 $('move-list').querySelectorAll('[data-record-index]').forEach(button=>button.onclick=()=>{const target=Number(button.dataset.recordIndex);if(replayIndex===null)startReplay();navigateReplay(target);});
 const anchor=$('move-list').querySelector(`[data-record-index="${focusIndex}"]`);
 $('move-list').scrollTop=anchor?Math.max(0,anchor.offsetTop-$('move-list').clientHeight/2):0;
 $('replay-controls').hidden=replayIndex===null;$('replay-button').disabled=!log.length||replayIndex!==null;
 if(replayIndex!==null){
  $('replay-current-action').textContent=replayIndex===0?`开局 · ${NAMES[state.firstPlayer]}先行，48子待命。`:`第 ${replayIndex} 条 · ${labels[replayIndex-1]}`;
  $('replay-range').max=log.length;$('replay-range').value=replayIndex;$('replay-position').textContent=replayBusy?'重放验证中…':`${replayIndex} / ${log.length}`;
  $('replay-prev').disabled=replayIndex===0;$('replay-next').disabled=replayIndex===log.length;
 }
}
function changeRecordPage(delta){const focusIndex=replayIndex===null?state.log.length:replayIndex;const current=recordWindow(state.log.length,recordPage,focusIndex);recordPage=Math.min(current.pages-1,Math.max(0,current.page+delta));renderRecords();}
function startReplay(){replayGeneration++;replayState=state;replayIndex=state.log.length;replayBusy=false;recordPage=null;clearSelection();render();announce('进入只读复盘。');}
async function navigateReplay(target){
 const game=state,generation=++replayGeneration;target=Math.max(0,Math.min(game.log.length,target));
 let cursor=(replayIndex!==null&&target>=replayIndex)?replayIndex:0;
 let view=cursor?replayState:Engine.createInitialState({firstPlayer:game.firstPlayer});
 replayBusy=true;$('replay-position').textContent=`正在定位 ${target}…`;
 try{for(;cursor<target;cursor++){view=Engine.applyAction(view,game.log[cursor]);if(cursor%16===15){await new Promise(r=>setTimeout(r,0));if(generation!==replayGeneration||game!==state||replayIndex===null)return;}}
 if(generation!==replayGeneration||game!==state||replayIndex===null)return;replayState=view;replayIndex=target;replayBusy=false;recordPage=null;render();
 }catch(e){if(generation!==replayGeneration)return;replayBusy=false;announce('无法复盘：'+e.message);renderRecords();}
}
function closeReplay(){replayGeneration++;replayIndex=null;replayState=null;replayBusy=false;recordPage=null;clearSelection();render();restoreTurnPrompt();}
function showRules(){setModal('help','先下起来，再慢慢谋划',`<p>目标：合法实吃敌方主公，接管其余军队；最后存活的主公获胜。三方各自争胜。</p><div class="rule-section"><h3>三种身份，别混淆</h3><p>棋面主名决定走法；边圈与字色是当前指挥；棋面使用完整角色名主公、谋士、丞相，以及车、马、炮、兵。点棋查看完整名称与原籍，原籍永远不变。普通吃子只移除目标，只有斩主公才全军原地收编。</p></div><div class="rule-section"><h3>七种棋子</h3><p>主公：原籍九宫横竖一步，不飞吃。谋士：原籍九宫斜一步。丞相：田字、塞眼，可跨河出师。车：同一路，不能越子。马：日字，蹩马腿。炮：平走同车，吃子恰隔一架。兵：本国向河岸，过河后向所在国底线或横走，不退、不再渡河。</p></div><div class="rule-section"><h3>看接线，不猜纸面角度</h3><p>每国九路五排，中央战场与山河边界无额外落点。过河按画出的15条接线；一着至多用一条河。丞相以后可以再跨别的河。马腿与相眼由展开图确定，合法提示只检查走法与阻挡；是否会送掉主公由棋手判断。</p></div><div class="rule-section"><h3>将军、困守与交接</h3><p>魏→蜀→吴循环；可以不应将，也可以把自己的主公走入攻击范围。第三方让线后，下一家可先斩主公，没有插队应将。只要有符合棋子走法的着法就不能空过，即使每一着都有风险；确实无着可走才困守空过。主公可以照面，但不会因此自动淘汰，也不能飞吃。</p></div><div class="rule-section"><h3>收编不会奖励连走</h3><p>实吃主公后，败方当前全部余军只换控制者，棋种、原籍、位置不变；即使第三方仍威胁自己的主公，也照常完成实吃与收编。随后交给下一存活参战方，不继承旧席位。被收编谋士仍守原宫，兵不掉头。</p></div><div class="rule-section"><h3>胜负与和棋</h3><p>仅余一主公则胜。相同稳定局面第三次出现、150手未吃子、参战方连续困守一轮、只余主公或全体同意，判和。正式退局保留军队但不主动攻击；仅余一参战者为技术胜。离开页面只是暂停。</p></div><div class="rule-section"><h3>操作与保存</h3><p>点棋拿起，再点空心标记立即落子，无需二次确认或交接。下一家落子前，点刚落下的棋可从原起点按原局面重下；反复重下仍替换同一着，不会多走。选择棋子不锁定上一着；真正落子、困守空过、正式退局或协议和棋才锁定。重下时显示原局面预览；Esc或取消保留已经落下的一着。Tab进入棋盘，方向键切换棋点，回车选择。全盘可直接行棋；手机可点「放大行棋」，拖动空白处或滚动查看。点击「视角」可缩放、旋转和切换魏蜀吴执棋方向；双指捏合缩放，拖动棋盘平移。键盘 R 旋转，＋/－ 缩放，0 回到全盘。文字保持正向。浏览器全屏可按需打开。「沉浸」隐藏辅助界面，按 Esc 或点「恢复界面」返回。每着尝试本地保存；失败会提示，菜单可导出或导入验证后的棋谱。</p></div><p class="subtle">规则v0.4「允许冒险、实吃主公」。旧版v0.3存档不自动转换。无随机牌、资源、技能次数、强AI、联网或付费。三方对称不等于已经证明平衡；尚未完成系统性真人平衡验证。</p>`,[{label:'明白，回到棋盘',primary:true,id:'close-help',run:()=>{closeModal();if(!started)welcome();else{render();restoreTurnPrompt();}}}],{cancel:()=>{closeModal();if(!started)welcome();else{render();restoreTurnPrompt();}}});}
$('cancel-selection').onclick=()=>{clearSelection();render();};$('pass-button').onclick=()=>{if(interactive()&&!reselection&&!state.result&&!legal.length)commit({type:'pass'});};$('more-rules').onclick=showRules;$('menu-button').onclick=showMenu;$('new-after-end').onclick=newGameDialog;$('overview-button').onclick=showOverview;
document.querySelectorAll('[data-focus-sector]').forEach(e=>e.onclick=()=>{setPerspective(e.dataset.focusSector);render();});$('zoom-in').onclick=()=>{applyZoom(zoom+.15);render();};$('zoom-out').onclick=()=>{applyZoom(zoom-.15);render();};$('replay-button').onclick=startReplay;$('replay-close').onclick=closeReplay;$('replay-prev').onclick=()=>navigateReplay(replayIndex-1);$('replay-next').onclick=()=>navigateReplay(replayIndex+1);$('replay-range').onchange=e=>navigateReplay(Number(e.target.value));$('record-earlier').onclick=()=>changeRecordPage(-1);$('record-later').onclick=()=>changeRecordPage(1);$('record-locate').onclick=()=>{recordPage=null;renderRecords();};
$('import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const generation=++importGeneration;try{if(file.size>24000000)throw new Error('文件超过24MB读取上限。请保留原文件。');const raw=await file.text();if(generation!==importGeneration)return;const restored=decode(raw,Engine.restore);if(generation!==importGeneration)return;setModal('import','对局验证通过',`${newRulesNotice}<p>已从真实开局重放并验证 ${restored.log.length} 个事件。导入会建立独立存档，不覆盖原局。</p>`,[{label:'取消',run:()=>{closeModal();render();}},{label:'导入并继续',primary:true,id:'confirm-import',run:()=>{state=restored;store.independent();replayState=null;replayGeneration++;replayIndex=null;clearSelection();started=true;paused=false;closeModal();persist();render();announce(`已导入对局。${resultDescription(state)}`);}}],{cancel:()=>{closeModal();render();}});}catch(error){if(generation!==importGeneration)return;setModal('import-error','没有导入',`<p>${esc(error.message)}</p><p class="callout">当前棋局、旧存档和原文件都未被替换。</p>`,[{label:'返回棋盘',primary:true,run:()=>{closeModal();render();}}]);}});
const pointers=new Map();let pinch=null;
function pointerLocal(e){const rect=viewport.getBoundingClientRect?.()||{left:0,top:0};return {x:e.clientX-rect.left,y:e.clientY-rect.top};}
function beginPinch(){const [a,b]=[...pointers.values()];if(!a||!b)return;const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom,anchor:Camera.viewportToWorld(center,cameraState())};gesture=null;}
viewport.addEventListener('pointerdown',e=>{
 if(e.button!==undefined&&e.button!==0)return;if(e.target.closest('.persona-caption'))return;retireEntryNotice();if(e.pointerType==='mouse'&&e.target.closest('.node'))return;
 const point=pointerLocal(e);pointers.set(e.pointerId,point);viewport.setPointerCapture(e.pointerId);
 if(pointers.size===2){beginPinch();ignoreClickUntil=performance.now()+400;syncPersonas();return;}
 gesture={id:e.pointerId,x:point.x,y:point.y,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false,node:e.target.closest('.node')?.dataset?.node||null};syncPersonas();
});
viewport.addEventListener('pointermove',e=>{
 if(!pointers.has(e.pointerId))return;const point=pointerLocal(e);pointers.set(e.pointerId,point);
 if(pointers.size>=2&&pinch){const [a,b]=[...pointers.values()],center={x:(a.x+b.x)/2,y:(a.y+b.y)/2},distance=Math.hypot(a.x-b.x,a.y-b.y);const value=pinch.zoom*distance/pinch.distance;fitted=value<=fitScale()+.01;zoom=fitted?fitScale():Math.min(2,Math.max(fitScale(),value));layoutBoard();if(fitted){viewport.scrollLeft=0;viewport.scrollTop=0;}else scrollToWorld(pinch.anchor,center);ignoreClickUntil=performance.now()+400;return;}
 if(!gesture||gesture.id!==e.pointerId)return;const dx=point.x-gesture.x,dy=point.y-gesture.y;if(Math.abs(dx)+Math.abs(dy)>7){gesture.moved=true;viewport.classList.add('dragging');viewport.scrollLeft=gesture.left-dx;viewport.scrollTop=gesture.top-dy;}
});
function endGesture(e,allowTap=false){const tap=allowTap&&gesture?.id===e?.pointerId&&!gesture?.moved&&!pinch?gesture.node:null;if(tap){const hit=pointerNode(e,tap);if(hit)selectNode(hit);ignoreClickUntil=performance.now()+250;}if(gesture?.moved||pinch)ignoreClickUntil=performance.now()+250;if(e?.pointerId!==undefined)pointers.delete(e.pointerId);else pointers.clear();gesture=null;pinch=null;viewport.classList.remove('dragging');if(pointers.size===1){const [id,p]=[...pointers.entries()][0];gesture={id,x:p.x,y:p.y,left:viewport.scrollLeft,top:viewport.scrollTop,moved:true};}syncPersonas();}
viewport.addEventListener('pointerup',e=>endGesture(e,true));viewport.addEventListener('pointercancel',endGesture);viewport.addEventListener('lostpointercapture',endGesture);
viewport.addEventListener('scroll',()=>{retireEntryNotice();queueCameraDock();},{passive:true});
viewport.addEventListener('wheel',e=>{retireEntryNotice();if(!e.ctrlKey&&!e.metaKey)return;e.preventDefault();const point=pointerLocal(e),anchor=Camera.viewportToWorld(point,cameraState());applyZoom(zoom*(e.deltaY<0?1.12:1/1.12),anchor,point);},{passive:false});
document.addEventListener('keydown',e=>{if(!modal.open&&!panelName&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName?.toUpperCase())&&['r','R','+','=','-','0'].includes(e.key)){e.preventDefault?.();if(e.key==='r'||e.key==='R')rotatePerspective(1);else if(e.key==='0')showOverview();else applyZoom(zoom+(e.key==='-'?-.15:.15));return;}if(e.key==='Escape'&&!modal.open){e.preventDefault?.();if(panelName)hidePanel();else{retireEntryNotice();clearSelection();if(immersive)setImmersive(false);render();}}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();else if(paused&&started&&!modal.open&&!state.result)showPause();});window.addEventListener('blur',()=>{if(!modal.open)pauseGame();});window.addEventListener('focus',()=>{if(paused&&started&&!modal.open&&!state.result)showPause();});
window.addEventListener('storage',e=>{if(store.noticeExternal(e)){lastSaved=false;saveText='其他页面更改了存档。已停止覆盖，请另存独立局。';paused=true;clearSelection();render();if(!modal.open)setModal('storage-conflict','另一页面更改了存档',`<p>为避免两盘互相覆盖，已暂停保存。当前内存中的棋局仍可导出。</p>`,[{label:'导出当前局',run:exportCurrent},{label:'当前局另存并继续',primary:true,id:'resolve-storage',run:()=>{store.independent();persist();paused=false;closeModal();render();}},{label:'保持暂停',run:()=>{closeModal();showPause();}}]);}});
$('motion-toggle').onclick=()=>{motionEnabled=!motionEnabled;syncPersonas();};if(motionMedia?.addEventListener)motionMedia.addEventListener('change',syncPersonas);document.addEventListener('visibilitychange',syncPersonas);
$('event-details').onclick=()=>openPanel('status',$('event-details'));
$('camera-button').onclick=()=>openPanel('view',$('camera-button'));
$('status-button').onclick=()=>panelName==='status'?hidePanel():openPanel('status',$('status-button'));$('panel-close').onclick=()=>hidePanel();$('immersive-button').onclick=()=>setImmersive(true);$('restore-ui').onclick=()=>setImmersive(false);$('settings-button').onclick=showSettings;$('fullscreen-button').onclick=toggleFullscreen;
$('rotate-left').onclick=()=>rotatePerspective(-1);$('rotate-right').onclick=()=>rotatePerspective(1);$('menu-dossier-link').onclick=()=>showDossier();document.querySelectorAll('[data-dossier-country]').forEach(e=>e.onclick=()=>showDossier(e.dataset.dossierCountry));
$('view-toggle').onclick=()=>{if(fitted){focusSector(renderedState().turn||'A');render();}else showOverview();};$('replay-quick-close').onclick=()=>{closeReplay();hidePanel();};
window.addEventListener('resize',resizeBoard);window.addEventListener('orientationchange',resizeBoard);document.addEventListener('fullscreenchange',()=>{updateFullscreenState();resizeBoard();});
if(typeof ResizeObserver==='function')new ResizeObserver(resizeBoard).observe(viewport);
function retireEntryNotice(){$('entry-notice').hidden=true;}
function cameraDockTargets(){
 const camera=cameraState(),targets=BOARD.nodes.map(n=>({...Camera.worldToViewport(n,camera),radius:31*zoom}));
 for(const gallery of Persona.portraitSlots(BOARD.nodes,viewAngle))for(const zone of gallery.protected){const p=Camera.worldToViewport(zone,{...camera,angle:0});targets.push({left:p.x-zone.width/2*zoom,right:p.x+zone.width/2*zoom,top:p.y-zone.height/2*zoom,bottom:p.y+zone.height/2*zoom});}
 for(const gallery of Persona.portraitSlots(BOARD.nodes,viewAngle)){const p=Camera.worldToViewport({x:gallery.seal.x,y:gallery.seal.y+31},{...camera,angle:0});targets.push({left:p.x-20*zoom,right:p.x+20*zoom,top:p.y-10*zoom,bottom:p.y+10*zoom});}
 for(const id of ['status-button','menu-button','restore-ui','action-bar','save-warning']){const e=$(id);if(e&&!e.hidden&&e.getBoundingClientRect){const r=e.getBoundingClientRect();if(r.width&&r.height)targets.push({left:r.left,top:r.top,right:r.right,bottom:r.bottom});}}
 return targets;
}
function queueCameraDock(){if(cameraDockQueued)return;cameraDockQueued=true;requestAnimationFrame(()=>{cameraDockQueued=false;placeCameraDock();});}
function placeCameraDock(){
 const dock=$('camera-dock'),view=$('view-toggle'),camera=$('camera-button');if(!dock?.getBoundingClientRect||!view.getBoundingClientRect||!camera.getBoundingClientRect)return;
 const priorFocus=document.activeElement;dock.hidden=false;view.hidden=false;camera.hidden=false;
 const a=view.getBoundingClientRect(),b=camera.getBoundingClientRect();if(!a.width||!b.width)return;
 const args={width:viewport.clientWidth,height:viewport.clientHeight,insets:safeInsets(),targets:cameraDockTargets(),gap:5},height=Math.max(a.height,b.height);
 let result=HudPlacement.placeDock({...args,dockWidth:a.width+b.width+8,dockHeight:height,previous:cameraDockPosition?.mode==='full'?cameraDockPosition:null}),mode='full';
 if(!result){mode='overview';result=HudPlacement.placeDock({...args,dockWidth:a.width,dockHeight:a.height,previous:cameraDockPosition?.mode==='overview'?cameraDockPosition:null});camera.hidden=true;}
 if(result){cameraDockPosition={...result,mode};dock.style.left=result.left+'px';dock.style.top=result.top+'px';dock.style.right='auto';dock.style.bottom='auto';dock.dataset.placement=mode;}
 else{cameraDockPosition=null;dock.hidden=true;dock.dataset.placement='menu';if(priorFocus===view||priorFocus===camera)$('menu-button').focus({preventScroll:true});}
 // Full-board and camera tools remain explicit menu entries even when no safe floating target exists.
 $('menu-button').setAttribute('title','菜单：全盘、视角、玩法与存档');
 if(!camera.hidden&&priorFocus===camera)camera.focus?.({preventScroll:true});else if(camera.hidden&&priorFocus===camera)(dock.hidden?$('menu-button'):view).focus?.({preventScroll:true});
}

function rectOverlapsBoard(rect){
 const padding=5;for(const n of BOARD.nodes){const p=Camera.worldToViewport(n,cameraState()),dx=Math.max(rect.left-p.x,0,p.x-rect.right),dy=Math.max(rect.top-p.y,0,p.y-rect.bottom);if(Math.hypot(dx,dy)<31*zoom+padding)return true;}
 for(const gallery of Persona.portraitSlots(BOARD.nodes,viewAngle))for(const zone of gallery.protected){const p=Camera.worldToViewport(zone,{...cameraState(),angle:0});if(rect.left<p.x+zone.width/2*zoom+padding&&rect.right>p.x-zone.width/2*zoom-padding&&rect.top<p.y+zone.height/2*zoom+padding&&rect.bottom>p.y-zone.height/2*zoom-padding)return true;}return false;
}
function placeEntryNotice(){
 const e=$('entry-notice');if(e.hidden||!e.getBoundingClientRect||!$('status-button').getBoundingClientRect)return;
 const w=viewport.clientWidth,h=viewport.clientHeight,status=$('status-button').getBoundingClientRect(),menu=$('menu-button').getBoundingClientRect(),camera=$('camera-button').getBoundingClientRect(),left=Math.max(14,status.left),right=Math.max(14,w-menu.right),top=Math.max(14,status.top),bottom=safeInsets().bottom;
 e.classList.remove('compact');$('entry-details').hidden=true;const size=e.getBoundingClientRect(),width=size.width,height=size.height;if(!width||!height)return;
 const occupied=['status-button','menu-button','view-toggle','camera-button','action-bar'].map(id=>$(id)).filter(x=>!x.hidden&&x.getBoundingClientRect).map(x=>x.getBoundingClientRect());
 const candidates=[[left,h-bottom-height],[w-right-width,h-bottom-height],[left,(h-height)/2],[w-right-width,(h-height)/2],[(w-width)/2,top]];
 const free=candidates.find(([x,y])=>{const r={left:x,right:x+width,top:y,bottom:y+height};return x>=left&&y>=top&&r.right<=w-right&&r.bottom<=h-bottom&&!rectOverlapsBoard(r)&&!occupied.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top);});
 if(free){e.style.left=free[0]+'px';e.style.top=free[1]+'px';e.style.bottom='auto';}else{const size=44,corners=[[left,h-bottom-size],[w-right-size,h-bottom-size],[left,top],[w-right-size,top]],corner=corners.find(([x,y])=>{const r={left:x,right:x+size,top:y,bottom:y+size};return x>=0&&y>=0&&!rectOverlapsBoard(r)&&!occupied.some(o=>r.left<o.right&&r.right>o.left&&r.top<o.bottom&&r.bottom>o.top);});if(!corner){e.hidden=true;$('menu-button').setAttribute('aria-label','菜单。'+$('entry-notice-text').textContent);$('menu-notice').textContent=store.blocked?'·恢复':legacySave.found?'·旧档':'·规则';$('menu-notice').hidden=false;return;}e.classList.add('compact');$('entry-details').hidden=false;$('entry-details').textContent=store.blocked?'恢复':legacySave.found?'旧档':'规则';e.style.left=corner[0]+'px';e.style.top=corner[1]+'px';e.style.bottom='auto';}
}
function showEntryDetails(){setModal('entry-details','规则与保留存档',`${newRulesNotice}<p>${esc($('entry-notice-text').textContent)}</p>`,[...(legacySave.raw!==null?[{label:'导出旧规则原始存档',id:'entry-modal-export',run:exportLegacy}]:[]),...(store.blocked?[{label:'处理受保护存档',id:'entry-modal-recovery',run:showRecovery}]:[]),{label:'回到棋盘',primary:true,run:()=>{closeModal();$('entry-notice').hidden=true;}}],{cancel:()=>closeModal()});}
$('entry-details').onclick=showEntryDetails;
function showEntryNotice(){const message=store.blocked?'本版存档无法恢复，已保护原数据。仍可在棋盘试走；请先导出或另开独立局。':legacySave.found?'新规则允许冒险。发现旧规则存档，已原样保留；不会自动转换，可导出后在旧版继续。':legacySave.problem||(!loaded?'规则 v0.4：允许不应将和主动冒险；实吃主公才出局。':'');$('entry-notice-text').textContent=message;$('entry-notice').hidden=!message;$('entry-export-legacy').hidden=legacySave.raw===null;$('entry-recovery').hidden=!store.blocked;requestAnimationFrame(placeEntryNotice);}
$('entry-dismiss').onclick=()=>{$('entry-notice').hidden=true;};$('entry-export-legacy').onclick=exportLegacy;$('entry-recovery').onclick=showRecovery;
globalThis.__TKBoot?.mark('bindings-ready');
started=true;paused=false;lastSaved=Boolean(loaded);saveText=loaded?'已读取本规则对局':store.blocked?'旧数据受保护，尚未写入':'落子后保存在此浏览器';layoutBoard();globalThis.__TKBoot?.mark('first-render');render();if(viewport.clientWidth<=600){focusSector(state.turn||'A');render();}showEntryNotice();globalThis.__TKBoot?.ready();
