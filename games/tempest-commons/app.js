/* Canvas presentation / inputs. Simulation time never depends on wall-clock time. */
(()=>{
'use strict';
const G=Tempest,V=TempestStorage,$=id=>document.getElementById(id);
const canvas=$('field'),ctx=canvas.getContext('2d'),T=24,colors=['#7debc3','#ee927c'];
let storage;try{storage=window.localStorage}catch(e){storage={get length(){throw e},getItem(){throw e},setItem(){throw e},removeItem(){throw e}}}
const bytes=new Uint32Array(4);crypto.getRandomValues(bytes);
const vault=new V.Vault(storage,Date.now().toString(36)+'-'+Array.from(bytes,x=>x.toString(16)).join('-'));
let s=G.create(),selected=[],buildMode=null,attackMode=false,started=false,drag=null,pointer={x:0,y:0},lastTime=0,acc=0,lastHud=0,lastAutosave=0,lastStatus='playing',audio=null;
s.paused=true;
function notify(message){$('notice').textContent=message}
function tone(high=false){if(!$('sound').checked)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.value=high?620:340;v.gain.setValueAtTime(.025,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.13);o.connect(v);v.connect(audio.destination);o.start();o.stop(audio.currentTime+.15)}catch(e){}}
function format(tick){const sec=Math.floor(tick/G.HZ);return String(Math.floor(sec/60)).padStart(2,'0')+':'+String(sec%60).padStart(2,'0')}
function refreshSlots(){
 const keep=$('slots').value,items=vault.list();$('slots').replaceChildren();
 for(const item of items){
  const o=document.createElement('option');o.value=item.key;o.textContent=item.error?'⚠ 损坏 / 不支持 · '+item.key.slice(-8):format(item.tick)+' · 种子 '+item.seed+(item.memory?' · 内存':'')+(item.key===vault.key?' · 本页':'')+(item.migrated?' · 旧格式':'');$('slots').append(o);
 }
 if(!items.length){const o=document.createElement('option');o.value='';o.textContent='暂无存档';$('slots').append(o)}
 if(items.some(x=>x.key===keep))$('slots').value=keep;
 else if(items.some(x=>x.key===vault.key))$('slots').value=vault.key;
}
function save(manual=false){if(!started)return;try{const r=vault.save(s);$('save-state').textContent=r.persistent?'已保存 '+format(s.tick):'仅内存 · 未持久化';if(manual||!r.persistent)notify(r.persistent?'已保存到本页独立槽位。':vault.error);refreshSlots()}catch(e){notify('保存未完成：'+e.message)}}
function adopt(state,message){
 s=state;s.paused=true;started=true;selected=[];buildMode=null;attackMode=false;drag=null;acc=0;lastAutosave=s.tick;lastStatus=s.status;
 $('intro').classList.add('hidden');$('result').classList.toggle('hidden',s.status==='playing');$('seed').value=s.seed;notify(message+'；当前已暂停，点击继续。');hud();result();
}
function result(){
 if(s.status==='playing')return;
 $('result').classList.remove('hidden');$('pause-banner').classList.add('hidden');
 $('result-title').textContent=s.status==='won'?'群岛，再度点亮。':s.status==='draw'?'双方面临停摆。':'能源网络已失守。';
 $('result-body').textContent=(s.status==='won'?'赤砾中枢已关闭，苍穹合作社取得能源网络控制权。':s.status==='lost'?'己方潮汐中枢被摧毁。尝试先建立哨塔，积攒棱镜车后集中推进。':'两座潮汐中枢均被摧毁。')+' 行动用时 '+format(s.tick)+'，摧毁目标 '+s.kills[0]+'。';
}
function pause(message){if(!started||s.status!=='playing')return;s.paused=true;acc=0;drag=null;notify(message);save();hud()}
function togglePause(){if(!started||s.status!=='playing'||$('confirm').open)return;s.paused=!s.paused;acc=0;lastTime=performance.now();notify(s.paused?'模拟已暂停。':'行动继续。');hud()}
function resetPrompt(){if($('confirm').open)return;pause('等待重置确认；取消后可继续行动。');$('confirm').showModal()}
$('confirm-reset').onclick=()=>{
 vault.clearOwn();const seedText=$('seed').value.trim();const seed=/^\d{1,10}$/.test(seedText)?Number(seedText)>>>0:72134;
 s=G.create(seed);selected=[];buildMode=null;attackMode=false;started=true;drag=null;acc=0;lastAutosave=0;lastStatus='playing';$('intro').classList.add('hidden');$('result').classList.add('hidden');$('confirm').close();notify('新行动已就绪。种子 '+seed+'。');save();hud();
};
$('cancel-reset').onclick=()=>$('confirm').close();
$('restart').onclick=resetPrompt;$('result-restart').onclick=resetPrompt;
$('start').onclick=()=>{if(started)return;started=true;s.paused=false;lastTime=performance.now();$('intro').classList.add('hidden');notify('采集车已出发。可先生产巡游蜂，再编队向东推进。');tone();save();hud()};
$('pause').onclick=togglePause;
$('save').onclick=()=>save(true);
$('load').onclick=()=>{
 const key=$('slots').value;if(!key){notify('尚无可读取的存档。');return}
 try{const d=vault.load(key);adopt(d.state,d.migrated?'旧格式已在内存迁移；原档保留':'存档已恢复');$('save-state').textContent='已读取 · 尚未写入本页'}catch(e){pause('读档失败，当前进度保留。');notify('读档失败：'+e.message)}
};
$('export').onclick=()=>{
 try{const blob=new Blob([V.encode(s)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='tempest-commons-'+s.seed+'-'+s.tick+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('已生成当前进度 JSON 备份。')}catch(e){notify('导出失败：'+e.message)}
};
$('import').onclick=()=>{pause('导入前已暂停。');$('import-file').click()};
$('import-file').onchange=async e=>{
 const f=e.target.files[0];if(!f)return;
 try{if(f.size>2000000)throw Error('文件超过 2 MB 限制');const d=V.decode(await f.text());adopt(d.state,d.migrated?'导入并迁移成功':'导入成功');$('save-state').textContent='已导入 · 尚未写入本页'}catch(err){notify('导入失败，原进度保留：'+err.message)}e.target.value='';
};
document.querySelectorAll('[data-build]').forEach(b=>b.onclick=()=>{
 if(!started||s.paused||s.status!=='playing'){notify('请先开始或继续行动。');return}
 buildMode=b.dataset.build;attackMode=false;notify('放置'+G.SPEC[buildMode].name+'：中枢十格内左键确认，Esc 取消。');hud();
});
document.querySelectorAll('[data-train]').forEach(b=>b.onclick=()=>{
 const r=G.train(s,b.dataset.train);notify(r.ok?G.SPEC[b.dataset.train].name+' 已进入生产队列。':r.error);if(r.ok)tone();hud();
});
function selectArmy(){selected=s.entities.filter(e=>e.team===0&&!G.SPEC[e.type].building&&e.type!=='hauler').map(e=>e.id);notify('已选择 '+selected.length+' 个作战单位。');hud()}
$('select-army').onclick=selectArmy;
function armAttack(){if(!started||s.paused)return;buildMode=null;attackMode=true;notify('左键战场：向目标推进并攻击沿途敌人。');hud()}
$('attackmove').onclick=armAttack;
$('stop').onclick=()=>{G.command(s,selected,'stop',0,0);notify('所选单位停止移动。')};
function coords(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*G.W,y:(e.clientY-r.top)/r.height*G.H}}
function entityAt(p,enemyOnly=false){return s.entities.filter(e=>(!enemyOnly||e.team===1)&&(!$('fog').checked||G.visible(s,e))&&Math.hypot(e.x-p.x,e.y-p.y)<(G.SPEC[e.type].building?1.3:.8)).sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0]}
function issue(p){
 if(!started||s.paused||s.status!=='playing')return;
 const e=entityAt(p,true),r=s.resources.find(r=>r.amount>0&&Math.hypot(r.x-p.x,r.y-p.y)<1);
 const kind=e?'attack':r?'harvest':'move';
 if(G.command(s,selected,kind,p.x,p.y,e?.id||r?.id)){notify(e?'攻击 '+G.SPEC[e.type].name:r?'采集车开始采集；战斗单位保持原指令。':'编队向指定区域移动。');tone()}
 else notify('请先选择己方单位。');
}
canvas.oncontextmenu=e=>{e.preventDefault();buildMode=null;attackMode=false;drag=null;issue(coords(e));hud()};
canvas.onpointerdown=e=>{
 if(e.button!==0)return;canvas.focus({preventScroll:true});pointer=coords(e);
 if(!started||s.paused||s.status!=='playing')return;
 if(buildMode){const r=G.build(s,buildMode,Math.round(pointer.x),Math.round(pointer.y));notify(r.ok?'建造完成。':r.error);if(r.ok){buildMode=null;tone(true)}hud();return}
 if(attackMode){G.command(s,selected,'attackMove',pointer.x,pointer.y);attackMode=false;notify('攻击移动指令已下达。');hud();return}
 drag={start:pointer,end:pointer,shift:e.shiftKey};try{canvas.setPointerCapture(e.pointerId)}catch(error){/* Pointer may already be canceled by the platform. */}
};
canvas.onpointermove=e=>{pointer=coords(e);if(drag)drag.end=pointer};
canvas.onpointerup=e=>{
 if(!drag||e.button!==0)return;const d=drag;drag=null;
 const p=coords(e),area=Math.hypot(d.start.x-p.x,d.start.y-p.y)>.4;
 let ids;if(area){ids=s.entities.filter(e=>e.team===0&&!G.SPEC[e.type].building&&e.x>=Math.min(d.start.x,p.x)&&e.x<=Math.max(d.start.x,p.x)&&e.y>=Math.min(d.start.y,p.y)&&e.y<=Math.max(d.start.y,p.y)).map(e=>e.id)}
 else{const hit=entityAt(p);ids=hit?.team===0?[hit.id]:[]}
 selected=d.shift?[...new Set([...selected,...ids])]:ids;hud();
};
canvas.onpointercancel=()=>drag=null;
document.addEventListener('keydown',e=>{
 if(['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)||$('confirm').open)return;
 if(e.code==='Space'){e.preventDefault();if(!e.repeat)togglePause()}
 if(e.repeat)return;
 if(e.key.toLowerCase()==='f')selectArmy();
 if(e.key.toLowerCase()==='a')armAttack();
 if(e.key.toLowerCase()==='s')G.command(s,selected,'stop',0,0);
 if(e.key==='Escape'){buildMode=null;attackMode=false;selected=[];drag=null;hud()}
});
window.addEventListener('blur',()=>pause('窗口失焦，已自动暂停。'));
document.addEventListener('visibilitychange',()=>{if(document.hidden)pause('页面隐藏，已自动暂停。')});
window.addEventListener('pagehide',()=>save());
window.addEventListener('storage',e=>{if(e.key?.startsWith(V.NS)){refreshSlots();notify('其他标签的存档列表已更新；当前战役不受影响。')}});
function hud(){
 selected=selected.filter(id=>s.entities.some(e=>e.id===id&&e.team===0));
 $('credits').textContent=Math.floor(s.credits[0]);const power=G.energy(s,0);$('energy').textContent=(power>=0?'+':'')+power;$('energy').style.color=power>=0?'':'#ee927c';
 $('clock').textContent=format(s.tick);$('weather').textContent=G.storm(s)?'⚡ 强风暴 · 移动 62%':'晴空 · 距风暴 '+Math.ceil((1500-s.tick%2000)/20)+'s';
 const h=s.entities.find(e=>e.type==='hq'&&e.team===0);$('hq-hp').textContent=Math.max(0,h?.hp||0)+' / 1500';$('hq-progress').value=h?.hp||0;
 $('population').textContent=s.entities.filter(e=>e.team===0&&!G.SPEC[e.type].building).length+' / 45';
 const q=s.entities.filter(e=>e.team===0&&e.type==='factory').flatMap(e=>e.queue);
 $('queue').textContent=q.length?'队列 '+q.length+' · '+G.SPEC[q[0].type].name+' '+Math.max(0,Math.ceil(q[0].left/20))+'s'+(power<0?' · 缺电减速':''):'工坊空闲 · 可排队生产';
 const es=s.entities.filter(e=>selected.includes(e.id));
 $('selection').textContent=es.length===1?G.SPEC[es[0].type].name+' · '+Math.ceil(es[0].hp)+' HP':es.length?'已选择 '+es.length+' 个单位':'暂无选中单位';
 $('pause').innerHTML=(s.paused?'继续':'暂停')+' <kbd>Space</kbd>';
 $('pause-banner').classList.toggle('hidden',!started||!s.paused||s.status!=='playing');
 document.querySelectorAll('[data-build]').forEach(b=>{b.classList.toggle('armed',buildMode===b.dataset.build);b.disabled=!started||s.paused||s.status!=='playing'});
 document.querySelectorAll('[data-train]').forEach(b=>b.disabled=!started||s.paused||s.status!=='playing');
 $('attackmove').classList.toggle('armed',attackMode);
}
function rect(x,y,w,h,color){ctx.fillStyle=color;ctx.fillRect(x,y,w,h)}
function line(x,y,xx,yy,color,width=1){ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(xx,yy);ctx.stroke()}
function circle(x,y,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill()}
function drawEntity(e){
 const x=e.x*T,y=e.y*T,c=colors[e.team],sel=selected.includes(e.id),b=G.SPEC[e.type].building;
 if(sel){ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(x,y+4,b?29:16,b?20:9,0,0,Math.PI*2);ctx.stroke()}
 ctx.save();ctx.translate(x,y);ctx.shadowColor='#0007';ctx.shadowBlur=4;ctx.shadowOffsetY=5;
 if(b){
  rect(-23,-17,46,37,'#11262c');rect(-20,-20,40,34,e.team===0?'#496e6a':'#755b50');rect(-20,8,40,6,'#263e41');rect(-17,-17,34,23,'#243e43');
  if(e.type==='solar'){for(let i=0;i<3;i++)for(let j=0;j<2;j++){rect(-17+i*12,-15+j*10,10,8,'#347286');line(-16+i*12,-12+j*10,-8+i*12,-12+j*10,'#66a2ad')}}
  if(e.type==='hq'){rect(-14,-13,28,23,'#678681');rect(-10,-19,20,21,'#a0b0a1');rect(-7,-16,14,12,c);rect(-3,-29,6,11,'#b5c4af');circle(0,-30,3,c);rect(-18,8,8,5,c);rect(10,8,8,5,c)}
  if(e.type==='factory'){rect(-16,-12,32,18,'#122b30');rect(-11,-9,22,12,c);rect(-5,-6,10,14,'#354e50');rect(14,-26,5,15,'#98aaa0');if(e.queue.length)circle(-18,-19,3,'#ebcd87')}
  if(e.type==='turret'){circle(0,-4,13,'#839b90');circle(0,-4,8,c);rect(-3,-24,6,24,'#c0caba');rect(-6,-27,12,6,'#d5e5ce')}
 }else if(e.type==='hauler'){rect(-12,-7,24,16,'#283f42');rect(-9,-11,18,16,c);rect(-7,-9,14,7,'#668e8c');rect(-6,0,12,7,'#233e3e');if(e.cargo)rect(-5,1,10*e.cargo/96,5,'#ebcd87');rect(-14,-7,4,15,'#10282c');rect(10,-7,4,15,'#10282c')}
 else if(e.type==='scout'){line(-11,0,11,0,'#354f52',4);circle(-11,0,5,'#203a3e');circle(11,0,5,'#203a3e');ctx.fillStyle=c;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(9,4);ctx.lineTo(0,9);ctx.lineTo(-9,4);ctx.closePath();ctx.fill();circle(0,0,3,'#f2f3d0')}
 else{rect(-14,-10,7,23,'#12272c');rect(7,-10,7,23,'#12272c');rect(-9,-12,18,24,c);rect(-6,-7,12,13,'#496461');rect(-3,-21,6,18,'#bcd9c4');circle(0,-5,5,'#dbedbd')}
 ctx.restore();
 if(sel||e.hp<G.SPEC[e.type].hp){const w=b?40:25;rect(x-w/2,y-(b?35:27),w,3,'#07181d');rect(x-w/2,y-(b?35:27),w*Math.max(0,e.hp/G.SPEC[e.type].hp),3,c)}
}
function draw(){
 ctx.clearRect(0,0,960,624);
 for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++){
  const v=(x*17+y*23+s.seed)%7;rect(x*T,y*T,T,T,['#263d3b','#283f3a','#2b423c','#293f3b','#2c413b','#2b403d','#283c38'][v]);
  if(s.terrain[y*G.W+x]){rect(x*T,y*T,T,T,'#172e37');line(x*T+4,y*T+7,x*T+20,y*T+7,'#3d6670',2);line(x*T+7,y*T+16,x*T+16,y*T+16,'#36565c',1)}
  else if(v===0){circle(x*T+7,y*T+5,1.4,'#587064');circle(x*T+16,y*T+19,1,'#526b5b')}
 }
 // Dry channels / bridge lanes.
 [8.5,18.5].forEach(y=>{rect(18*T,(y-1)*T,4*T,3*T,'#5a6251');for(let x=18;x<22;x++){line(x*T,(y-1)*T,x*T,(y+2)*T,'#778171');line(x*T,(y-1)*T,x*T+T,(y-1)*T,'#9da68b',3)}});
 for(const r of s.resources){if(r.amount<=0)continue;ctx.save();ctx.translate(r.x*T,r.y*T);ctx.fillStyle='#abc77a';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(9,-3);ctx.lineTo(5,8);ctx.lineTo(-7,7);ctx.lineTo(-10,-2);ctx.closePath();ctx.fill();ctx.fillStyle='#dcdf9b';ctx.beginPath();ctx.moveTo(0,-13);ctx.lineTo(1,5);ctx.lineTo(-7,7);ctx.lineTo(-10,-2);ctx.closePath();ctx.fill();ctx.restore()}
 s.entities.filter(e=>!$('fog').checked||G.visible(s,e)).sort((a,b)=>a.y-b.y||a.id-b.id).forEach(drawEntity);
 for(const shot of s.events){if($('fog').checked&&!s.entities.some(e=>e.team===0&&Math.hypot(e.x-shot.tx,e.y-shot.ty)<8))continue;line(shot.x*T,shot.y*T-7,shot.tx*T,shot.ty*T-7,shot.team===0?'#c5ffd9':'#ffc191',2);circle(shot.tx*T,shot.ty*T-7,4,'#fff2c9')}
 if($('fog').checked){
  const vis=new Uint8Array(G.W*G.H);
  for(const e of s.entities.filter(e=>e.team===0)){const r=G.SPEC[e.type].building?8:7;for(let y=Math.max(0,Math.floor(e.y-r));y<Math.min(G.H,Math.ceil(e.y+r));y++)for(let x=Math.max(0,Math.floor(e.x-r));x<Math.min(G.W,Math.ceil(e.x+r));x++)if(Math.hypot(x+.5-e.x,y+.5-e.y)<r)vis[y*G.W+x]=1}
  for(let y=0;y<G.H;y++)for(let x=0;x<G.W;x++)if(!vis[y*G.W+x])rect(x*T,y*T,T+.5,T+.5,s.explored[y*G.W+x]?'#0818228c':'#081822ec');
 }
 if(G.storm(s)){rect(0,0,960,624,'#8eabc518');for(let i=0;i<40;i++){const x=(i*97+s.tick*8)%1000,y=(i*71+s.tick*3)%650;line(x,y,x-16,y+7,'#c3dce044')}}
 if(buildMode){const x=Math.round(pointer.x),y=Math.round(pointer.y),valid=!G.canBuild(s,buildMode,x,y);rect((x-1)*T,(y-1)*T,48,48,valid?'#7debc355':'#ff746055');ctx.strokeStyle=valid?'#7debc3':'#ff7460';ctx.strokeRect((x-1)*T,(y-1)*T,48,48)}
 if(drag){const x=Math.min(drag.start.x,drag.end.x)*T,y=Math.min(drag.start.y,drag.end.y)*T,w=Math.abs(drag.start.x-drag.end.x)*T,h=Math.abs(drag.start.y-drag.end.y)*T;rect(x,y,w,h,'#7debc31a');ctx.strokeStyle='#7debc3';ctx.strokeRect(x,y,w,h)}
 ctx.fillStyle='#d6e7db';ctx.font='10px Consolas';ctx.fillText('苍穹营地',48,22);if(!$('fog').checked)ctx.fillText('赤砾控制区',795,22);
}
function frame(now){
 const dt=Math.min(250,Math.max(0,now-lastTime));lastTime=now;
 if(started&&!s.paused&&s.status==='playing'){
  acc+=dt;let n=0;while(acc>=50&&n++<5){G.step(s);acc-=50}
  if(s.tick-lastAutosave>=300){lastAutosave=s.tick;save()}
 }else acc=0;
 if(s.status!==lastStatus){lastStatus=s.status;result();save();tone(true)}
 if(now-lastHud>100){hud();lastHud=now}draw();requestAnimationFrame(frame);
}
refreshSlots();hud();requestAnimationFrame(frame);
})();

