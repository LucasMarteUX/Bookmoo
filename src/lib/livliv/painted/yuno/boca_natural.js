// Upoonly: corresponding lip/cavity landmarks, not a crossfade of unregistered mouths.
const IN=[
 [[123,12],[102,25],[76,33],[49,34],[32,29.5],[49,32],[76,31],[102,23]],
 [[108,29],[94,37],[75,41],[56,40],[40,35],[56,31],[75,29],[94,29]],
 [[107,33],[95,44],[75,51],[55,45],[40,36],[55,31],[75,27],[95,29]],
 [[78,37],[75,40],[70,42],[65,40],[62,37],[65,34],[70,33],[75,34]],
 [[111,28],[96,42],[75,50],[54,42],[32,32.5],[54,28],[75,25],[97,26]]];
const BORDER=[[153,37],[153,80],[76,80],[0,80],[0,37],[0,0],[76,0],[153,-20]];
// Keep a consistent envelope around the actual cavity. Constant offsets preserve
// the corner topology while the asymmetrical closed smile becomes an open vowel.
const LIP_PAD=[[6,-5],[3,8],[0,12],[-3,8],[-8,1.5],[-3,-15],[0,-9],[3,-8]];
function mouthPoints(inside){const outside=inside.map((p,i)=>p.map((v,k)=>v+LIP_PAD[i][k]));return [...BORDER,...outside,...inside,[(inside[2][0]+inside[6][0])/2,(inside[2][1]+inside[6][1])/2]]}
const POINTS=IN.map(mouthPoints);
const REACTION_REST={
 smile:{inside:[[124,12],[103,24],[75,31],[45,29],[24,20],[45,27],[75,29],[103,22]]},
 shy:{inside:[[115,20],[98,27],[74,33],[49,34],[33,30],[49,32],[74,31],[98,25]]},
 x_wink:{inside:[[122,13],[102,25],[75,33],[48,33],[29,27],[48,31],[75,31],[102,23]]},
 sad:{inside:[[106,37],[94,37],[75,39],[56,41],[40,42],[56,38],[75,35],[94,34]]},
 angry:{inside:[[100,35],[89,35],[73,36],[53,37],[40,38],[53,34],[73,33],[89,33]]},
 surprised:{inside:[[77,40],[75,44],[70,46],[65,44],[63,40],[65,36],[70,34],[75,36]]}
};
function restPoints(reaction,kind){const r=REACTION_REST[reaction];return r?mouthPoints(r.inside):POINTS[kind].map(p=>[...p])}
const TRIS=[];for(let i=0;i<8;i++){let j=(i+1)%8;if(i===7)TRIS.push([i,j,8+j],[i,8+j,8+i]);else TRIS.push([i,j,8+i],[j,8+j,8+i]);TRIS.push([8+i,8+j,16+i],[8+j,16+j,16+i])}
// A curved closed smile is concave: use a lip strip, never a fan through its centre.
TRIS.push([16,17,23],[17,22,23],[17,18,22],[18,21,22],[18,19,21],[19,20,21]);
function warp(ctx,img,src,dst,alpha){
 ctx.globalAlpha=alpha;
 for(const ids of TRIS){const s=ids.map(i=>src[i]),d=ids.map(i=>dst[i]);
 const x1=s[1][0]-s[0][0],y1=s[1][1]-s[0][1],x2=s[2][0]-s[0][0],y2=s[2][1]-s[0][1],det=x1*y2-x2*y1;if(Math.abs(det)<.01)continue;
 const u1=d[1][0]-d[0][0],v1=d[1][1]-d[0][1],u2=d[2][0]-d[0][0],v2=d[2][1]-d[0][1];
 const a=(u1*y2-u2*y1)/det,c=(u2*x1-u1*x2)/det,b=(v1*y2-v2*y1)/det,e=(v2*x1-v1*x2)/det;
 const cx=(d[0][0]+d[1][0]+d[2][0])/3,cy=(d[0][1]+d[1][1]+d[2][1])/3;const clip=d.map(([x,y])=>{const l=Math.hypot(x-cx,y-cy)||1;return [x+(x-cx)/l*.6,y+(y-cy)/l*.6]});ctx.save();ctx.beginPath();ctx.moveTo(...clip[0]);ctx.lineTo(...clip[1]);ctx.lineTo(...clip[2]);ctx.closePath();ctx.clip();ctx.transform(a,b,c,e,d[0][0]-a*s[0][0]-c*s[0][1],d[0][1]-b*s[0][0]-e*s[0][1]);ctx.drawImage(img,0,0);ctx.restore();
 }
}
import {assetUrl} from '../asset_url.js';
export async function configurarBocaNatural(puppet,base){
 if(!base)throw new Error('base do modelo ausente');
 const mouth=puppet.byId.get('mouth'),images=await Promise.all(mouth.def.frames.map(path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=assetUrl(path,base)})));
 const points=POINTS.map(a=>a.map(p=>[...p]));
 const canvas=document.createElement('canvas');canvas.width=153;canvas.height=80;const ctx=canvas.getContext('2d');
 const work=document.createElement('canvas');work.width=153;work.height=80;const wc=work.getContext('2d');
 const gl=puppet.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 let blinkSmileImage=null;
 const state={blinkSmile:0,enabled:true,open:0,vowel:0,weights:[1,0,0,0,0],uploads:0,revision:0,lastKey:'',landmarks:points[0]};
 const originalStep=puppet.stepMouth.bind(puppet),originalDraw=puppet.drawLayer.bind(puppet);
 puppet.stepMouth=function(dt){
  originalStep(dt);if(!state.enabled)return;
  const response=this.params.mouthOpen<state.open?.075:.065;
  const k=1-Math.exp(-Math.min(dt,.05)/response),v=1-Math.exp(-Math.min(dt,.05)/.085);
  state.open+=(Math.max(0,Math.min(1,this.params.mouthOpen))-state.open)*k;state.vowel+=((this.params.vowel||0)-state.vowel)*v;
  const m=state.open,w=[0,0,0,0,0];if(m<.32){w[0]=1-m/.32;w[1]=m/.32}else{w[1]=1-Math.min(1,(m-.32)/.48);w[2]=1-w[1]}
  const cue=Math.max(0,Math.min(1,(Math.abs(state.vowel)-.22)/.68))*Math.min(1,m/.30),i=state.vowel<0?3:4;
  for(let j=0;j<3;j++)w[j]*=1-cue;w[i]=cue;
  state.weights=w;this.mouthW=[...w];state.revision++;
 };
 puppet.drawLayer=function(layer,texture,alpha,verts,cut){
  if(!state.enabled||layer.def.id!=='mouth')return originalDraw(layer,texture,alpha,verts,cut);
  const weights=state.weights,key=weights.map(w=>Math.round(w*200)).join(',')+':'+Math.round(state.blinkSmile*100);
  if(state.lastKey!==key){
   ctx.clearRect(0,0,153,80);ctx.globalCompositeOperation='lighter';
   const dst=points[0].map((_,i)=>[0,0]);for(let f=0;f<5;f++)for(let i=0;i<dst.length;i++){const q=f===0?points[0][i].map((v,k)=>v*(1-state.blinkSmile)+restPoints('smile',0)[i][k]*state.blinkSmile):points[f][i];dst[i][0]+=q[0]*weights[f];dst[i][1]+=q[1]*weights[f]}
   for(const i of [8,12,16,20])dst[i][1]-=state.blinkSmile*.9;
   for(let f=0;f<5;f++)if(weights[f]>.0001){wc.clearRect(0,0,153,80);wc.globalCompositeOperation='source-over';warp(wc,images[f],points[f],dst,1);ctx.globalAlpha=weights[f]*(f===0&&blinkSmileImage?1-state.blinkSmile:1);ctx.drawImage(work,0,0);if(f===0&&blinkSmileImage&&state.blinkSmile>0){wc.clearRect(0,0,153,80);warp(wc,blinkSmileImage,restPoints('smile',0),dst,1);ctx.globalAlpha=weights[f]*state.blinkSmile;ctx.drawImage(work,0,0)}}
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
   gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);state.lastKey=key;state.uploads++;state.landmarks=dst;
  }
  // The existing mesh takes the jaw field; no discrete per-frame squeeze.
  return originalDraw(layer,tex,alpha,undefined,cut);
 };
 return {state,canvas,setBlinkSmile(image,amount){blinkSmileImage=image;state.blinkSmile=amount},setRestFrame(image,kind=0,reaction='neutro'){images[0]=image;points[0]=restPoints(reaction,kind);state.restReaction=reaction;state.lastKey=''},setEnabled(value){state.enabled=value;state.lastKey=''},dispose(){puppet.stepMouth=originalStep;puppet.drawLayer=originalDraw;gl.deleteTexture(tex)}};
}
