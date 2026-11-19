// Upoonly: corresponding lip/cavity landmarks, not a crossfade of unregistered mouths.
const OUT=[
 [[130,24],[106,36],[74,42],[44,36],[20,29],[44,23],[74,22],[106,20]],
 [[125,30],[104,47],[75,58],[46,48],[27,33],[47,26],[75,24],[104,26]],
 [[120,31],[104,53],[75,69],[46,55],[29,34],[46,24],[75,21],[104,24]],
 [[104,34],[94,54],[75,64],[56,54],[44,35],[56,25],[75,17],[94,24]],
 [[125,28],[106,61],[75,76],[43,60],[24,30],[43,18],[75,13],[106,18]]];
const IN=[
 [[127,25],[105,31],[74,33],[44,31],[22,29],[44,28],[74,30],[105,27]],
 [[123,31],[103,37],[75,40],[46,37],[29,33],[46,32],[75,32],[103,32]],
 [[118,32],[102,44],[75,52],[46,44],[31,34],[46,32],[75,33],[102,32]],
 [[87,36],[84,40],[75,44],[67,40],[63,36],[67,33],[75,32],[84,33]],
 [[123,29],[104,49],[75,59],[44,48],[26,30],[44,28],[75,31],[104,29]]];
const BORDER=[[151,18],[151,84],[75,84],[0,84],[0,36],[0,0],[75,0],[151,0]];
const POINTS=OUT.map((o,i)=>[...BORDER,...o,...IN[i],[(IN[i][2][0]+IN[i][6][0])/2,(IN[i][2][1]+IN[i][6][1])/2]]);
const REACTION_REST={
 sad:{out:[[120,39],[100,49],[75,52],[45,48],[29,41],[45,29],[75,24],[100,29]],inside:[[118,39],[100,40],[75,40],[45,41],[31,40.5],[45,38],[75,36],[100,37]]},
 angry:{out:[[122,34],[101,44],[75,48],[45,44],[27,34],[45,26],[75,24],[101,26]],inside:[[120,34],[100,36],[75,37],[45,36],[29,34],[45,32],[75,32],[100,32]]}
};
function restPoints(reaction,kind){const r=REACTION_REST[reaction];return r?[...BORDER,...r.out,...r.inside,[(r.inside[2][0]+r.inside[6][0])/2,(r.inside[2][1]+r.inside[6][1])/2]]:POINTS[kind].map(p=>[...p])}
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
import {assetUrl} from '../asset_url.js';
export async function configurarBocaNatural(puppet,base){
 if(!base)throw new Error('base do modelo ausente');
 const mouth=puppet.byId.get('mouth'),images=await Promise.all(mouth.def.frames.map(path=>new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=assetUrl(path,base)})));
 const points=POINTS.map(a=>a.map(p=>[...p]));
 const canvas=document.createElement('canvas');canvas.width=151;canvas.height=84;const ctx=canvas.getContext('2d');
 const work=document.createElement('canvas');work.width=151;work.height=84;const wc=work.getContext('2d');
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
   ctx.clearRect(0,0,151,84);ctx.globalCompositeOperation='lighter';
   const dst=points[0].map((_,i)=>[0,0]);for(let f=0;f<5;f++)for(let i=0;i<dst.length;i++){const q=f===0?points[0][i].map((v,k)=>v*(1-state.blinkSmile)+POINTS[0][i][k]*state.blinkSmile):points[f][i];dst[i][0]+=q[0]*weights[f];dst[i][1]+=q[1]*weights[f]}
   for(const i of [8,12,16,20])dst[i][1]-=state.blinkSmile*.9;
   for(let f=0;f<5;f++)if(weights[f]>.0001){wc.clearRect(0,0,151,84);wc.globalCompositeOperation='source-over';warp(wc,images[f],points[f],dst,1);ctx.globalAlpha=weights[f]*(f===0&&blinkSmileImage?1-state.blinkSmile:1);ctx.drawImage(work,0,0);if(f===0&&blinkSmileImage&&state.blinkSmile>0){wc.clearRect(0,0,151,84);warp(wc,blinkSmileImage,POINTS[0],dst,1);ctx.globalAlpha=weights[f]*state.blinkSmile;ctx.drawImage(work,0,0)}}
   ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
   gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,canvas);state.lastKey=key;state.uploads++;state.landmarks=dst;
  }
  // The existing mesh takes the jaw field; no discrete per-frame squeeze.
  return originalDraw(layer,tex,alpha,undefined,cut);
 };
 return {state,canvas,setBlinkSmile(image,amount){blinkSmileImage=image;state.blinkSmile=amount},setRestFrame(image,kind=0,reaction='neutro'){images[0]=image;points[0]=restPoints(reaction,kind);state.restReaction=reaction;state.lastKey=''},setEnabled(value){state.enabled=value;state.lastKey=''},dispose(){puppet.stepMouth=originalStep;puppet.drawLayer=originalDraw;gl.deleteTexture(tex)}};
}
