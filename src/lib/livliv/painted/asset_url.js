// Upoonly: resolve um arquivo do rig na pasta do modelo e repete a versão (?v=) da base, para o cache seguir o ASSET_REV.
export function assetUrl(path,base){const u=new URL(path,base);u.search=new URL(base).search;return u.href}
