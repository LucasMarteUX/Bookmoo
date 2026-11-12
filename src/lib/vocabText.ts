// Texto salvo das explicações: "inglês\n\nTranslation: português\n\nPronunciation: /ipa/".
// Fora do cartão da palavra mostramos só a parte em inglês (a tradução fica para o olhinho).
export function mainText(value?: string): string {
  return (value ?? '').replace(/\n*\s*(Translation|Tradução|Pronunciation|Pronúncia):.*$/is, '').trim()
}
