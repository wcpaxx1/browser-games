/* Original presentation geometry. The existing core's eye-origin hitscan is
   authoritative; cosmetic barrel placement never changes hit/collision logic. */
(function(root){'use strict';
const ART={vanish:{x:.30,y:.10},muzzle:{x:.50,y:.33}};
function muzzle(C,p,aim){const a=aim.a??p.a,pitch=aim.pitch??p.pitch,f={x:Math.cos(a),y:Math.sin(a)},r={x:-f.y,y:f.x},dx=f.x*.62+r.x*.146,dy=f.y*.62+r.y*.146;let fraction=0;for(let i=1;i<=40;i++){const t=i/40;if(!C.clear(p.x+dx*t,p.y+dy*t,.045))break;fraction=t;}return {x:p.x+dx*fraction,y:p.y+dy*fraction,z:C.EYE+Math.tan(pitch)*.62*fraction-.17,back:.62*fraction,clipped:fraction<1,fraction};}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=v=>{v=clamp(v,0,1);return v*v*(3-2*v);};
// Source-image-local masks, in a 1254-unit square. They isolate the project's
// own baked support arm and magazine; no commercial or external parts are used.
const SIZE=1254;
const SUPPORT=[[0,470],[660,475],[675,491],[686,518],[696,553],[710,597],[724,643],[746,691],[768,730],[748,738],[724,760],[714,788],[687,814],[665,852],[637,914],[613,967],[594,1045],[555,1140],[490,1254],[0,1254]];
const MAGAZINE=[[768,731],[784,781],[806,838],[834,881],[855,890],[843,930],[825,977],[800,1021],[767,1068],[740,1086],[690,1086],[682,1068],[678,989],[684,936],[710,875],[739,814]];
const WELL={x:791,y:764},PALM={x:665,y:643},MAG_GRIP={x:-70,y:190};
function path(g,points){g.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)g.lineTo(points[i][0],points[i][1]);g.closePath();}
function piece(g,img,points){g.save();g.beginPath();path(g,points);g.clip();g.drawImage(img,0,0,SIZE,SIZE);g.restore();}
// The mechanical pose is supplied by the existing motion controller. The
// presentation scales only travel distances, never reload time or readiness.
function reloadRig(pose,p){
 const active=p.reload>0,t=active?clamp(pose?.reloadProgress??1-p.reload/1.05,0,1):0;
 const lift=active?ease(t/.16)*(1-ease((t-.86)/.14)):0;
 const seat=pose?.magWell||{x:-3,y:-151},mag=pose?.magazine||seat;
 const offset={x:(mag.x-seat.x)*3.8,y:(mag.y-seat.y)*.50};
 const magazine={x:WELL.x+offset.x,y:WELL.y+offset.y,angle:0};
 const grip={x:magazine.x+MAG_GRIP.x,y:magazine.y+MAG_GRIP.y};
 const raw=pose?.handGrip||{x:-42,y:-186};
 // The fetch interval keeps its empty hand at the extracted magazine grip.
 // Below the frame the same hand returns with the next magazine. Visibility is
 // clipped by the viewport, not changed with an abrupt alpha switch.
 const locked=!!pose?.gripLocked,fetch=active&&t>=.40&&t<.58;
 const hand=locked||fetch?{...grip}:{x:PALM.x+(raw.x+42)*(WELL.x+MAG_GRIP.x-PALM.x)/39,y:PALM.y+(raw.y+186)*(WELL.y+MAG_GRIP.y-PALM.y)/83};
 // Existing fetch visibility is respected, but both transitions pass through
 // the bottom of the frame by continuous travel rather than a hard cut.
 const fetchTravel=active&&t>=.32&&t<.66?(t<.40?ease((t-.32)/.08):t<.58?1:1-ease((t-.58)/.08))*330:0;
 magazine.y+=fetchTravel;hand.y+=fetchTravel;grip.y+=fetchTravel;
 const rotation=active?-.10*lift:0;
 return {active,t,lift,rotation,magazine,grip,hand,gripLocked:locked||fetch,fetchTravel,stage:active?pose?.reloadStage||'reload':'ready',bolt:pose?.bolt||0};
}
// Bounded placement preserves the former idle/aim transform. During reload the
// muzzle and receiver stay in view; the action rises into the lower-right field.
function layout(aim,muzzleScreen,pose,p){
 if(!muzzleScreen)return null;
 const dx=muzzleScreen.x-aim.x,dy=muzzleScreen.y-aim.y,ux=ART.muzzle.x-ART.vanish.x,uy=ART.muzzle.y-ART.vanish.y,rawScale=Math.hypot(dx,dy)/Math.hypot(ux,uy),rawAngle=Math.atan2(dy,dx)-Math.atan2(uy,ux),scale=clamp(rawScale,520,700),baseAngle=clamp(rawAngle,-.18,.18),baseX=clamp(muzzleScreen.x,480,710),baseY=clamp(muzzleScreen.y,390,450),wallLower=muzzleScreen.fraction===undefined?0:Math.max(0,(.35-muzzleScreen.fraction)/.35)*300,rig=reloadRig(pose,p),x=baseX-rig.lift*45,y=baseY+wallLower-rig.lift*195,angle=baseAngle+rig.rotation;
 return {x,y,scale,angle,muzzle:{x,y},lower:wallLower,visible:true,rig,presentationClamped:baseX!==muzzleScreen.x||baseY!==muzzleScreen.y||scale!==rawScale||baseAngle!==rawAngle,worldMuzzleScreen:{x:muzzleScreen.x,y:muzzleScreen.y}};
}
function drawReceiverUnderHand(g,img){
 // A narrow material-matched continuation beneath the support glove. The
 // original receiver texture is sampled without duplicating recognizable parts.
 g.save();g.beginPath();path(g,[[660,478],[679,482],[709,558],[750,674],[774,734],[744,743],[711,669],[675,558],[648,501]]);g.clip();
 g.drawImage(img,974,802,24,38,640,470,145,285);
 const shade=g.createLinearGradient(653,540,749,644);shade.addColorStop(0,'#080c0cdd');shade.addColorStop(.4,'#272b28a0');shade.addColorStop(1,'#625f5160');g.fillStyle=shade;g.fillRect(640,470,145,285);
 g.strokeStyle='#aaa48c88';g.lineWidth=2;g.beginPath();g.moveTo(659,490);g.lineTo(747,728);g.stroke();g.restore();
}
function drawMagazine(g,img){
 // Original procedural curved shell with the source magazine's fine-grained
 // material. The baked cutout is not moved because its top contains receiver
 // pixels that would look like detached gun fragments when exposed.
 g.save();g.beginPath();path(g,[[766,756],[805,771],[825,829],[814,910],[784,995],[745,1078],[703,1078],[696,1045],[705,979],[731,896],[753,815]]);g.clip();
 g.drawImage(img,717,940,42,70,692,750,140,335);
 const shade=g.createLinearGradient(700,850,825,870);shade.addColorStop(0,'#181b19b0');shade.addColorStop(.25,'#4c483728');shade.addColorStop(.65,'#302f27aa');shade.addColorStop(1,'#090e10df');g.fillStyle=shade;g.fillRect(690,750,145,340);
 g.lineWidth=2.6;for(let i=0;i<4;i++){g.strokeStyle=i%2?'#93887277':'#b5a58b55';g.beginPath();g.moveTo(764+i*11,787);g.bezierCurveTo(801+i*5,870,753+i*10,993,716+i*9,1063);g.stroke();}
 for(let i=0;i<5;i++){g.strokeStyle='#0a100e99';g.lineWidth=5;g.beginPath();g.moveTo(738-i*9,844+i*46);g.quadraticCurveTo(777-i*9,859+i*46,820-i*9,852+i*46);g.stroke();}
 g.restore();g.strokeStyle='#a3967c77';g.lineWidth=2;g.beginPath();g.moveTo(766,757);g.lineTo(805,772);g.stroke();
}
function drawReload(g,img,rig){
 // Body/trigger hand is cut around both moving parts. Drawing another hand on
 // top of the unmasked original would leave a frozen duplicate underneath.
 drawReceiverUnderHand(g,img);
 g.save();g.beginPath();g.rect(0,0,SIZE,SIZE);path(g,SUPPORT);path(g,MAGAZINE);g.clip('evenodd');g.drawImage(img,0,0,SIZE,SIZE);g.restore();
 // The well is recessed, and the lip covers the moving magazine's top edge.
 g.fillStyle='#121617';g.beginPath();path(g,[[769,739],[801,774],[819,823],[802,837],[774,797],[753,755]]);g.fill();
 g.save();g.translate(rig.magazine.x-WELL.x,rig.magazine.y-WELL.y);drawMagazine(g,img);g.restore();
 // Preserve the actual navy weave and olive glove; only its rigid attachment
 // transform changes. The long sleeve exits the screen, never a floating palm.
 g.save();g.translate(rig.hand.x-PALM.x,rig.hand.y-PALM.y);piece(g,img,SUPPORT);g.restore();
 // Original receiver edge is an occluder at the seat, keeping insertion behind it.
 piece(g,img,[[767,722],[807,772],[843,846],[822,861],[794,809],[764,765]]);
 // Short mechanical completion cue is driven by the existing bolt pose.
 if(rig.bolt>0){g.fillStyle='#3b3d36';g.strokeStyle='#bbb3a0';g.lineWidth=2;g.beginPath();g.roundRect(805,637+rig.bolt*.8,13,30,3);g.fill();g.stroke();}
}
function draw(g,img,lay,flash){
 if(!img||!lay?.visible)return;
 g.save();g.translate(lay.x,lay.y);g.rotate(lay.angle);
 if(lay.rig?.active&&lay.rig.t>0){g.save();g.scale(lay.scale/SIZE,lay.scale/SIZE);g.translate(-ART.muzzle.x*SIZE,-ART.muzzle.y*SIZE);drawReload(g,img,lay.rig);g.restore();}
 else g.drawImage(img,-ART.muzzle.x*lay.scale,-ART.muzzle.y*lay.scale,lay.scale,lay.scale);
 // Retain the previous last-shot flash gate, without using it to hide the gun.
 const flashLower=lay.rig?.active?ease(lay.rig.t/.18)*(1-ease((lay.rig.t-.80)/.20))*650:0;
 if(flash&&lay.lower+flashLower<2){const grad=g.createRadialGradient(0,0,1,0,0,25);grad.addColorStop(0,'#fff9e8f0');grad.addColorStop(.25,'#ffdfa3bb');grad.addColorStop(1,'#ffbd5b00');g.fillStyle=grad;g.beginPath();g.ellipse(0,0,24,18,-.35,0,Math.PI*2);g.fill();}g.restore();
}
// Compatibility diagnostic: reload no longer lowers the whole image.
function reloadLower(){return 0;}
const api={ART,muzzle,reloadLower,reloadRig,layout,draw};if(typeof module==='object'&&module.exports)module.exports=api;else root.RelayForeground=api;
})(typeof globalThis!=='undefined'?globalThis:this);
