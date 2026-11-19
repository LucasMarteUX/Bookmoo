import {assetUrl} from './asset_url.js';
// Atomic texture variants on the same meshes: one brow pair, one eye mask per side.
const ids=['neutro','smile','surprised','sad','angry','shy','x_wink'];
export async function configurarReacoes(player,boca,base){
 if(!base)throw new Error('base do modelo ausente');
 const p=player.puppet,face=p.byId.get('face');if(!face?.frames?.length||!p.byId.has('reaction_mouth_bank'))return {state:{active:'neutro'},dispose(){}};
 const mouthLayer=p.byId.get('mouth'),restBank=p.byId.get('reaction_mouth_bank'),neutralMouth=mouthLayer.frames[0];
 const files=restBank.def.frames;
 const mouths=await Promise.all(files.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Boca de reação não carregou: '+path));i.src=assetUrl(path,base)})));
 const original=p.deform.bind(p),originalRender=p.render.bind(p),state={active:null,switches:0,blinkSmile:0,blinkSmileTarget:0,lastTime:p.time};
 // Upoonly: a piscadinha é uma pequena atuação (~1 s): a bochecha e a cabeça antecipam (0,06 s), o olho fecha rápido
 // (0,07 s), segura ~0,67 s e abre em 0,16 s; o outro olho aperta um pouco, como num sorriso (cabeça/bochecha em index.ts). Fechar/abrir devagar deixava à mostra o meio do caminho do player (olho achatado + pálpebra
 // meio transparente: uma oval maior, "fantasma"). O outro olho fica igual ao neutro.
 const WINK=.96;state.winkAt=null;state.surprise=0;
 const winkClosed=()=>{if(state.winkAt===null)return 0;const t=p.time-state.winkAt;if(t<0||t>WINK)return 0;const s=x=>x*x*(3-2*x);return t<.06?0:t<.13?s((t-.06)/.07):t<.8?1:1-s((t-.8)/.16)};
 state.winkClosed=winkClosed;
 function select(){
  const wantWink=(p.expr.x_wink||0)>.05;if(!wantWink)state.winkAt=null;else if(state.winkAt===null)state.winkAt=p.time;
  const winkLive=wantWink&&p.time-state.winkAt<=WINK;
  let active='neutro',weight=.05;for(const id of ids.slice(1)){if(id==='x_wink'&&!winkLive)continue;const w=id==='smile'?p.smileShown:(p.expr[id]||0);if(w>weight){weight=w;active=id}}
  if(active===state.active)return;state.active=active;state.switches++;const i=ids.indexOf(active);
  // Upoonly: na piscadinha rosto, olhos e pálpebras ficam os do neutro (os pintados da piscadinha têm o olho fechado no
  // rosto e o outro olho diferente: o olho que pisca parecia maior e o outro mudava). Só a boca de canto é a da piscadinha.
  const fi=active==='x_wink'?0:i;face.tex=face.frames[fi];
  for(const side of ['L','R']){
   const eye=p.byId.get('eye_'+side),lid=p.byId.get('eye_'+side+'_closed');eye.tex=eye.frames[fi];eye.mask=p.byId.get('reaction_mask_bank_'+side).frames[fi];lid.tex=lid.frames[fi];
   const closed=active==='smile';if(closed)p.hidden.add('iris_'+side);else p.hidden.delete('iris_'+side);
  }
  mouthLayer.frames[0]=restBank.frames[i];boca.setRestFrame(mouths[i],active==='surprised'?3:0);
 }
 function withClosedEyes(fn){const saved=[p.params.eyeLOpen,p.params.eyeROpen];if(state.active==='smile'){p.params.eyeLOpen=0;p.params.eyeROpen=0}
  else if(state.active==='x_wink'){const c=winkClosed();p.params.eyeLOpen=1-c;p.params.eyeROpen=1-.07*Math.min(1,(p.time-state.winkAt)/.15);if(c>.9)p.hidden.add('iris_L');else p.hidden.delete('iris_L')}const eb=[p.params.eyeBallX,p.params.eyeBallY];/* Upoonly: fechando a pálpebra, a íris volta ao centro (com o olhar no canto ela ficava inteira de lado dentro da fenda: o olho fechando parecia escorregar) */{const o=Math.min(p.params.eyeLOpen,p.params.eyeROpen),u=Math.max(0,Math.min(1,(o-.25)/.6)),k=u*u*(3-2*u);p.params.eyeBallX*=k;p.params.eyeBallY*=k}try{return fn()}finally{[p.params.eyeLOpen,p.params.eyeROpen]=saved;[p.params.eyeBallX,p.params.eyeBallY]=eb}}
 p.deform=function(){
  select();const dt=Math.max(0,Math.min(.05,p.time-state.lastTime));state.lastTime=p.time;
  state.blinkSmileTarget=Math.min(p.params.eyeLOpen,p.params.eyeROpen)<.65?1:0;
  const k=1-Math.exp(-dt/(state.blinkSmileTarget?.045:.18));state.blinkSmile+=(state.blinkSmileTarget-state.blinkSmile)*k;
  boca.setBlinkSmile(mouths[1],0)/* Upoonly: sem sorriso na piscada (a boca subia a cada piscada e ficava estranho) */;const out=withClosedEyes(original);
  // Upoonly: na surpresa (boca em bico) só o queixo estica para baixo, pelo mesmo campo local do queixo (pescoço com peso 0).
  state.surprise+=((state.active==='surprised'?1:0)-state.surprise)*(1-Math.exp(-dt/.12));
  if(state.surprise>.01){const dy=5.5*state.surprise;for(const L of p.layers){if(!L.wJaw||!L.out)continue;let any=false;for(let i=0;i<L.wJaw.length;i++){const w=L.wJaw[i];if(w>0){L.out[2*i+1]+=dy*w;any=true}}if(any)L.uploaded=false}}
  return out
 };p.render=function(){return withClosedEyes(originalRender)};select();
 return {state,dispose(){p.deform=original;p.render=originalRender;mouthLayer.frames[0]=neutralMouth;p.hidden.delete('iris_L');p.hidden.delete('iris_R')}};
}
