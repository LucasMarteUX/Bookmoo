// One response per gesture: enter, hold briefly, return, remain centered.
// Speech amplitude and elapsed speaking time never trigger another response.
const poses={neutro:[0,0,0],enfase:[-2.3,.7,20],explicativo:[2.1,-.5,24],abertura:[-1.7,.4,16],reflexao:[2.5,-.9,-14],conclusao:[-1.8,.5,18]};
const ease=t=>t*t*t*(10+t*(-15+6*t));
export function criarRespostaCabeca(){
 const state={gesture:'neutro',phase:'center',elapsed:0,duration:0,head:[0,0,0],from:[0,0,0],to:[0,0,0],responses:0};
 function transition(phase,to,duration){state.phase=phase;state.elapsed=0;state.duration=duration;state.from=[...state.head];state.to=[...to]}
 return {state,update(gesture,dt){
  if(gesture!==state.gesture){state.gesture=gesture;if(gesture==='neutro')transition('return',[0,0,0],.55);else{state.responses++;transition('enter',poses[gesture]||poses.neutro,.44)}}
  let remaining=Math.max(0,dt);
  while(remaining>0&&state.phase!=='center'){
   const used=Math.min(remaining,state.duration-state.elapsed);state.elapsed+=used;remaining-=used;
   if(state.phase!=='hold'){const t=ease(Math.min(1,state.elapsed/state.duration));state.head=state.from.map((v,i)=>v+(state.to[i]-v)*t)}
   if(state.elapsed>=state.duration-1e-9){
    if(state.phase==='enter'){state.head=[...state.to];transition('hold',state.head,2.2)}
    else if(state.phase==='hold')transition('return',[0,0,0],.60);
    else{state.head=[0,0,0];state.phase='center';state.elapsed=0;state.duration=0}
   }
  }
  return state.head;
 }};
}
