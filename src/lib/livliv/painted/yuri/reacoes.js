// Atomic texture variants on the same meshes: one brow pair, one eye mask per side.
const ids=['neutro','smile','surprised','sad','angry','shy','x_wink'];
import {assetUrl} from '../asset_url.js';
export async function configurarReacoes(player,boca,base){
 if(!base)throw new Error('base do modelo ausente');
 const p=player.puppet,face=p.byId.get('face');if(!face?.frames?.length||!p.byId.has('reaction_mouth_bank'))return {state:{active:'neutro'},dispose(){}};
 const mouthLayer=p.byId.get('mouth'),restBank=p.byId.get('reaction_mouth_bank'),neutralMouth=mouthLayer.frames[0];
 const files=restBank.def.frames;
 const mouths=await Promise.all(files.map(path=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=()=>reject(new Error('Boca de reação não carregou: '+path));i.src=assetUrl(path,base)})));
 const original=p.deform.bind(p),originalRender=p.render.bind(p),state={active:null,switches:0,blinkSmile:0,blinkSmileTarget:0,lastTime:p.time};
 // Bookmoo: piscadinha em pulso rápido (~0,38 s) só no olho esquerdo, depois volta ao neutro; o direito fica aberto.
 const WINK=.38;state.winkAt=null;state.surprise=0;
 const winkClosed=()=>{if(state.winkAt===null)return 0;const t=p.time-state.winkAt;if(t<0||t>WINK)return 0;const s=x=>x*x*(3-2*x);return t<.1?s(t/.1):t<.22?1:1-s((t-.22)/.16)};
 state.winkClosed=winkClosed;
 function select(){
  const wantWink=(p.expr.x_wink||0)>.05;if(!wantWink)state.winkAt=null;else if(state.winkAt===null)state.winkAt=p.time;
  const winkLive=wantWink&&p.time-state.winkAt<=WINK;
  let active='neutro',weight=.05;for(const id of ids.slice(1)){if(id==='x_wink'&&!winkLive)continue;const w=id==='smile'?p.smileShown:(p.expr[id]||0);if(w>weight){weight=w;active=id}}
  if(active===state.active)return;state.active=active;state.switches++;const i=ids.indexOf(active);
  // Bookmoo: na piscadinha o rosto fica o neutro (o rosto x_wink é pintado para o arco fechado dele; a pálpebra da piscada
  // ficava como uma oval maior, fora do rosto). A boca de canto da piscadinha continua.
  face.tex=face.frames[active==='x_wink'?0:i];
  for(const side of ['L','R']){
   // Bookmoo: feliz e piscadinha usam olho/pálpebra do neutro (o arco fechado pintado deles fica mais alto e com outro formato
   // que a pálpebra da piscada: o olho fechado pulava de lugar). O fechamento é pela pálpebra, igual a toda piscada.
   const ei=active==='smile'||active==='x_wink'?0:i;const eye=p.byId.get('eye_'+side),lid=p.byId.get('eye_'+side+'_closed');eye.tex=eye.frames[ei];eye.mask=p.byId.get('reaction_mask_bank_'+side).frames[ei];lid.tex=lid.frames[ei];
   p.hidden.delete('iris_'+side);
  }
  mouthLayer.frames[0]=restBank.frames[i];boca.setRestFrame(mouths[i],active==='surprised'?3:0,active);
 }
 function withClosedEyes(fn){const saved=[p.params.eyeLOpen,p.params.eyeROpen];p.params.eyeLOpen=Math.min(p.params.eyeLOpen,p.bookmooBlink??1);p.params.eyeROpen=Math.min(p.params.eyeROpen,p.bookmooBlink??1);if(state.active==='x_wink'){const c=winkClosed();p.params.eyeLOpen=1-c;p.params.eyeROpen=1;if(c>.9)p.hidden.add('iris_L');else p.hidden.delete('iris_L')}try{return fn()}finally{[p.params.eyeLOpen,p.params.eyeROpen]=saved}}
 p.deform=function(){
  select();const dt=Math.max(0,Math.min(.05,p.time-state.lastTime));state.lastTime=p.time;
  state.blinkSmileTarget=Math.min(p.params.eyeLOpen,p.params.eyeROpen,p.bookmooBlink??1)<.65?1:0;
  const k=1-Math.exp(-dt/(state.blinkSmileTarget?.045:.18));state.blinkSmile+=(state.blinkSmileTarget-state.blinkSmile)*k;
  boca.setBlinkSmile(mouths[1],0)/* Bookmoo: sem sorriso na piscada (a troca de contorno deixava lábio duplicado ao voltar) */;
  const out=withClosedEyes(original);
  // Bookmoo: na surpresa (boca em bico) o queixo estica um pouco para baixo pelo campo local do queixo.
  state.surprise+=((state.active==='surprised'?1:0)-state.surprise)*(1-Math.exp(-dt/.12));
  if(state.surprise>.01){const dy=4*state.surprise;for(const L of p.layers){if(!L.wJaw||!L.out)continue;let any=false;for(let i=0;i<L.wJaw.length;i++){const w=L.wJaw[i];if(w>0){L.out[2*i+1]+=dy*w;any=true}}if(any)L.uploaded=false}}
  return out
 };p.render=function(){return withClosedEyes(originalRender)};select();
 return {state,dispose(){p.deform=original;p.render=originalRender;mouthLayer.frames[0]=neutralMouth;p.hidden.delete('iris_L');p.hidden.delete('iris_R')}};
}
