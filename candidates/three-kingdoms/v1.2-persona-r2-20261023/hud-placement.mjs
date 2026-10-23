/** Presentation-only edge placement. Never changes the camera, chess state, or portrait anchors. */
export function collides(rect,targets=[],gap=4){
 for(const target of targets){
  if(target.radius!==undefined){const dx=Math.max(rect.left-target.x,0,target.x-rect.right),dy=Math.max(rect.top-target.y,0,target.y-rect.bottom);if(Math.hypot(dx,dy)<target.radius+gap)return true;}
  else if(rect.left<target.right+gap&&rect.right>target.left-gap&&rect.top<target.bottom+gap&&rect.bottom>target.top-gap)return true;
 }return false;
}
export function placeDock({width,height,dockWidth,dockHeight,insets={},targets=[],previous=null,gap=4}){
 const left=insets.left??14,top=insets.top??14,right=width-(insets.right??14),bottom=height-(insets.bottom??14),w=dockWidth,h=dockHeight;
 if(!(w>0&&h>0&&right-left>=w&&bottom-top>=h))return null;
 const valid=([x,y])=>{const r={left:x,top:y,right:x+w,bottom:y+h};return x>=left&&y>=top&&r.right<=right+.01&&r.bottom<=bottom+.01&&!collides(r,targets,gap);};
 // Keep a valid previous position. No idle/timer-driven wandering around the perimeter.
 if(previous&&valid([previous.left,previous.top]))return {left:previous.left,top:previous.top,width:w,height:h};
 const xs=new Set([left,right-w,(left+right-w)/2]),ys=new Set([top,bottom-h,(top+bottom-h)/2]);
 for(const t of targets){const r=t.radius!==undefined?{left:t.x-t.radius,right:t.x+t.radius,top:t.y-t.radius,bottom:t.y+t.radius}:t;xs.add(r.left-gap-w);xs.add(r.right+gap);ys.add(r.top-gap-h);ys.add(r.bottom+gap);}
 const candidates=[[right-w,bottom-h],[left,bottom-h],[(left+right-w)/2,top],[right-w,(top+bottom-h)/2],[left,(top+bottom-h)/2]];
 for(const x of xs)candidates.push([x,bottom-h],[x,top]);for(const y of ys)candidates.push([right-w,y],[left,y]);
 const found=candidates.find(valid);return found?{left:found[0],top:found[1],width:w,height:h}:null;
}
