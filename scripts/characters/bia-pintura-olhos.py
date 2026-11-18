# Bia pintada: cílios/vincos pintados na face de cada reação passam para a camada do olho aberto (somem na piscada).
# Uso: python bia-pintura-olhos.py <textures de saída> <textures originais da entrega>
import sys, json, numpy as np
from PIL import Image
from scipy import ndimage as nd
T=sys.argv[1]; SRC=sys.argv[2]
m=json.load(open(T+'/../model.json')); L={l['id']:l for l in m['layers']}
N=np.asarray(Image.open(SRC+'/face.png').convert('RGBA')).astype(float)
lum=lambda A:A[...,:3].mean(-1)
for r in ['smile','surprised','sad','angry','shy','x_wink']:
  F=np.asarray(Image.open(f'{SRC}/reaction_{r}_face.png').convert('RGBA')).astype(float)
  out=F.copy(); report=[]
  for side in 'LR':
    eyefile=f'reaction_{r}_eye_{side}.png'
    E_=Image.open(f'{SRC}/{eyefile}').convert('RGBA')
    l=L['eye_'+side]; x,y,w,h=l['x'],l['y'],l['w'],l['h']
    lid=np.zeros(F.shape[:2]); lid[y:y+h,x:x+w]=np.asarray(Image.open(f'{T}/reaction_{r}_lid_{side}.png').convert('RGBA'))[...,3]/255
    zone=nd.binary_dilation(lid>0.02,iterations=3)
    bbox=np.zeros_like(zone); bbox[y+1:y+h-1,x+1:x+w-1]=True
    pad=30; box=np.zeros_like(zone); box[y-pad:y+h+pad,x-pad:x+w+pad]=True
    dark=((lum(N)-lum(F))>18)&box
    lab,n=nd.label(dark,structure=np.ones((3,3)))
    lash=np.zeros_like(dark); brow=np.zeros_like(dark)
    for i in range(1,n+1):
      c=lab==i; frac=(c&zone).sum()/c.sum()
      (lash if frac>0.6 else brow)[...]|=c
    if r=='angry':
      # a sobrancelha brava encosta na pálpebra: só conta como cílio o escuro colado à abertura do olho (máscara)
      mk=np.zeros(F.shape[:2]); mk[y:y+h,x:x+w]=np.asarray(Image.open(f'{T}/reaction_{r}_mask_{side}.png').convert('RGBA'))[...,3]/255
      near=nd.distance_transform_edt(mk<0.5)<=9
      lash=dark&zone&near; brow=dark&~lash
    keep=nd.binary_dilation(brow,iterations=3)
    wmask=((zone if r!='angry' else nd.binary_dilation(lash,iterations=2))|nd.binary_dilation(lash,iterations=2))&~keep&bbox
    wt=nd.gaussian_filter(wmask.astype(float),1.2)*(~keep)*bbox
    out[...,:3]=out[...,:3]*(1-wt[...,None])+N[...,:3]*wt[...,None]
    # o que saiu da face (cílios e vincos da reação) passa para a camada do olho aberto: some junto com ela na piscada
    patch=np.zeros((h,w,4)); patch[...,:3]=F[y:y+h,x:x+w,:3]; patch[...,3]=wt[y:y+h,x:x+w]*255
    P=Image.fromarray(patch.round().clip(0,255).astype(np.uint8),'RGBA'); P.alpha_composite(E_)
    P.save(f'{T}/{eyefile}')
    report.append((side,int(lash.sum())))
  Image.fromarray(out.round().clip(0,255).astype(np.uint8),'RGBA').save(f'{T}/reaction_{r}_face.png')
  print(r,report)
