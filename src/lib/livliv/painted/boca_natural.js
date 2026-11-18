import {assetUrl} from './asset_url.js';
// Bookmoo: corresponding lip/cavity landmarks, not a crossfade of unregistered mouths.
const OUT=[
 [[125,19],[102,43],[75,51],[45,44],[20,30],[45,21],[75,20],[102,16]],
 [[117,25],[103,50],[75,61],[45,50],[27,34],[45,23],[75,19],[102,21]],
 [[119,27],[104,56],[75,70],[45,57],[24,32],[45,19],[75,13],[102,18]],
 [[119,33],[102,53],[78,62],[59,53],[49,39],[60,26],[78,20],[102,26]],
 [[128,22],[106,54],[75,70],[44,52],[20,29],[44,18],[75,12],[105,17]]];
const IN=[
 [[123,20],[101,31],[75,34],[45,33],[22,30],[45,30],[75,32],[101,25]],
 [[115,26],[101,38],[75,44],[45,39],[29,34],[45,32],[75,31],[101,28]],
 [[117,28],[101,48],[75,56],[45,47],[26,32],[45,28],[75,27],[101,27]],
 [[96,35],[92,41],[81,45],[73,42],[68,38],[72,34],[80,33],[89,33]],
 [[126,23],[104,47],[75,56],[44,44],[22,29],[44,25],[75,26],[105,23]]];
const BORDER=[[157,16],[157,88],[78,88],[0,88],[0,35],[0,0],[78,0],[157,0]];
const POINTS=OUT.map((o,i)=>[...BORDER,...o,...IN[i],[(IN[i][2][0]+IN[i][6][0])/2,(IN[i][2][1]+IN[i][6][1])/2]]);
const TRIS=[];for(let i=0;i<8;i++){let j=(i+1)%8;TRIS.push([i,j,8+i],[j,8+j,8+i],[8+i,8+j,16+i],[8+j,16+j,16+i],[16+i,16+j,24])}
function warp(ctx,img,src,dst,alpha){
 ctx.globalAlpha=alpha;
 for(const ids of TRIS){const s=ids.map(i=>src[i]),d=ids.map(i=>dst[i]);
 const x1=s[1][0]-s[0][0],y1=s[1][1]-s[0][1],x2=s[2][0]-s[0][0],y2=s[2][1]-s[0][1],det=x1*y2-x2*y1;if(Math.abs(det)<.01)continue;
 const u1=d[1][0]-d[0][0],v1=d[1][1]-d[0][1],u2=d[2][0]-d[0][0],v2=d[2][1]-d[0][1];
 const a=(u1*y2-u2*y1)/det,c=(u2*x1-u1*x2)/det,b=(v1*y2-v2*y1)/det,e=(v2*x1-v1*x2)/det;
 const cx=(d[0][0]+d[1][0]+d[2][0])/3,cy=(d[0][1]+d[1][1]+d[2][1])/3;const clip=d.map(([x,y])=>{const l=Math.hypot(x-cx,y-cy)||1;return [x+(x-cx)/l*.6,y+(y-cy)/l*.6]});ctx.save();ctx.beginPath();ctx.moveTo(...clip[0]);ctx.lineTo(...clip[1]);ctx.lineTo(...clip[2]);ctx.closePath();ctx.clip();ctx.transform(a,b,c,e,d[0][0]-a*s[0][0]-c*s[0][1],d[0][1]-b*s[0][0]-e*s[0][1]);ctx.drawImage(img,0,0);ctx.restore();
 }
}
export async function configurarBocaNatural(puppet,base){
 if(!base)throw new Error('base do modelo ausente');
 const mouth=puppet.byId.get('mouth'),images=await Promise.all(mouth.def.frames.map(path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=assetUrl(path,base)})));
 const points=POINTS.map(a=>a.map(p=>[...p]));
 const canvas=document.createElement('canvas');canvas.width=157;canvas.height=88;const ctx=canvas.getContext('2d');
 const work=document.createElement('canvas');work.width=157;work.height=88;const wc=work.getContext('2d');
 const gl=puppet.gl,tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
 let blinkSmileImage=null;
 const state={blinkSmile:0,enabled:true,open:0,vowel:0,weights:[1,0,0,0,0],uploads:0,revision:0,lastKey:'',landmarks:points[0]};
 const originalStep=puppet.stepMouth.bind(puppet),originalDraw=puppet.drawLayer.bind(puppet);
 puppet.stepMouth=function(dt){
  originalStep(dt);if(!state.enabled)return;
  const k=1-Math.exp(-Math.min(dt,.05)/.052),v=1-Math.exp(-Math.min(dt,.05)/.085);
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
   ctx.clearRect(0,0,157,88);ctx.globalCompositeOperation='lighter';
   const dst=points[0].map((_,i)=>[0,0]);for(let f=0;f<5;f++)for(let i=0;i<dst.length;i++){dst[i][0]+=points[f][i][0]*weights[f];dst[i][1]+=points[f][i][1]*weights[f]}
   for(const i of [8,12,16,20])dst[i][1]-=state.blinkSmile*.9;
   for(let f=0;f<5;f++)if(weights[f]>.0001){wc.clearRect(0,0,157,88);wc.globalCompositeOperation='source-over';warp(wc,images[f],points[f],dst,1);ctx.globalAlpha=weights[f]*(f===0&&blinkSmileImage?1-state.blinkSmile:1);ctx.drawImage(work,0,0);if(f===0&&blinkSmileImage&&state.blinkSmile>0){wc.clearRect(0,0,157,88);warp(wc,blinkSmileImage,POINTS[0],dst,1);ctx.globalAlpha=weights[f]*state.blinkSmile;ctx.drawImage(work,0,0)}}
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
   gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);state.lastKey=key;state.uploads++;state.landmarks=dst;
  }
  // The existing mesh takes the jaw field; no discrete per-frame squeeze.
  return originalDraw(layer,tex,alpha,undefined,cut);
 };
 return {state,canvas,setBlinkSmile(image,amount){blinkSmileImage=image;state.blinkSmile=amount},setRestFrame(image,kind=0){images[0]=image;points[0]=POINTS[kind].map(p=>[...p]);state.lastKey=''},setEnabled(value){state.enabled=value;state.lastKey=''},dispose(){puppet.stepMouth=originalStep;puppet.drawLayer=originalDraw;gl.deleteTexture(tex)}};
}
