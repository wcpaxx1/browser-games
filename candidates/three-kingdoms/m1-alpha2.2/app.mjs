import * as Engine from './engine/index.mjs';
import {BOARD} from './board-data.mjs';
import {MatchStore,decode,envelope,loadSettings,saveSettings,ACTIVE_KEY} from './storage.mjs';
const $=id=>document.getElementById(id);
const NS='http://www.w3.org/2000/svg';
const NAMES={A:'魏',B:'蜀',C:'吴'},SIGNS={A:'▲',B:'◆',C:'■'};
const COLORS={A:'#2563D9',B:'#BE352E',C:'#654700'},FILLS={A:'#2563D9',B:'#BE352E',C:'#E6B526'};
const COUNTRY={A:'wei',B:'shu',C:'wu'};
const NAME=Engine.PIECE_NAMES;
const nodeMap=new Map(BOARD.nodes.map(n=>[n.id,n]));
const store=new MatchStore(Engine.restore);
const loaded=store.load();
let state=loaded||Engine.createInitialState();
let selected=null,pendingMove=null,legal=[],started=false,paused=true,handoff=true,overview=false,zoom=.9;
let replayIndex=null,replayState=null,replayGeneration=0,replayBusy=false,importGeneration=0,modalType='',focusNode=state.pieces.find(p=>p.controller===state.turn&&p.kind==='P')?.node||'A:0:3';
let lastSaved=false,saveText='尚未开始',gesture=null,ignoreClickUntil=0,restoreFocus=null;
const settingsLoad=loadSettings();let settings=settingsLoad.settings,settingsWritable=settingsLoad.writable;
const board=$('board'),viewport=$('board-viewport'),modal=$('modal');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const faction=p=>`${SIGNS[p]} ${NAMES[p]}`;
const coord=id=>{const n=nodeMap.get(id);return n?`${NAMES[n.sector]}${n.f+5}路${n.r+1}排`:id;};
function svgEl(tag,attrs={},text=''){const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,v);if(text)el.textContent=text;return el;}
function line(a,b,cl,color){return svgEl('line',{x1:a.x,y1:a.y,x2:b.x,y2:b.y,class:cl,stroke:color||''});}
function announce(text){$('live-announcement').textContent=text;}
function clearSelection(){selected=null;pendingMove=null;}
function renderedState(){return replayIndex===null?state:replayState;}
function interactive(){return started&&!paused&&!handoff&&!modal.open&&replayIndex===null&&!state.result&&!overview;}
function setModal(type,title,html,actions,{cancel=null}={}){
 importGeneration++;modalType=type;restoreFocus=document.activeElement;
 $('modal-content').innerHTML=`<p class="eyebrow">三国象棋 · 同屏对弈</p><h2>${esc(title)}</h2>${html}<div class="dialog-actions"></div>`;
 const row=$('modal-content').querySelector('.dialog-actions');
 for(const a of actions){const b=document.createElement('button');b.textContent=a.label;b.id=a.id||'';b.className=a.primary?'primary':a.danger?'danger':'';b.addEventListener('click',a.run);if(a.disabled)b.disabled=true;row.append(b);}
 modal.oncancel=e=>{e.preventDefault();if(cancel)cancel();};
 if(!modal.open)modal.showModal();
 requestAnimationFrame(()=>row.querySelector('button')?.focus());
}
function restoreTurnPrompt(){if(state.result){handoff=false;paused=false;return;}if(replayIndex!==null)return;if(handoff)showHandoff();else if(paused)showPause();}
function closeModal(){importGeneration++;modal.close();modalType='';if(restoreFocus?.isConnected)restoreFocus.focus({preventScroll:true});queueMicrotask(()=>{if(started&&!modal.open)restoreTurnPrompt();});}
function persist(){let r;try{r=store.save(Engine.serialize(state));}catch{r={ok:false,reason:'存档生成失败。当前局未丢失，请先导出。'};}lastSaved=r.ok;saveText=r.ok?'已保存在此浏览器':r.reason;updateSaveStatus();return r.ok;}
function updateSaveStatus(){const e=$('save-status');e.textContent=saveText;e.classList.toggle('warning',!lastSaved&&started);e.title=saveText;}
function welcome(){
 if(store.blocked){showRecovery();return;}
 if(loaded){setModal('welcome','继续这盘三国棋',`<p>已找回第 ${state.ply+1} 手前的对局。${state.result?esc(resultTitle(state.result)):`轮到 ${esc(faction(state.turn))}。`}</p><p class="callout">恢复的是从真实开局逐着验证的棋谱；没有自动代走。</p>`,[{label:'继续对局',primary:true,id:'continue-game',run:()=>begin(false)},{label:'另开新局',id:'welcome-new',run:()=>newGameDialog()}]);return;}
 setModal('welcome','一盘棋，三方争胜',`<p>让三位玩家坐在同一屏前，依次执掌魏、蜀、吴。先选子，再点合法落点，确认后交给下一家。</p><ol class="modal-list"><li><strong>魏 → 蜀 → 吴</strong>，没有插队应将。</li><li><strong>实吃主公才收军。</strong>余军原地归斩将者，原籍与兵向不变。</li><li><strong>丞相可出师。</strong>仍走田字、仍塞眼，每着至多跨一河。</li></ol><p class="callout">三人同屏，不是人机或联网对战。存档仅在本浏览器；可随时导出备份。</p>`,[{label:'魏国先行，开始对局',primary:true,id:'start-game',run:()=>begin(true)}]);
}
function begin(save){started=true;paused=false;handoff=false;closeModal();if(save)persist();else{lastSaved=Boolean(loaded);saveText=lastSaved?'已读取本地对局':'尚未保存';}render();focusSector(state.turn||'A');if(state.result)showResult();}
function showRecovery(){setModal('recovery','旧存档已保护',`<p>这份存档无法安全恢复，可能是版本不同、内容损坏，或浏览器拒绝读取。</p><p class="callout">不会覆盖它，也不会把未经验证的局面当成正式对局。你可以先导出可读到的原始数据，再开独立新局。</p>`,[{label:'导出原始数据',id:'export-problem',disabled:!store.rawProblem,run:()=>download(store.rawProblem,'三国象棋-待检查原始存档.txt','text/plain')},{label:'新建独立局',primary:true,id:'new-independent',run:()=>startNew()}]);}
function startNew(){importGeneration++;state=Engine.createInitialState();store.independent();clearSelection();replayIndex=null;replayState=null;replayGeneration++;started=true;paused=false;handoff=false;closeModal();persist();render();focusSector('A');announce('新局开始。魏国先行。');}
function newGameDialog(){setModal('new','另开一盘',`<p>新局使用独立存档。旧局不会被删除，但不会再自动打开；建议先导出当前局留作备份。</p>`,[{label:'导出当前局',id:'new-export',run:exportCurrent},{label:'取消',run:()=>{closeModal();if(!started)welcome();}},{label:'新局，魏先行',primary:true,id:'confirm-new-game',run:startNew}],{cancel:()=>{closeModal();if(!started)welcome();}});}
function download(content,name,type='application/json'){
 const frozenContent=String(content),frozenName=String(name);const a=document.createElement('a'),url=URL.createObjectURL(new Blob([frozenContent],{type}));a.href=url;a.download=frozenName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),20000);
 announce('已发起文件下载，请检查浏览器下载列表。');
}
function exportCurrent(){try{const raw=envelope(Engine.serialize(state));const name=`三国象棋-M1-${new Date().toISOString().slice(0,10)}-${state.ply}手.json`;download(raw,name);}catch(e){announce('导出失败：'+e.message);}}
function showMenu(){setModal('menu','对局菜单',`<div class="modal-menu"><button id="menu-pause">暂停，稍后继续</button><button id="menu-export">导出当前局 JSON</button><button id="menu-import">导入已导出的对局</button><button id="menu-new">另开新局（保留旧档）</button><button id="menu-independent">当前局另存为独立局</button><button id="menu-draw" ${state.result||replayIndex!==null?'disabled':''}>所有参战玩家协议和棋</button><button id="menu-withdraw" ${state.result||replayIndex!==null?'disabled':''}>当前玩家正式退局</button><label class="consent"><input type="checkbox" id="coordinates-setting" ${settings.showCoordinates?'checked':''}>显示棋点坐标</label></div><p class="subtle">${esc(saveText)}。本地存档按浏览器、设备和网址隔离；清理网站数据或无痕模式可能丢档。没有自动云同步。</p>`,[{label:'返回棋盘',primary:true,id:'menu-close',run:()=>{closeModal();render();}}],{cancel:()=>{closeModal();render();}});
 $('menu-pause').onclick=()=>{paused=true;clearSelection();closeModal();render();};$('menu-export').onclick=exportCurrent;$('menu-import').onclick=()=>{$('import-input').value='';$('import-input').click();};$('menu-new').onclick=newGameDialog;$('menu-draw').onclick=showDraw;$('menu-withdraw').onclick=showWithdraw;
 $('menu-independent').onclick=()=>{store.independent();persist();closeModal();render();announce(saveText);};
 $('coordinates-setting').onchange=e=>{settings={schema:1,showCoordinates:e.target.checked};if(settingsWritable){if(!saveSettings(settings))announce('设置未能保存；当前页面仍可使用。');}else announce('旧设置版本不受支持，已保留。此更改只用于本次打开。');renderBoard();};
}
function showDraw(){const active=state.active.slice();setModal('draw','三方各自确认，再和棋',`<p>同屏模式无法认证身份，请每位仍参战的玩家亲自确认自己的选项。</p>${active.map(p=>`<label class="consent"><input type="checkbox" data-draw-consent="${p}">${esc(faction(p))} 同意和棋</label>`).join('')}`, [{label:'继续下棋',run:()=>{closeModal();render();}},{label:'一致同意，结束和棋',primary:true,id:'confirm-draw',disabled:true,run:()=>{const checked=[...document.querySelectorAll('[data-draw-consent]:checked')].map(e=>e.dataset.drawConsent);if(checked.length!==active.length)return;closeModal();commit({type:'agreeDraw',players:checked});}}],{cancel:()=>{closeModal();render();}});document.querySelectorAll('[data-draw-consent]').forEach(e=>e.onchange=()=>{$('confirm-draw').disabled=document.querySelectorAll('[data-draw-consent]:checked').length!==active.length;});}
function showWithdraw(){const p=state.turn;setModal('withdraw',`${NAMES[p]}国正式退局？`,`<p>这不是暂停。${NAMES[p]}失去行棋与获胜资格，但主公和军队留在原地，仍挡路、塞眼、作炮架，直到被实际吃掉或收编。</p><p class="callout">暂时离席请返回后点「暂停」，不要正式退局。</p>`,[{label:'不退局',run:()=>{closeModal();render();}},{label:`确认${NAMES[p]}正式退局`,danger:true,id:'confirm-withdraw',run:()=>{closeModal();commit({type:'withdraw',players:[p]});}}],{cancel:()=>{closeModal();render();}});}
function showHandoff(){if(state.result){handoff=false;paused=false;return;}if(replayIndex!==null)return;const p=state.turn;const passes=state.events.filter(e=>e.type==='pass'),annex=state.events.find(e=>e.type==='annexation');let detail=annex?`${NAMES[annex.player]}斩下${NAMES[annex.defeated]}主公，收编 ${annex.pieceIds.length} 枚余军。控制权已变，原籍与兵向不变。`:(passes.length?`${NAMES[passes[0].player]}没有安全合法着，已困守空过。`:'上一着已提交并记入棋谱。');setModal('handoff',`轮到 ${faction(p)}`,`<p>${esc(detail)}</p><p class="callout">${state.checks[p]?.length?'你的主公正被将军。本着必须解除所有威胁。':'请把操作交给下一位玩家。确认接手后才能行棋。'}${!lastSaved?'<br>注意：本地保存未成功，建议导出备份。':''}</p>`,[{label:`我是${NAMES[p]}，开始行棋`,primary:true,id:'accept-turn',run:()=>{handoff=false;paused=false;clearSelection();closeModal();render();focusSector(p);announce(`${NAMES[p]}开始行棋。`);}}]);}
function pauseGame(){if(!started||state.result||replayIndex!==null)return;paused=true;clearSelection();render();if(modal.open)return;showPause();}
function showPause(){if(state.result){handoff=false;paused=false;return;}if(replayIndex!==null)return;setModal('pause','棋局已暂停',`<p>切换页面或暂时离席不会代走，也不会触发困守。待选落点已取消，正式落子记录保留。</p>`,[{label:'导出当前局',run:exportCurrent},{label:'继续此回合',primary:true,id:'resume-game',run:()=>{paused=false;closeModal();render();restoreTurnPrompt();}}]);}
function resultTitle(r){return r.type==='win'?`${NAMES[r.winner]}${r.reason==='technical-withdrawal'?'技术胜':'获胜'}`:r.type==='draw'?'本局和棋':'本局技术中止';}
const resultReasons={'last-lord':'合法斩将后，仅余一位主公。','technical-withdrawal':'只剩一位参战玩家；其他主公未被虚构吃掉。',threefold:'相同稳定局面第三次出现。','no-capture-150':'连续150手没有吃子。','full-pass-round':'所有参战国家连续困守一轮。','only-lords':'全盘只剩主公。',agreement:'所有仍参战玩家一致同意和棋。','all-withdrawn':'所有剩余玩家退出，无胜者。'};
function showResult(){handoff=false;paused=false;setModal('result',resultTitle(state.result),`<p>${esc(resultReasons[state.result.reason]||'棋局结束。')}</p><p class="callout">共 ${state.ply} 手。可以查看棋谱或导出留存，也可以另开新局。</p>`,[{label:'查看终局',id:'inspect-result',run:()=>{closeModal();render();}},{label:'导出棋谱',run:exportCurrent},{label:'另开新局',primary:true,id:'result-new',run:newGameDialog}]);}
function commit(action){try{const next=Engine.applyAction(state,action);state=next;replayState=null;replayGeneration++;clearSelection();persist();render();if(state.result)showResult();else{handoff=true;showHandoff();}}catch(e){clearSelection();render();announce('未落子：'+e.message);$('selection-description').textContent='未落子：'+e.message;}}
function resultDescription(s){const an=s.events.find(e=>e.type==='annexation');const cap=s.events.find(e=>e.type==='capture');if(s.result)return resultTitle(s.result)+'。'+(resultReasons[s.result.reason]||'');if(an)return `${NAMES[an.player]}斩${NAMES[an.defeated]}主公，原地收编${an.pieceIds.length}枚余军。`;if(s.events.some(e=>e.type==='pass'))return '本方无安全合法着，困守空过。军队和主公仍在盘。';if(s.events.some(e=>e.type==='withdrawal'))return '退局军队仍占点与挡路，不主动攻击；真实斩主公后才收编。';if(cap)return `${NAMES[cap.player]}吃掉${NAMES[cap.piece.origin]}籍${NAME[cap.piece.kind]}。普通吃子不收编。`;if(s.ply===0)return '丞相可以出师，仍走田字、仍塞眼。';return '一着已落。沿魏 → 蜀 → 吴轮流，跳过已淘汰或退局席位。';}
function render(){const s=renderedState();legal=state.result?[]:Engine.legalMoves(state);renderBoard();renderHUD(s);renderRecords();}
function renderHUD(s){const p=s.turn||'A';$('turn-badge').className='faction-badge faction-'+p;$('turn-badge').textContent=faction(p);$('turn-title').textContent=replayIndex!==null?'只读复盘':s.result?resultTitle(s.result):`${NAMES[p]}国行棋`;$('turn-description').textContent=replayIndex!==null?'查看历史，不改变当前对局。':s.result?'本局已结束，棋谱与终局保留。':s.checks[p]?.length?'主公被将军，必须解除全部威胁。':'选棋子 → 点合法落点 → 确认落子';$('move-count').textContent=`${s.result?'共':'第'} ${s.result?s.ply:s.ply+1} 手`;
 $('army-list').innerHTML=Engine.PLAYERS.map(f=>{const count=s.pieces.filter(x=>x.controller===f).length;const status=s.eliminated.includes(f)?'已被斩将':s.withdrawn.includes(f)?'已退局':s.checks[f]?.length?'主公被将':f===s.turn&&!s.result?'当前回合':'等待';return `<div class="army ${f===s.turn?'active':''} ${s.active.includes(f)?'':'inactive'}"><span class="army-mark" style="color:${COLORS[f]}">${faction(f)}</span><span class="army-name">${count} 枚在盘</span><span class="army-state">${status}</span></div>`;}).join('');
 $('event-summary').textContent=resultDescription(s);$('status-detail').textContent=s.result?'终局与技术结束分别记录，不将退局冒充斩将。':`${s.noCapturePly} / 150 手未吃子。将军与困守不等于被斩。`;
 $('terminal-actions').hidden=!s.result;$('cancel-selection').hidden=!selected||replayIndex!==null;$('confirm-move').hidden=!pendingMove||replayIndex!==null;$('pass-button').hidden=Boolean(state.result)||legal.length>0||replayIndex!==null;
 const piece=state.pieces.find(x=>x.id===selected),moves=legal.filter(a=>a.pieceId===selected);
 $('selection-description').textContent=replayIndex!==null?(replayIndex===0?`开局 · ${NAMES[state.firstPlayer]}先行，48子待命。`:`复盘第 ${replayIndex} 条 · ${actionLabels()[replayIndex-1]}`):overview?'全盘只供观察。请点国家按钮放大后行棋。':state.result?'本局已结束，可复盘或另开新局。':pendingMove?`${NAME[piece.kind]}：${coord(piece.node)} → ${coord(pendingMove.to)}，尚未落子。`:piece?`${NAMES[piece.origin]}籍${NAME[piece.kind]}，${NAMES[piece.controller]}指挥 · ${moves.length} 个合法落点。${piece.kind==='P'?'箭头按原籍与所在国，不随收编掉头。':''}`:!legal.length?'无安全合法着：只能困守空过，不会提前转交军队。':'点击本方棋子，空心标记显示安全合法落点。';
 updateSaveStatus();
}
function renderBoard(){const s=renderedState(),activeElement=document.activeElement?.dataset?.node;
 board.replaceChildren(svgEl('title',{},'三方对称矩形棋盘'),svgEl('desc',{},'135个棋点、15条渡河线。原籍不随收编改变。'));
 const bg=svgEl('g',{'aria-hidden':'true'});bg.append(svgEl('rect',{x:-570,y:-510,width:1140,height:1030,fill:'#fffdf5'}));
 const poly=(ids,cls,stroke)=>svgEl('polygon',{points:ids.map(id=>{const n=nodeMap.get(id);return `${n.x},${n.y}`;}).join(' '),class:cls,stroke});
 bg.append(poly(['A:0:4','B:0:4','C:0:4'],'river-fill','none'));bg.lastChild.setAttribute('fill','#e7eeee');
 for(const f of Engine.PLAYERS){const t=Engine.PLAYERS[(Engine.PLAYERS.indexOf(f)+1)%3];bg.append(poly([`${f}:0:4`,`${f}:4:4`,`${t}:-4:4`,`${t}:0:4`],'river-fill','none'));bg.lastChild.setAttribute('fill','#e7eeee');bg.append(poly([`${f}:-4:0`,`${f}:4:0`,`${f}:4:4`,`${f}:-4:4`],'faction-land',COLORS[f]));}
 for(const e of BOARD.edges){const cl=e.kind==='bridge'?'bridge-line':e.kind==='palace'?'palace-line':'board-line';bg.append(line(nodeMap.get(e.a),nodeMap.get(e.b),cl,COLORS[e.a[0]]));}
 for(const r of BOARD.rivers){const g=svgEl('g',{transform:`translate(${r.center[0]},${r.center[1]}) rotate(${r.angle})`});g.append(svgEl('text',{y:5,class:'river-title'},r.label));bg.append(g);}
 bg.append(svgEl('text',{x:0,y:-5,class:'board-center-label'},'河域不落子'));
 for(const f of Engine.PLAYERS){const n=nodeMap.get(`${f}:0:0`),next=nodeMap.get(`${f}:0:1`),dx=n.x-next.x,dy=n.y-next.y;bg.append(svgEl('text',{x:n.x+dx*.77,y:n.y+dy*.77+8,class:'territory-name',fill:COLORS[f]},faction(f)));}
 board.append(bg);
 const last=s.events.find(e=>e.type==='move');
 const occupied=new Map(s.pieces.map(p=>[p.node,p]));
 const dests=new Set(replayIndex===null?legal.filter(a=>a.pieceId===selected).map(a=>a.to):[]);
 const focused=focusNode;
 for(const n of BOARD.nodes){const piece=occupied.get(n.id),isLegal=dests.has(n.id),g=svgEl('g',{transform:`translate(${n.x},${n.y})`,class:'node','data-node':n.id,role:'button',tabindex:n.id===focused?'0':'-1','aria-label':piece?`${NAMES[piece.controller]}指挥，${NAMES[piece.origin]}籍${NAME[piece.kind]}，${coord(n.id)}${isLegal?'，可吃':''}`:`${coord(n.id)}，${isLegal?'合法落点':'空点'}`,'aria-disabled':!interactive()?'true':'false'});
 g.append(svgEl('circle',{r:31,class:'hit-area',fill:'transparent'}));g.append(svgEl('circle',{r:2,class:'board-node-dot'}));
 if(last&&(last.from===n.id||last.to===n.id))g.append(svgEl('rect',{x:-31,y:-31,width:62,height:62,rx:5,class:'last-move'}));
 if(piece){g.dataset.pieceId=piece.id;g.dataset.tkController=COUNTRY[piece.controller];const controller=piece.controller,origin=piece.origin;
 g.append(svgEl('circle',{r:27,class:'piece-outer',stroke:COLORS[controller]}));
 if(controller==='C')g.append(svgEl('circle',{r:24,fill:'none',stroke:FILLS.C,'stroke-width':3}));
 g.append(svgEl('text',{y:-3,class:'piece-name','font-size':NAME[piece.kind].length>1?17:24},NAME[piece.kind]));
 const originBadge=svgEl('g',{'data-tk-origin':COUNTRY[origin]});originBadge.append(svgEl('rect',{x:-15,y:11,width:30,height:13,rx:3,fill:FILLS[origin]}));originBadge.append(svgEl('text',{y:21,class:'piece-origin',fill:origin==='C'?'#172735':'#fff'},'籍'+NAMES[origin]));g.append(originBadge);
 g.append(svgEl('rect',{x:-17,y:-37,width:34,height:14,rx:4,fill:FILLS[controller],stroke:COLORS[controller],'stroke-width':1}));g.append(svgEl('text',{y:-27,class:'piece-controller',fill:controller==='C'?'#172735':'#fff'},faction(controller)));
 if(piece.id===selected){g.append(svgEl('path',{d:'M-35 -23v-12h12M23 -35h12v12M35 23v12H23M-23 35h-12V23',class:'selected-outline'}));}
 if(piece.kind==='K'&&s.checks[piece.controller]?.length)g.append(svgEl('path',{d:'M-37 0h9m-4 -4 4 4-4 4M37 0h-9m4 -4-4 4 4 4M0 37v-9m-4 4 4-4 4 4M0 -45v9m-4 -4 4 4 4-4',class:'check-ring'}));
 if(piece.kind==='P'&&selected===piece.id){const forward=piece.origin===n.sector?1:-1;const other=nodeMap.get(`${n.sector}:${n.f}:${n.r+forward}`);if(other){const dx=(other.x-n.x)/64,dy=(other.y-n.y)/64;g.append(svgEl('path',{d:`M${dx*34} ${dy*34} l${dx*15} ${dy*15} m${-dx*4-dy*4} ${-dy*4+dx*4} l${dx*4+dy*4} ${dy*4-dx*4} l${-dx*4+dy*4} ${-dy*4-dx*4}`,class:'pawn-arrow'}));}}
 }
 if(isLegal){if(piece)g.append(svgEl('circle',{r:34,class:'capture-ring'}));else{g.append(svgEl('circle',{r:13,class:'legal-dot'}),svgEl('circle',{r:4,fill:'#6240a0'}));}}
 if(pendingMove?.to===n.id)g.append(svgEl('rect',{x:-34,y:-34,width:68,height:68,rx:5,class:'pending-ring'}));
 g.append(svgEl('rect',{x:-39,y:-43,width:78,height:82,rx:5,class:'focus-outline'}));
 if(settings.showCoordinates)g.append(svgEl('text',{y:46,'font-size':10,'text-anchor':'middle',fill:'#5d6870'},`${n.f+5}·${n.r+1}`));
 g.addEventListener('click',()=>{if(performance.now()<ignoreClickUntil)return;selectNode(n.id);});g.addEventListener('keydown',e=>nodeKey(e,n));g.addEventListener('focus',()=>{focusNode=n.id;});board.append(g);
 }
 if(activeElement){const target=board.querySelector(`[data-node="${activeElement}"]`);target?.focus({preventScroll:true});}
}
function selectNode(id){if(!interactive()){if(overview)announce('请先点国家按钮放大，再行棋。');return;}const p=state.pieces.find(x=>x.node===id);const move=legal.find(a=>a.pieceId===selected&&a.to===id);if(move){pendingMove=move;focusNode=id;render();announce(`待落到${coord(id)}，点击确认落子才提交。`);return;}pendingMove=null;if(p?.controller===state.turn){selected=p.id;focusNode=id;render();announce(`${NAME[p.kind]}已选，${legal.filter(a=>a.pieceId===p.id).length}个合法落点。`);}else{clearSelection();render();announce('请选择当前玩家控制的棋子。');}}
function nodeKey(e,n){if(e.key==='Enter'||e.key===' '){e.preventDefault();selectNode(n.id);return;}if(e.key==='Escape'){e.preventDefault();clearSelection();render();return;}const dirs={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(!dirs[e.key])return;e.preventDefault();const [dx,dy]=dirs[e.key];const candidates=BOARD.nodes.filter(a=>(a.x-n.x)*dx+(a.y-n.y)*dy>10).map(a=>({a,score:Math.hypot(a.x-n.x,a.y-n.y)+Math.abs((a.x-n.x)*dy-(a.y-n.y)*dx)*2})).sort((a,b)=>a.score-b.score);if(candidates[0]){focusNode=candidates[0].a.id;const el=board.querySelector(`[data-node="${focusNode}"]`);board.querySelector('[tabindex="0"]')?.setAttribute('tabindex','-1');el.setAttribute('tabindex','0');el.focus();}}
function applyZoom(value){overview=false;zoom=Math.min(1.65,Math.max(.85,value));board.style.width=(1140*zoom)+'px';board.style.height=(1030*zoom)+'px';viewport.classList.remove('overview');$('overview-notice').hidden=true;$('zoom-label').textContent=Math.round(zoom*100)+'%';renderHUD(renderedState());}
function focusSector(f){board.style.marginInline='';applyZoom(Math.max(.9,zoom));const n=nodeMap.get(`${f||'A'}:0:2`);viewport.scrollLeft=(n.x+570)*zoom-viewport.clientWidth/2;viewport.scrollTop=(n.y+510)*zoom-viewport.clientHeight/2;}
function showOverview(){overview=true;clearSelection();viewport.classList.add('overview');$('overview-notice').hidden=false;const z=Math.min(viewport.clientWidth/1140,viewport.clientHeight/1030);board.style.width=(1140*z)+'px';board.style.height=(1030*z)+'px';board.style.marginInline='auto';viewport.scrollLeft=0;viewport.scrollTop=0;$('zoom-label').textContent='预览';render();}
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
function showRules(){setModal('help','先下起来，再慢慢谋划',`<p>目标：合法实吃敌方主公，接管其余军队；最后存活的主公获胜。三方各自争胜。</p><div class="rule-section"><h3>三种身份，别混淆</h3><p>棋面主名决定走法；外圈国名与 ▲◆■ 是当前指挥；「籍魏 / 籍蜀 / 籍吴」永远不变。普通吃子只移除目标，只有斩主公才全军原地收编。</p></div><div class="rule-section"><h3>七种棋子</h3><p>主公：原籍九宫横竖一步，不飞吃。谋士：原籍九宫斜一步。丞相：田字、塞眼，可跨河出师。车：同一路，不能越子。马：日字，蹩马腿。炮：平走同车，吃子恰隔一架。兵：本国向河岸，过河后向所在国底线或横走，不退、不再渡河。</p></div><div class="rule-section"><h3>看接线，不猜纸面角度</h3><p>每国九路五排，中央河域无落点。过河按画出的15条接线；一着至多用一条河。丞相以后可以再跨别的河。马腿与相眼由展开图确定，合法提示只显示完整安全着。</p></div><div class="rule-section"><h3>将军、困守与交接</h3><p>魏→蜀→吴循环；本方落子后主公必须安全。第三方让线后，下一家可先斩主公，没有插队应将。有安全合法着就必须走；无安全合法着才困守空过。两主公不能沿跨河直路无遮挡照面。</p></div><div class="rule-section"><h3>收编不会奖励连走</h3><p>实吃主公后，败方当前全部余军只换控制者，棋种、原籍、位置不变；先完成收编再检查安全。随后交给下一存活参战方，不继承旧席位。被收编谋士仍守原宫，兵不掉头。</p></div><div class="rule-section"><h3>胜负与和棋</h3><p>仅余一主公则胜。相同稳定局面第三次出现、150手未吃子、参战方连续困守一轮、只余主公或全体同意，判和。正式退局保留军队但不主动攻击；仅余一参战者为技术胜。离开页面只是暂停。</p></div><div class="rule-section"><h3>操作与保存</h3><p>点选棋子，再点空心标记，最后确认落子。Esc取消。Tab进入棋盘，方向键切换棋点，回车选择。手机可拖动空白处、滚动与放大；全盘预览不能行棋。每着尝试本地保存；失败会提示，菜单可导出或导入验证后的棋谱。</p></div><p class="subtle">规则v0.3固定。无随机牌、资源、技能次数、强AI、联网或付费。三方对称不等于已经证明平衡；尚未真人测试。</p>`,[{label:'明白，回到棋盘',primary:true,id:'close-help',run:()=>{closeModal();if(!started)welcome();else{render();restoreTurnPrompt();}}}],{cancel:()=>{closeModal();if(!started)welcome();else{render();restoreTurnPrompt();}}});}
$('confirm-move').onclick=()=>{if(interactive()&&pendingMove)commit(pendingMove);};$('cancel-selection').onclick=()=>{clearSelection();render();};$('pass-button').onclick=()=>{if(interactive()&&!legal.length)commit({type:'pass'});};$('help-button').onclick=showRules;$('more-rules').onclick=showRules;$('menu-button').onclick=showMenu;$('new-after-end').onclick=newGameDialog;$('overview-button').onclick=showOverview;
document.querySelectorAll('[data-focus-sector]').forEach(e=>e.onclick=()=>{board.style.marginInline='';focusSector(e.dataset.focusSector);render();});$('zoom-in').onclick=()=>{board.style.marginInline='';applyZoom(zoom+.15);render();};$('zoom-out').onclick=()=>{board.style.marginInline='';applyZoom(zoom-.15);render();};$('replay-button').onclick=startReplay;$('replay-close').onclick=closeReplay;$('replay-prev').onclick=()=>navigateReplay(replayIndex-1);$('replay-next').onclick=()=>navigateReplay(replayIndex+1);$('replay-range').onchange=e=>navigateReplay(Number(e.target.value));$('record-earlier').onclick=()=>changeRecordPage(-1);$('record-later').onclick=()=>changeRecordPage(1);$('record-locate').onclick=()=>{recordPage=null;renderRecords();};
$('import-input').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const generation=++importGeneration;try{if(file.size>24000000)throw new Error('文件超过24MB读取上限。请保留原文件。');const raw=await file.text();if(generation!==importGeneration)return;const restored=decode(raw,Engine.restore);if(generation!==importGeneration)return;setModal('import','对局验证通过',`<p>已从真实开局重放并验证 ${restored.log.length} 个事件。导入会建立独立存档，不覆盖原局。</p>`,[{label:'取消',run:()=>{closeModal();render();}},{label:'导入并继续',primary:true,id:'confirm-import',run:()=>{state=restored;store.independent();replayState=null;replayGeneration++;replayIndex=null;clearSelection();started=true;paused=false;handoff=!state.result;closeModal();persist();render();if(state.result)showResult();else showHandoff();}}],{cancel:()=>{closeModal();render();}});}catch(error){if(generation!==importGeneration)return;setModal('import-error','没有导入',`<p>${esc(error.message)}</p><p class="callout">当前棋局、旧存档和原文件都未被替换。</p>`,[{label:'返回棋盘',primary:true,run:()=>{closeModal();render();}}]);}});
viewport.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'||e.button!==0||e.target.closest('.node'))return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop,moved:false};viewport.setPointerCapture(e.pointerId);});
viewport.addEventListener('pointermove',e=>{if(!gesture||gesture.id!==e.pointerId)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.abs(dx)+Math.abs(dy)>7){gesture.moved=true;viewport.classList.add('dragging');viewport.scrollLeft=gesture.left-dx;viewport.scrollTop=gesture.top-dy;}});
function endGesture(){if(gesture?.moved)ignoreClickUntil=performance.now()+180;gesture=null;viewport.classList.remove('dragging');}viewport.addEventListener('pointerup',endGesture);viewport.addEventListener('pointercancel',endGesture);viewport.addEventListener('lostpointercapture',endGesture);
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!modal.open){clearSelection();render();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseGame();else if(paused&&started&&!modal.open&&!state.result)showPause();});window.addEventListener('blur',()=>{if(!modal.open)pauseGame();});window.addEventListener('focus',()=>{if(paused&&started&&!modal.open&&!state.result)showPause();});
window.addEventListener('storage',e=>{if(store.noticeExternal(e)){lastSaved=false;saveText='其他页面更改了存档。已停止覆盖，请另存独立局。';paused=true;clearSelection();render();if(!modal.open)setModal('storage-conflict','另一页面更改了存档',`<p>为避免两盘互相覆盖，已暂停保存。当前内存中的棋局仍可导出。</p>`,[{label:'导出当前局',run:exportCurrent},{label:'当前局另存并继续',primary:true,id:'resolve-storage',run:()=>{store.independent();persist();paused=false;closeModal();render();}},{label:'保持暂停',run:()=>{closeModal();showPause();}}]);}});
window.addEventListener('resize',()=>{if(overview)showOverview();});
applyZoom(zoom);render();welcome();
