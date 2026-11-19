import {assetUrl} from '../asset_url.js';
import {configurarBocaNatural} from './boca_natural.js';
import {criarRespostaCabeca} from './resposta_cabeca.js';
import {configurarReacoes} from './reacoes.js';
import {configurarAcoes} from './acoes.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t)};
const gestureNames=['neutro','enfase','explicativo','abertura','reflexao','conclusao'];
const cuff={neutro:[135,1360],enfase:[170,950],explicativo:[180,980],abertura:[160,1210],reflexao:[365,810],conclusao:[350,995]};
const strands=[
 {id:'cacho_frontal',root:[510,180],tip:[485,249],radius:43,w:17,gain:.08},
 {id:'cacho_esquerdo',root:[365,160],tip:[319,282],radius:47,w:15,gain:.10},
 {id:'cacho_direito',root:[665,168],tip:[704,290],radius:47,w:16,gain:.10},
 {id:'ponta_esquerda',root:[351,255],tip:[365,395],radius:33,w:14,gain:.09},
 {id:'ponta_direita',root:[682,254],tip:[658,404],radius:34,w:14,gain:.09}];
const earrings=[]; // Luck has no earrings; never apply Bia's ear fields.
function spring(w,limit){return {x:0,v:0,w,limit}}
function step(s,force,dt){for(let t=0;t<dt;t+=1/120){const h=Math.min(1/120,dt-t);s.v+=(force-s.w*s.w*s.x-1.45*s.w*s.v)*h;s.x+=s.v*h;if(Math.abs(s.x)>s.limit){s.x=clamp(s.x,-s.limit,s.limit);s.v*=.5}}}
function activeGesture(p){let best='neutro',v=.5;for(const name of gestureNames){const w=p.expr['gesto_'+name]||0;if(w>v){best=name;v=w}}return best}
function pointOnSegment(x,y,s){const dx=s.tip[0]-s.root[0],dy=s.tip[1]-s.root[1],t=clamp(((x-s.root[0])*dx+(y-s.root[1])*dy)/(dx*dx+dy*dy),0,1),px=s.root[0]+t*dx,py=s.root[1]+t*dy;return {t,d:Math.hypot(x-px,y-py)}}
export async function configurarMovimentoNatural(player,modelBaseURL){
 if(!modelBaseURL)throw new Error('modelBaseURL ausente');
 const p=player.puppet,boca=await configurarBocaNatural(p,modelBaseURL),reacoes=await configurarReacoes(player,boca,modelBaseURL),originalDeform=p.deform.bind(p);
 const resposta=criarRespostaCabeca(),acoes=configurarAcoes(player);
 const state={enabled:true,headEnabled:true,gesture:'neutro',head:[0,0,0],headPhase:'center',positiveRollGain:1.25,steps:0,maxHair:0,maxCloth:0,maxEarring:0};
 const hair=strands.map(s=>({x:spring(s.w,3.2),y:spring(s.w,1.6)})),ear=earrings.map(s=>spring(s.w,.048));
 const cloth=[spring(15,.9),spring(17,.7),spring(13,.65)];
 // Upoonly: inclinação lenta alternando de lado e balanço do corpo pela malha (base fixa, ombros e cabeça acompanham o mouse).
 let tilt=0,tiltTarget=0,tiltSide=Math.random()<.5?1:-1,tiltClock=2+Math.random()*3,lean=0,leanV=0,breathT=0;
 const BASE_Y=1536,TOP_Y=260;
 // Upoonly: a pálpebra fechada está pintada na linha de baixo do olho; ao piscar ela desce desde os cílios de cima (distância
 // medida nas texturas de cada reação), em vez de aparecer já embaixo e dar a impressão de o olho pular de lugar.
 const LID_DROP={neutro:14,surprised:15,sad:7,angry:13,shy:11,smile:14,x_wink:14};
 const lids=['L','R'].map(sd=>p.byId.get('eye_'+sd+'_closed'));
 let surprise=0,wasSurprised=false;
 let lastTime=p.time,previous=null,velocity=[0,0],accel=[0,0],cuePos=[...cuff.neutro],cueVel=[0,0],cueAccel=[0,0];
 const im=await new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve(i);i.onerror=reject;i.src=assetUrl('textures/reaction_neutro_face.png',modelBaseURL)});
 const c=document.createElement('canvas');c.width=1024;c.height=1536;const ctx=c.getContext('2d',{willReadFrequently:true});ctx.drawImage(im,0,0);const rgba=ctx.getImageData(0,0,1024,1536).data;
 const face=p.byId.get('face');const weights=new Float32Array(face.rest.length/2*strands.length);
 for(let i=0;i<face.rest.length/2;i++){
  const x=face.rest[i*2],y=face.rest[i*2+1],px=clamp(Math.round(x),0,1023),py=clamp(Math.round(y),0,1535),idx=(py*1024+px)*4,r=rgba[idx],g=rgba[idx+1];
  const isHair=rgba[idx+3]>5&&r<210&&g/Math.max(r,1)<.70;
  const nearEar=earrings.some(e=>Math.hypot((x-e.center[0])/e.rx,(y-e.center[1])/e.ry)<1.5);
  if(!isHair||nearEar)continue;
  for(let k=0;k<strands.length;k++){const s=pointOnSegment(x,y,strands[k]);weights[i*strands.length+k]=smooth(.08,.88,s.t)*(1-smooth(.35,1,s.d/strands[k].radius))}
 }
 const hairVertices=[],earVertices=earrings.map(()=>[]),muscles=[],fabric=new Map();
 for(let i=0;i<face.rest.length/2;i++){
  const x=face.rest[i*2],y=face.rest[i*2+1];
  if(strands.some((_,j)=>weights[i*strands.length+j]>.00001))hairVertices.push(i);
  for(let j=0;j<earrings.length;j++){const e=earrings[j],r=Math.hypot((x-e.center[0])/e.rx,(y-e.center[1])/e.ry),w=1-smooth(.68,1.45,r);if(w>0)earVertices[j].push([i,x-e.pivot[0],y-e.pivot[1],w])}
  const muscle=Math.exp(-(((x-516)/90)**2)-((y-450)/30)**2)*smooth(425,439,y)*(1-smooth(480,495,y));if(muscle>.002)muscles.push([i,(x-516)/90*.28*muscle,.22*muscle]);
 }
 for(const L of p.layers){if(L.def.group!=='body'||['gesto_pescoco_comum','gesto_reflexao_mao_frente'].includes(L.def.id))continue;
  const gesture=L.def.id.replace('gesto_',''),centers=gesture==='reflexao'?[[265,1050],[675,1200],[745,1290]]:gesture==='explicativo'?[[182,1080],[800,1050],[745,1290]]:[[220,1050],[800,1050],[745,1290]],vertices=[];
  for(let i=0;i<L.rest.length/2;i++){const x=L.rest[2*i],y=L.rest[2*i+1],w=centers.map(([cx,cy])=>Math.exp(-(((x-cx)/75)**2)-((y-cy)/105)**2));if(w.some(k=>k>.002))vertices.push([i,...w])}fabric.set(L,vertices);
 }
 p.deform=function(){
  const dt=clamp(p.time-lastTime,0,1/20);lastTime=p.time;const gesture=activeGesture(p);state.gesture=gesture;
  const open=boca.state.enabled?boca.state.open:p.params.mouthOpen;
  state.head=[...resposta.update(gesture,dt)];state.headPhase=resposta.state.phase;const action=acoes.update(dt);p.bookmooBlink=action.blink;
  const saved=[p.params.angleX,p.params.angleY,p.params.angleZ,p.params.mouthOpen];
  const originalRoll=p.rig.roll;
  if(state.headEnabled){
   // Idle still blinks and moves the eyes; gesture responses return to a stable center.
   // Upoonly: o olhar do mouse (angleX/Y) passa para a cabeça, como nos outros personagens; o balanço do idle em Z não.
   p.params.angleX=clamp(p.params.angleX,-14,14)+state.head[0];p.params.angleY=clamp(p.params.angleY,-15,10)+state.head[1];
   tiltClock-=dt;if(tiltClock<=0){tiltSide=tiltSide>0?-1:1;tiltTarget=tiltSide*(1.6+Math.random()*1.8);tiltClock=6+Math.random()*6}
   tilt+=(tiltTarget-tilt)*(1-Math.exp(-dt/1.4));state.tilt=tilt;
   // Atuação da fala (LivLivAvatar: pose por frase, acentos, riso) soma à cabeça; falando, a inclinação lenta do idle diminui.
   const spk=p.params.speaking?0.35:1;
   /* Upoonly: teto final do giro depois de somar mouse, gesto, posturas e fala: o rosto pintado é uma imagem só e, acima de
    ~11, a malha dobra na linha do cabelo (a mecha da testa virava uma borda reta, a "testa cortada") */
   p.params.angleX=clamp(p.params.angleX+(p.params.speechYaw||0),-11,11);p.params.angleY=clamp(p.params.angleY+(p.params.speechPitch||0),-14,10);
   p.params.angleZ=clamp(tilt*spk+0.18*p.params.angleX+state.head[2]+(p.params.speechRoll||0),-30,30);
   if(p.params.angleZ>0)p.rig.roll=originalRoll*state.positiveRollGain;
  }
  p.params.angleX=clamp(p.params.angleX+action.angles[0],-30,30);p.params.angleY=clamp(p.params.angleY+action.angles[1],-30,30);p.params.angleZ=clamp(p.params.angleZ+action.angles[2],-30,30);
  if(boca.state.enabled)p.params.mouthOpen=open;
  try{
   originalDeform();
   {const act=reacoes.state.active||'neutro',D=LID_DROP[act]??14,blink=p.bookmooBlink??1;
    for(let k=0;k<2;k++){const L=lids[k];if(!L?.out)continue;
     // piscadinha: o olho que pisca desce a pálpebra igual à piscada normal; o outro fica aberto
     let open=clamp(Math.min(k?p.params.eyeROpen:p.params.eyeLOpen,blink),0,1);if(act==='x_wink')open=k?Math.min(open,.93):1-(reacoes.state.winkClosed?.()??0);
     const dy=-D*open;if(Math.abs(dy)<.01)continue;
     for(let i=1;i<L.out.length;i+=2)L.out[i]+=dy;L.uploaded=false}}
   // Surpresa: o rosto pintado muda (sobrancelhas sobem); o couro cabeludo sobe um pouco junto e as mechas recebem um impulso.
   {const isS=reacoes.state.active==='surprised';if(isS&&!wasSurprised)for(const h of hair)h.y.v-=26;wasSurprised=isS;
    surprise+=((isS?1:0)-surprise)*(1-Math.exp(-dt/.1));state.surprise=surprise;
    if(surprise>.01){for(const i of hairVertices){let w=0;for(let j=0;j<strands.length;j++)w+=weights[i*strands.length+j];const y=face.rest[2*i+1];face.out[2*i+1]-=2.6*surprise*Math.min(1,w+(y<260?.6:0))}face.uploaded=false}}
   // Upoonly: o pescoço é do corpo e não seguia a cabeça (desencaixava na saudação/gestos). A parte de cima dele acompanha o
   // deslocamento da cabeça e o efeito some até a gola.
   {const hp=[0,0];let mx=0;for(const L of p.layers){if(L.def.group!=='body'||!L.out||!p.shown(L))continue;let any=false;
     for(let i=0;i<L.out.length/2;i++){const x=L.rest[2*i],y=L.rest[2*i+1];if(y>600)continue;const w=(1-smooth(505,595,y))*(1-smooth(58,86,Math.abs(x-516)));if(w<=0)continue;/* só a pele do pescoço: a gola (|x-516|>~90 a partir de y 500) fica com o corpo */
      const yy=Math.min(y,505);p.headXform(x,yy,0,p.params,hp);const dx=(hp[0]-x)*w,dy=(hp[1]-yy)*w;L.out[2*i]+=dx;L.out[2*i+1]+=dy;mx=Math.max(mx,Math.hypot(dx,dy));any=true}
     if(any)L.uploaded=false}state.neck=mx}
   // Corpo: cisalhamento suave que cresce da base (parada) até a cabeça, levado pelo olhar/mouse e pela inclinação, com mola.
   breathT+=dt;const leanTarget=(p.params.pointerLean||0)*34+/* mouse: corpo para o lado oposto (LivLivAvatar) */tilt*2.2+Math.sin(breathT*.55)*1.2;
   leanV+=((leanTarget-lean)*28-leanV*9)*dt;lean+=leanV*dt;state.lean=lean;
   if(Math.abs(lean)>.01)for(const L of p.layers){if(!L.out)continue;/* todas as camadas: a pálpebra fechada só aparece no desenho (olhos fechados lá), aqui ela contaria como escondida e ficava para trás */for(let i=0;i<L.out.length/2;i++){const y=L.rest[2*i+1],w=clamp((BASE_Y-y)/(BASE_Y-TOP_Y),0,1.15);L.out[2*i]+=lean*w*w*(3-2*Math.min(1,w))}L.uploaded=false}if(boca.state.enabled&&open>0){for(const [i,dx,dy]of muscles){face.out[2*i]+=open*dx;face.out[2*i+1]+=open*dy}face.uploaded=false}if(!state.enabled||dt===0)return;
   const hp=[0,0];p.headXform(516,307,0,p.params,hp);
   if(!previous)previous=[...hp];
   const k=1-Math.exp(-dt/.07);
   for(let i=0;i<2;i++){
    const v=(hp[i]-previous[i])/dt;const filtered=velocity[i]+(v-velocity[i])*k;accel[i]+=(clamp((filtered-velocity[i])/dt,-2200,2200)-accel[i])*k;velocity[i]=filtered;
    const cv=(cuff[gesture][i]-cuePos[i])/.18;cuePos[i]+=cv*dt;cueAccel[i]+=(clamp((cv-cueVel[i])/dt,-3000,3000)-cueAccel[i])*k;cueVel[i]=cv;
   }
   previous=[...hp];
   // Upoonly: as mechas também sentem o balanço do corpo e um ar leve, para o cabelo não ficar parado.
   for(let i=0;i<strands.length;i++){const air=Math.sin(breathT*(.9+i*.17)+i*1.7)*.35;step(hair[i].x,-accel[0]*strands[i].gain*2.5-leanV*strands[i].gain*30-strands[i].w**2*(clamp(p.params.angleZ*.06,-.5,.5)-air*6),dt);step(hair[i].y,-accel[1]*strands[i].gain*.8+strands[i].w**2*air*2,dt)}
   for(let i=0;i<ear.length;i++)step(ear[i],-accel[0]*.009-ear[i].w**2*p.params.angleZ*.0009,dt);
   step(cloth[0],-cueAccel[1]*.045,dt);step(cloth[1],-cueAccel[0]*.03,dt);step(cloth[2],-cueAccel[1]*.018,dt);
   // Sparse cached fields: no per-frame segmentation, vertex allocation or texture edits.
   for(const i of hairVertices){let dx=0,dy=0;for(let j=0;j<strands.length;j++){const w=weights[i*strands.length+j];dx+=hair[j].x.x*w;dy+=hair[j].y.x*w}face.out[2*i]+=dx;face.out[2*i+1]+=dy}
   for(let j=0;j<earrings.length;j++)for(const [i,vx,vy,w]of earVertices[j]){const a=ear[j].x*w;face.out[2*i]+=vx*(Math.cos(a)-1)-vy*Math.sin(a);face.out[2*i+1]+=vx*Math.sin(a)+vy*(Math.cos(a)-1)}
   face.uploaded=false;
   for(const [L,vertices]of fabric){if(!p.shown(L))continue;for(const [i,a,b,c]of vertices){const d=cloth[0].x*a+cloth[1].x*b+cloth[2].x*c;L.out[2*i]+=d*.45;L.out[2*i+1]+=d}L.uploaded=false}
   state.steps++;state.maxHair=Math.max(state.maxHair,...hair.map(s=>Math.hypot(s.x.x,s.y.x)));state.maxCloth=Math.max(state.maxCloth,...cloth.map(s=>Math.abs(s.x)));state.maxEarring=Math.max(state.maxEarring,...ear.map(s=>Math.abs(s.x)));
  }finally{p.rig.roll=originalRoll;[p.params.angleX,p.params.angleY,p.params.angleZ,p.params.mouthOpen]=saved}
 };
 return {state,boca,reacoes,acoes,anchors:{strands,earrings},getSnapshot(){return {head:[...state.head],hair:hair.map(s=>[s.x.x,s.y.x]),ear:ear.map(s=>s.x),cloth:cloth.map(s=>s.x),mouth:[...boca.state.weights]}},setEnabled(v){state.enabled=v;previous=null;velocity=[0,0];accel=[0,0];for(const pair of hair)for(const s of [pair.x,pair.y])s.x=s.v=0;for(const s of [...ear,...cloth])s.x=s.v=0},dispose(){p.deform=originalDeform;reacoes.dispose();acoes.dispose();boca.dispose()}};
}
