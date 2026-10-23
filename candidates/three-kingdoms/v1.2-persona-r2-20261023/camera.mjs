/** Presentation-only camera. The original board graph and engine coordinates never change. */
export const VIEW_BOX=Object.freeze({x:-562,y:-473.0785464391565,width:1124,height:1055.8306325798368});
export const PERSPECTIVES=Object.freeze({A:0,B:120,C:-120});
export function projectPoint(point,angle=0){const a=angle*Math.PI/180,c=Math.cos(a),s=Math.sin(a);return {x:point.x*c-point.y*s,y:point.x*s+point.y*c};}
export function unprojectPoint(point,angle=0){return projectPoint(point,-angle);}
export function normalizeAngle(angle){const n=((angle%360)+360)%360;return n===240?-120:n;}
export function worldToViewport(point,{angle=0,zoom=1,offsetX=0,offsetY=0,scrollLeft=0,scrollTop=0}={}){const p=projectPoint(point,angle);return {x:(p.x-VIEW_BOX.x)*zoom+offsetX-scrollLeft,y:(p.y-VIEW_BOX.y)*zoom+offsetY-scrollTop};}
export function viewportToWorld(point,{angle=0,zoom=1,offsetX=0,offsetY=0,scrollLeft=0,scrollTop=0}={}){return unprojectPoint({x:(point.x+scrollLeft-offsetX)/zoom+VIEW_BOX.x,y:(point.y+scrollTop-offsetY)/zoom+VIEW_BOX.y},angle);}
