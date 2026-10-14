import {attachBrowserInput as attachRecoveredInput} from './recovered-core.mjs';
// New R1 boundary only. The recovered acceleration/pressure estimator is immutable.
export function attachSafeInput(options){
 const {element,engine,onChange=()=>{},onPause=()=>{}}=options;
 const released=event=>{
  if(event.isTrusted===true&&event.pointerType==='mouse'&&Number.isInteger(event.buttons)&&(event.buttons&1)===0&&engine.getState().activePointerId===event.pointerId){
   event.preventDefault();engine.cancel('contact-buttons-released',event.timeStamp);onChange(engine.getState());onPause('contact-buttons-released');
  }
 };
 element.addEventListener('pointermove',released,true);
 const adapter=attachRecoveredInput(options);let disposed=false;
 return {...adapter,dispose(){if(disposed)return;disposed=true;element.removeEventListener('pointermove',released,true);adapter.dispose();}};
}
