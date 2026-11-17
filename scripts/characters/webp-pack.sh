#!/bin/sh
# Pacote WebP dos personagens: as MESMAS texturas, em resolução total e sem perda (lossless, -exact preserva até a cor por
# baixo das áreas transparentes). Só fica mais leve para baixar; o desenho é idêntico pixel a pixel.
# Gera public/characters/bookmoo/<pasta>/web/{model.json,textures/*.webp} a partir do rig usado no app
# (model.app.json quando existe, senão model.json). Rode de novo sempre que um rig mudar.
set -e
cd "$(dirname "$0")/../../public/characters/bookmoo"
for dir in mulher homem yuno yuri; do
  src=model.json
  [ -f "$dir/model.app.json" ] && src=model.app.json
  rm -rf "$dir/web" && mkdir -p "$dir/web/textures"
  sed -E 's#"textures/([^"]+)\.png"#"textures/\1.webp"#g' "$dir/$src" > "$dir/web/model.json"
  for f in "$dir"/textures/*.png; do
    b=$(basename "$f" .png)
    cwebp -quiet -lossless -exact -z 9 "$f" -o "$dir/web/textures/$b.webp"
  done
  echo "$dir: png $(du -sh "$dir/textures" | cut -f1) -> webp $(du -sh "$dir/web/textures" | cut -f1)"
done
