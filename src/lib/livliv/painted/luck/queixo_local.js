// Scoped adapter for this painted prototype and LivLiv0.5.1.
// Only the lower face deforms; the neck, hair ends and torso get no jaw displacement.
export function configurarQueixoLocal(player) {
 const p=player.puppet,cfg=p.model['x-bookmoo-jaw-field']??{cx:516,top:440,chin:502,end:528,fullWidth:60,outerWidth:112};
 if(!cfg)throw new Error('Configuração local do queixo ausente');
 const smooth=(a,b,v)=>{const t=Math.min(1,Math.max(0,(v-a)/(b-a)));return t*t*(3-2*t)};
 for(const layer of p.layers){
  const d=layer.def,allowed=d.id==='face'||d.role==='mouth'||d.role==='expr';
  for(let i=0;i<layer.wJaw.length;i++){
   const x=layer.rest[i*2],y=layer.rest[i*2+1];
   layer.wJaw[i]=allowed?(1-smooth(cfg.fullWidth,cfg.outerWidth,Math.abs(x-cfg.cx)))*smooth(cfg.top,cfg.chin,y)*(1-smooth(cfg.chin,cfg.end,y)):0;
  }
 }
 const frames=[...p.frameJaw];
 return {frames,field:cfg,setEnabled(enabled){p.frameJaw=enabled?[...frames]:frames.map(()=>0)}};
}
