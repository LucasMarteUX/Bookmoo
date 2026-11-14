// Saudações dos personagens: variam com a hora do dia e um pouco ao acaso, para não repetir sempre igual.
const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)]

function period(h = new Date().getHours()) {
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'night'
}

export function greetingFor({ pt, name, scene, title, book }: { pt: boolean; name: string; scene?: boolean; title?: string; book?: string }) {
  const p = period()
  if (scene) {
    // Nas Cenas o personagem é o atendente/colega da situação e fala em inglês.
    const hello = p === 'morning' ? 'Good morning!' : p === 'afternoon' ? 'Good afternoon!' : 'Good evening!'
    return pick([`${hello} I'm ${name}. Ready when you are.`, `Hi there! I'm ${name}. Shall we start?`, `${hello} Welcome!`])
  }
  if (book) {
    return pt
      ? pick([`${p === 'morning' ? 'Bom dia' : p === 'afternoon' ? 'Boa tarde' : 'Boa noite'}! Sou a ${name}. Pergunte qualquer coisa sobre o livro.`, `Oi! Travou em alguma palavra? Me chama que eu explico.`, `Oi! Quer que eu explique esta página?`])
      : pick([`Hi! I'm ${name}. Ask me anything about the book.`, `Stuck on a word? Just ask me.`, `Hi! Want me to explain this page?`])
  }
  return pt
    ? pick([`${p === 'morning' ? 'Bom dia' : p === 'afternoon' ? 'Boa tarde' : 'Boa noite'}! Eu sou a ${name}. Bora conversar em inglês?`, `Oi! Que bom te ver. Sobre o que vamos falar hoje?`, `Olá! Pronta para praticar quando você quiser.`])
    : pick([`${p === 'morning' ? 'Good morning' : p === 'afternoon' ? 'Good afternoon' : 'Good evening'}! I'm ${name}. Shall we talk?`, `Hi! Great to see you. What shall we talk about today?`])
}
