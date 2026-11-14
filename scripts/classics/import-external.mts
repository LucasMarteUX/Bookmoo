// Importa capas e banners criados fora (ChatGPT): converte, grava como cover-art/banner e deixa o resto para covers.mts / collections-seed.mts.
//   npx tsx scripts/classics/import-external.mts
import { copyFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import sharp from 'sharp'
import { ROOT } from './lib.mts'
const BOOKS: Record<string, number> = {
  'A Caminho da Cidade Esmeralda': 107, 'A Estrada Dourada para Oz': 106, 'A Garota de Retalhos de Oz': 108, 'A Ilha Misteriosa_ Aventura Dourada': 151, 'A Magia de Oz Enfeitiçada': 114,
  'A Mansão Sob a Lua Sombria': 101, 'A Narrativa de Arthur Gordon Pym': 140, 'A Princesa Perdida de Oz_ Mistério no Palácio': 112, 'A Volta ao Mundo em 80 Dias': 150,
  'Alimentos dos Deuses_ Aldeia dos Gigantes': 104, 'Anne na Ilha_ Outono e Mar': 116, 'As Extraordinárias Aventuras de Arsène Lupin': 145, 'À Procura dos Náufragos': 153,
  'Capa Pulp de Xadrez em Marte': 125, 'Capa de Aventura em Pellucidar': 133, 'Contos sombrios de Edgar Allan Poe': 139, 'Da Terra à Lua_ O Disparo Celestial': 152,
  'Deuses de Marte_ O Templo Dourado': 122, 'Dorothy e o Mágico rumo à Cidade Esmeralda': 105, 'Duelo em Paris_ Lupin versus Sholmes': 146, 'Ficção Cósmica sobre o Mar Sombrio': 142,
  'Glinda de Oz_ Magia em Cristal_11zon': 115, 'Guerreiro de Marte ao Pôr do Sol': 127, 'Ilha do Doutor Moreau em Engrenagens、】【': 103, 'Jardim de Sonhos à Beira-Mar': 118,
  'Jornada ao Centro da Terra em Cores Clássicas': 148, 'Mestre Mental de Marte_11zon': 126, 'Nas Montanhas da Loucura_ Expedição Polar': 143, 'No Núcleo da Terra_ Aventura Perdida': 132,
  'O Caso de Charles Dexter Ward_11zon': 144, 'O Homem de Lata de Oz em Aventura_11zon': 113, 'O Mistério da Agulha Oca': 147, 'O Rei de Amarelo_ Máscara Sombria': 102,
  'Poesia Gótica à Luz de Velas': 141, 'Rilla de Ingleside ao Entardecer_11zon': 121, 'Rinkitink em Oz_ Aventura Fantástica': 111, 'Senhor da Guerra de Marte_11zon': 123,
  'Tanar de Pellucidar_ Jornada Perdida_11zon': 134, 'Tarzan no Núcleo da Terra': 135, 'Thuvia e a Fera Branca de Marte_11zon': 124, 'Tik-Tok e a Cidade de Oz_11zon': 109, 'Vale Arco-Íris em Aquarela': 120,
}
const BANNERS: Record<string, string> = {
  'Caminho de Oz até a Cidade Esmeralda': 'wonderful-world-of-oz', 'Castelo Gótico sob a Lua de Sangue': 'gothic-horror-classics', 'Cena steampunk de Júlio Verne': 'jules-verne',
  'Detetive à Luz dos Lampiões Londrinos': 'sherlock-holmes', 'Estudo Gótico de Poe e o Corvo': 'edgar-allan-poe', 'Exploradores no Vale Perdido_11zon': 'pellucidar',
  'Farol Diante da Cidade Cósmica': 'lovecraft', 'Garota Ruiva no Campo Dourado_11zon': 'anne-of-green-gables', 'Guerreiro sob o planeta vermelho_11zon': 'barsoom',
  'Ladrão Elegante sob a Lua de Paris': 'arsene-lupin', 'Máquina do Tempo sob a Lua Alienígena': 'h-g-wells-science-fiction',
}
const SRC_B = '/Users/lucasmarte/Downloads/Livros-comprimidos', SRC_N = '/Users/lucasmarte/Downloads/Banner-comprimido'
const epubs = join(ROOT, 'content', 'epubs'); const dirs = readdirSync(epubs)
let ok = 0
for (const [name, n] of Object.entries(BOOKS)) {
  const file = join(SRC_B, name + '.webp'); const d = dirs.find(x => x.startsWith(`${String(n).padStart(2, '0')}-`))
  if (!existsSync(file) || !d) { console.log('✗ faltando', name, n); continue }
  await sharp(file).resize(1024, 1536, { fit: 'cover' }).jpeg({ quality: 93 }).toFile(join(epubs, d, 'cover-art.jpg')); ok++
}
console.log('capas convertidas:', ok)
let okb = 0
for (const [name, slug] of Object.entries(BANNERS)) {
  const file = join(SRC_N, name + '.webp'); const dir = join(ROOT, 'content', 'collections', slug); mkdirSync(dir, { recursive: true })
  if (!existsSync(file)) { console.log('✗ banner faltando', name); continue }
  const out = join(dir, 'banner.webp')
  if (existsSync(out) && !existsSync(join(dir, 'banner-anterior.webp'))) copyFileSync(out, join(dir, 'banner-anterior.webp'))
  await sharp(file).resize(1440, 600, { fit: 'cover', position: 'centre' }).webp({ quality: 86 }).toFile(out); okb++
}
console.log('banners convertidos:', okb)
