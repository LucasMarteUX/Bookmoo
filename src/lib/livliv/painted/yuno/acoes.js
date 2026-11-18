// Explicit user actions compose over the gesture response, independent of idle.
const ease=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t)};
export function configurarAcoes(player){
 const originalAct=player.act.bind(player),originalBlink=player.blink.bind(player);
 const moves=[],state={angles:[0,0,0],blink:1,count:0};let blinkTime=Infinity;
 player.act=function(id,strength=1){if(!['nod','shake','tilt'].includes(id))return originalAct(id,strength);moves.push({id,t:0,strength:Math.max(0,Math.min(1,strength))});state.count++};
 player.blink=function(){blinkTime=0;state.count++};
 return {state,update(dt){
  state.angles=[0,0,0];
  for(const a of moves){a.t+=dt;const d=a.id==='tilt'?1.5:1.0,t=a.t/d,e=ease(a.t/.09)*(1-ease((a.t-d+.18)/.18)),k=a.strength*e;
   if(a.id==='nod')state.angles[1]+=-23*Math.sin(Math.PI*Math.min(1,t)*2)*k;
   if(a.id==='shake')state.angles[0]+=23*Math.sin(Math.PI*Math.min(1,t)*4)*k;
   if(a.id==='tilt')state.angles[2]+=24*k;
  }
  for(let i=moves.length-1;i>=0;i--)if(moves[i].t>=(moves[i].id==='tilt'?1.5:1))moves.splice(i,1);
  blinkTime+=dt;state.blink=blinkTime<.065?1-ease(blinkTime/.065):blinkTime<.11?0:blinkTime<.24?ease((blinkTime-.11)/.13):1;
  return state;
 },dispose(){player.act=originalAct;player.blink=originalBlink}};
}
