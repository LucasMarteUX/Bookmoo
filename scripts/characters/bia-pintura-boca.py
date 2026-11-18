# Bia pintada: a pele dentro dos recortes da boca (mouth_f*, reaction_*_mouth) passa a ser a pele da face.
# Antes cada recorte trazia a própria pele, em tom um pouco diferente; ao trocar de reação ou de visema aparecia uma
# "sombra" oval em volta da boca. Lábios e sombras fortes do lábio ficam; só a pele é trocada.
# Uso: python bia-pintura-boca.py <pasta textures original> <pasta textures de saída>
import sys, numpy as np
from PIL import Image, ImageFilter
SRC, OUT = sys.argv[1], sys.argv[2]
mouths=['mouth_f0','mouth_f1','mouth_f2','mouth_f3','mouth_f4','reaction_smile_mouth','reaction_surprised_mouth','reaction_sad_mouth','reaction_angry_mouth','reaction_shy_mouth','reaction_x_wink_mouth']
F=np.asarray(Image.open(f'{SRC}/face.png').convert('RGBA').crop((452,417,609,505))).astype(float)
def ss(a,b,x): t=np.clip((x-a)/(b-a),0,1); return t*t*(3-2*t)
for m in mouths:
  M=np.asarray(Image.open(f'{SRC}/{m}.png').convert('RGBA')).astype(float)
  diff=np.abs(M[...,:3]-F[...,:3]).max(-1)
  core=Image.fromarray(((diff>28)*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2.2))
  w=np.maximum(np.asarray(core)/255, ss(10,34,diff))
  M[...,:3]=F[...,:3]*(1-w[...,None])+M[...,:3]*w[...,None]
  Image.fromarray(M.round().clip(0,255).astype(np.uint8),'RGBA').save(f'{OUT}/{m}.png')
