/* UI-independent lifecycle and operation boundary controller. */
(function(root){'use strict';
const C=root.CommandBattle,S=root.CommandSave;
class Session{
 constructor(storage,now=0,seed=72134){this.storage=storage;this.sequence=0;this.operation=0;this.phase='playing';this.busy=false;this.notice='';this.pendingSave=false;this.externalBlock=false;this.replace(C.create(seed),now)}
 newSlot(){this.slot=new S.Save(this.storage,Date.now().toString(36)+'-'+(++this.sequence)+'-'+Math.random().toString(36).slice(2,8))}
 replace(g,now){this.operation++;this.g=g;this.timeline=new root.CommandTimeline(g,now);this.phase=g.sim.status==='playing'?(g.sim.paused?'paused':'playing'):'result';this.busy=false;this.pendingSave=false;this.externalBlock=false;this.newSlot()}
 get active(){return this.phase==='playing'&&!this.busy&&this.g.sim.status==='playing'}
 command(c,now){return this.active&&this.timeline.enqueue(c,now)}
 write(){if(this.externalBlock){this.notice='其他页面已更改存档，自动保存已停止。可导出或另存。';return false}try{const ok=this.slot.write(this.g);if(!ok)this.notice='保存失败：仅保留在当前页面，请导出备份。';return ok}catch(e){this.notice=e.message;return false}}
 preserve(){const ok=this.write();if(!ok)this.notice='旧进度未能保存，暂未替换战局。请先导出。';return ok}
 pause(now){if(this.busy||this.phase!=='playing')return false;this.operation++;this.timeline.pause(now);this.phase='paused';this.pendingSave=true;return true}
 resume(now){if(this.busy||this.phase!=='paused')return false;this.operation++;this.timeline.resume(now);this.phase='playing';return true}
 askRestart(){if(this.busy||this.phase!=='paused')return false;this.operation++;this.phase='confirm';return true}
 cancelRestart(){if(this.phase!=='confirm')return false;this.operation++;this.phase='paused';return true}
 restart(now){if(this.busy||!['confirm','result'].includes(this.phase))return false;this.operation++;if(!this.preserve())return false;this.replace(C.create(this.g.sim.seed),now);return true}
 requestExport(now,callback){if(this.busy||!['paused','result'].includes(this.phase))return false;this.operation++;this.timeline.pause(now);this.busy=true;this.exportCallback=callback;this.notice='正在结算并导出，完成前保持暂停…';return true}
 flushExport(){if(!this.busy||!this.timeline.settled)return;const callback=this.exportCallback;this.exportCallback=null;this.busy=false;try{const raw=S.encode(this.g),name='tempest-command-'+this.g.sim.seed+'-tick'+this.g.sim.tick+'.json';callback(raw,name);this.notice='导出已请求，请检查浏览器下载。战局保持暂停。'}catch(e){this.notice='导出失败，战局仍保留，请重试。'}}
 saveAs(){if(this.busy)return false;this.operation++;if(this.externalBlock){this.externalBlock=false;this.newSlot()}this.pendingSave=true;return true}
 load(key,now){if(this.busy||this.phase!=='paused')return false;this.operation++;let g;try{g=this.slot.load(key)}catch(e){this.notice=e.message;return false}if(!this.preserve())return false;g.sim.paused=true;this.replace(g,now);return true}
 async importFile(file,now){if(this.busy||this.phase!=='paused'||!file)return false;const token=++this.operation;try{if(file.size>2000000)throw Error('文件过大');const raw=await file.text();if(token!==this.operation||this.busy||this.phase!=='paused')return false;const g=S.decode(raw);if(!this.preserve())return false;g.sim.paused=true;this.replace(g,now());this.notice='存档已导入，点击继续。';return true}catch(e){if(token===this.operation&&!this.busy)this.notice=e.message;return false}}
 cancelImport(){this.operation++}
 storageChanged(key){if(key===null||key===this.slot.key){this.operation++;this.externalBlock=true;this.pendingSave=false;this.notice='存档已在其他页面更改，自动保存已停止。可导出或另存。'}}
 frame(now){const before=this.g.sim.status,n=this.timeline.drain(now,10);if(this.g.sim.status!=='playing'){this.timeline.pause(now);this.phase='result';if(before==='playing')this.pendingSave=true}
 if(this.pendingSave&&this.timeline.settled){this.pendingSave=false;this.write()}if(this.busy)this.flushExport();return n}
}
root.CommandSession=Session;
})(globalThis);
