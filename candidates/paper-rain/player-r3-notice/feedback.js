/* Presentation-only feedback. It observes real events; it never changes a run. */
(function(root){
'use strict';
const C=typeof module==='object'&&module.exports?require('./core.js'):root.PaperCore;
const TEXT={
 empty:'这拍未碰到球 · 对准来球，等“可拍”提示',
 contact:'拍到了 · 回球击中纸靶才得分',
 block:'挡到了 · 格挡不计命中',
 score:'命中纸靶 +1',
 miss:'漏球了 · 对准下一球，等“可拍”提示',
 wide:'回球未中纸靶 · 面向纸靶再拍返'
};
function createTracker(){let state=null,seen=new WeakSet(),pending=[],notice=null;
 const offer=(kind,at)=>{if(!notice||at>=notice.at)notice={kind,at,text:TEXT[kind]};};
 function update(s){
  if(state!==s){state=s;seen=new WeakSet();pending=[];notice=null;}
  for(const ev of s.events){if(seen.has(ev))continue;seen.add(ev);
   if(ev.kind==='swing'||ev.kind==='empty')pending.push({at:ev.t,end:ev.t+C.PADDLE.duration,resolved:false});
   else if(ev.kind==='contact'||ev.kind==='block'){
    for(const p of pending)if(ev.t>=p.at-1e-9&&ev.t<=p.end+1e-9)p.resolved=true;
    // A real guard contact also takes priority over an older empty swing.
    offer(ev.kind,ev.t);
   }else if(['score','miss','wide'].includes(ev.kind))offer(ev.kind,ev.t);
   else if(['pause','resume','over'].includes(ev.kind)){pending=[];notice=null;}
  }
  // An "empty" press may still sweep into an approaching ball. Wait until the
  // complete physical stroke window has ended before reporting no contact.
  pending=pending.filter(p=>{if(s.t<p.end)return true;if(!p.resolved)offer('empty',p.end);return false;});
  return s.phase==='playing'&&notice&&s.t-notice.at<1.8?{...notice}:null;
 }
 return {update};
}
const api={TEXT,createTracker};if(typeof module==='object'&&module.exports)module.exports=api;else root.PaperFeedback=api;
})(typeof globalThis!=='undefined'?globalThis:this);
