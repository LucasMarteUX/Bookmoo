// O jeito de falar de cada tutor nas frases de espera. Mesmo assunto, estrutura e vocabulário diferentes:
// - Bia (adulta): calorosa, calma, acolhedora, um pouco poética. Frases completas, carinhosas.
// - Luck (adulto): descontraído, bem-humorado, direto. "Cara", "bora", piadinhas, desafios.
// - Yuno (adolescente): animada, intensa, curiosa. Exclamações, "aaah", "sério?", "tipo assim", fala rápido.
// - Yuri (adolescente): tranquilo, gamer, "suave", referências a jogo (fase, missão, level up), frases curtas.
import type { ReactionLine } from '@/lib/tutorReactions'

const L = (mood: ReactionLine['mood'], pt: string, en: string): ReactionLine => ({ mood, pt, en })

export type TutorVoice = {
  bank: ReactionLine[]
  reading: (t: string) => ReactionLine[]
  finished: (t: string) => ReactionLine
  untouched: (t: string) => ReactionLine
  genre: (g: string) => ReactionLine
  topic: (t: string) => ReactionLine
  strong: (s: string) => ReactionLine
  weak: (w: string) => ReactionLine
  other: (t: string, name: string) => ReactionLine
  missed: () => ReactionLine
}

const BIA: TutorVoice = {
  bank: [
    L('happy', 'Que bom que você veio. Sit with me, let us talk a little.', 'I am glad you came. Sit with me, let us talk a little.'),
    L('shy', 'Eu guardei um lugar para você. How was your day, really?', 'I saved a seat for you. How was your day, really?'),
    L('wink', 'Errar aqui é permitido, viu? Mistakes are just practice.', 'Mistakes are allowed here. They are just practice.'),
    L('confused', 'Hmm, I wonder... o que te fez sorrir hoje?', 'Hmm, I wonder... what made you smile today?'),
    L('happy', 'Com calma a gente vai longe. One sentence at a time.', 'Slowly, we go far. One sentence at a time.'),
    L('sad', 'Senti sua falta por aqui. Shall we catch up?', 'I missed you here. Shall we catch up?'),
    L('excited', 'Tenho uma pergunta bonita para você. Want to hear it?', 'I have a lovely question for you. Want to hear it?'),
    L('happy', 'Sua voz em inglês já está mais segura, sabia? Let us use it.', 'Your English voice sounds more confident already. Let us use it.'),
    L('confused', 'If you could be anywhere now... onde você estaria?', 'If you could be anywhere now... where would you be?'),
    L('laughing', 'Pode rir dos meus exemplos, eu não ligo. Shall we start?', 'Feel free to laugh at my examples. Shall we start?'),
    L('angry', 'Ah, não vou deixar o dia passar sem um pouquinho de inglês!', 'Oh, I will not let the day go by without a little English!'),
    L('shy', 'Às vezes é só começar com um "hello". I will do the rest.', 'Sometimes it starts with a simple hello. I will do the rest.'),
    L('happy', 'Um chá, uma conversa e um pouco de inglês. Perfect, no?', 'A cup of tea, a chat and some English. Perfect, no?'),
    L('excited', 'Me conta uma coisa boa da sua semana. In English, slowly.', 'Tell me one good thing about your week. In English, slowly.'),
    L('wink', 'Fica entre nós: quem pratica todo dia aprende o dobro.', 'Just between us: daily practice doubles your progress.'),
    L('surprised', 'Oh, você chegou na hora certa. I was thinking about you.', 'Oh, perfect timing. I was thinking about you.'),
  ],
  reading: t => [
    L('happy', `Estou curiosa sobre "${t}". Which character do you like most?`, `I am curious about "${t}". Which character do you like most?`),
    L('confused', `Como está a leitura de "${t}"? Tell me, without hurry.`, `How is "${t}" going? Tell me, no hurry.`),
  ],
  finished: t => L('happy', `Você terminou "${t}"! Me conta, how did the ending make you feel?`, `You finished "${t}"! How did the ending make you feel?`),
  untouched: t => L('shy', `"${t}" está quietinho na sua estante... shall we open it together?`, `"${t}" is sitting quietly on your shelf... shall we open it together?`),
  genre: g => L('happy', `Percebi que você gosta de ${g}. I have a lovely idea for your next book.`, `I noticed you like ${g}. I have a lovely idea for your next book.`),
  topic: t => L('happy', `Fiquei pensando na nossa conversa sobre ${t}. Shall we go on?`, `I kept thinking about our chat about ${t}. Shall we go on?`),
  strong: s => L('excited', `Você foi tão bem em ${s}! I would love to hear it again.`, `You did so well with ${s}! I would love to hear it again.`),
  weak: w => L('wink', `Lembra de "${w}"? Hoje a gente cuida disso juntas, gently.`, `Remember "${w}"? Today we take care of it together, gently.`),
  other: (t, n) => L('confused', `A ${n} me contou que vocês falaram de ${t}. Can I hear your side?`, `${n} told me you talked about ${t}. Can I hear your side?`),
  missed: () => L('sad', 'Faz alguns dias... I missed our little chats.', 'It has been a few days... I missed our little chats.'),
}

const LUCK: TutorVoice = {
  bank: [
    L('happy', 'E aí! Pronto pra soltar o inglês? Let us go!', 'Hey! Ready to let your English out? Let us go!'),
    L('laughing', 'Cara, minha piada em inglês de hoje é péssima. Want it anyway?', 'My English joke today is terrible. Want it anyway?'),
    L('angry', 'Dia sem inglês? Aqui não, parceiro. Bora!', 'A day without English? Not here, buddy. Come on!'),
    L('excited', 'Desafio rápido: três frases sobre o seu dia. Topa?', 'Quick challenge: three sentences about your day. Deal?'),
    L('wink', 'Errou? Ótimo, é assim que se aprende. No stress.', 'Made a mistake? Great, that is how you learn. No stress.'),
    L('confused', 'Futebol, série ou comida? Escolhe um e manda ver.', 'Football, series or food? Pick one and go.'),
    L('happy', 'Cinco minutinhos e você já sai melhor. Simple as that.', 'Five minutes and you are already better. Simple as that.'),
    L('surprised', 'Opa, você por aqui! Bora trocar uma ideia?', 'Oh, look who is here! Shall we chat?'),
    L('laughing', 'Prometo não rir do seu sotaque. Talvez só um pouquinho.', 'I promise not to laugh at your accent. Maybe just a little.'),
    L('excited', 'Hoje é dia de falar sem medo. Ready, set, go!', 'Today we speak without fear. Ready, set, go!'),
    L('confused', 'Me fala: café da manhã de campeão, o que tem?', 'Tell me: what is in a champion breakfast?'),
    L('wink', 'Dica de amigo: fala devagar que fica natural.', 'Tip from a friend: speak slowly and it sounds natural.'),
    L('sad', 'Tô aqui parado esperando... me dá uma frase, vai.', 'I am just standing here waiting... give me a sentence.'),
    L('happy', 'Treino é treino. Uma conversa por dia e pronto.', 'Practice is practice. One chat a day, done.'),
    L('excited', 'Imagina que a gente tá num bar em Londres. What do you order?', 'Imagine we are in a London pub. What do you order?'),
    L('shy', 'Começa com um "hi" que o resto eu seguro.', 'Start with a "hi" and I will handle the rest.'),
  ],
  reading: t => [
    L('excited', `E aí, "${t}" tá valendo a pena? Give me your honest review.`, `So, is "${t}" worth it? Give me your honest review.`),
    L('confused', `Até onde você chegou em "${t}"? Sem spoiler pra mim, hein.`, `How far are you in "${t}"? No spoilers, okay?`),
  ],
  finished: t => L('happy', `Terminou "${t}"! Nota de zero a dez? Explain your score.`, `You finished "${t}"! Score from zero to ten? Explain it.`),
  untouched: t => L('wink', `"${t}" tá pegando poeira, cara. Bora falar dele pra dar vontade?`, `"${t}" is gathering dust. Shall we talk about it to get you started?`),
  genre: g => L('excited', `Curte ${g}, né? Tenho uma sugestão que é a sua cara.`, `You like ${g}, right? I have a suggestion that is so you.`),
  topic: t => L('happy', `Da última vez a gente falou de ${t}. Continuamos o papo?`, `Last time we talked about ${t}. Shall we keep going?`),
  strong: s => L('excited', `Você mandou bem demais em ${s}. Mostra de novo aí!`, `You nailed ${s}. Show me again!`),
  weak: w => L('wink', `"${w}" ainda tá te pegando, né? Hoje a gente resolve isso.`, `"${w}" still gets you, right? Today we fix it.`),
  other: (t, n) => L('confused', `Fiquei sabendo que você falou de ${t} com ${n === 'Bia' || n === 'Yuno' ? 'a' : 'o'} ${n}. E comigo, vai?`, `I heard you talked about ${t} with ${n}. What about with me?`),
  missed: () => L('sad', 'Sumiu, hein! Bora voltar pro treino?', 'Long time no see! Back to practice?'),
}

const YUNO: TutorVoice = {
  bank: [
    L('excited', 'Aaah, você veio! Bora conversar? Please, please!', 'Aaah, you came! Shall we talk? Please, please!'),
    L('surprised', 'Sério que você tá aqui? Que demais! Tell me everything!', 'Wait, you are here? So cool! Tell me everything!'),
    L('laughing', 'Tipo assim, eu tô muito animada hoje. Are you?', 'Like, I am so excited today. Are you?'),
    L('confused', 'Pergunta aleatória: gato ou cachorro? Answer in English!', 'Random question: cats or dogs? Answer in English!'),
    L('wink', 'Pode errar tudo, eu prometo que não conto pra ninguém!', 'You can get it all wrong, I will not tell anyone!'),
    L('excited', 'Vamos fingir que a gente tá num parque de diversões? Which ride first?', 'Let us pretend we are at a theme park. Which ride first?'),
    L('shy', 'Eu fico meio tímida no começo... mas depois falo sem parar!', 'I am a bit shy at first... then I never stop talking!'),
    L('happy', 'Sua música favorita agora? Eu quero saber!', 'What is your favourite song right now? I want to know!'),
    L('angry', 'Ei! Tô esperando faz um tempão! Just one word, vai!', 'Hey! I have been waiting forever! Just one word!'),
    L('confused', 'Se você tivesse um superpoder, qual seria? In English!', 'If you had a superpower, what would it be?'),
    L('excited', 'Desafio: me descreve seu lanche favorito sem dizer o nome!', 'Challenge: describe your favourite snack without saying its name!'),
    L('happy', 'Cada palavra nova é tipo uma figurinha nova. Let us collect!', 'Every new word is like a new sticker. Let us collect!'),
    L('surprised', 'Uau, olha você pronto pra aprender! Começamos?', 'Wow, look at you, ready to learn! Shall we start?'),
    L('sad', 'Tava com saudade... vamos conversar um pouquinho?', 'I missed you... can we talk a little?'),
    L('laughing', 'Eu falo rápido quando fico feliz, me avisa se precisar ir devagar!', 'I talk fast when I am happy, tell me to slow down!'),
    L('wink', 'Segredo: falar em voz alta faz o inglês grudar na cabeça!', 'Secret: speaking out loud makes English stick!'),
  ],
  reading: t => [
    L('excited', `Aaah, você tá lendo "${t}"! Quem é seu personagem favorito? Tell me!`, `Aaah, you are reading "${t}"! Who is your favourite character?`),
    L('surprised', `Sério, o que tá acontecendo em "${t}" agora? I need to know!`, `Seriously, what is happening in "${t}" now? I need to know!`),
  ],
  finished: t => L('excited', `Você terminou "${t}"?! O final foi bom? Tell me, tell me!`, `You finished "${t}"?! Was the ending good? Tell me!`),
  untouched: t => L('confused', `"${t}" tá lá paradinho... a gente começa juntos? Pleeease?`, `"${t}" is just sitting there... shall we start it together? Pleeease?`),
  genre: g => L('excited', `Você ama ${g}, né? Eu tenho uma ideia de livro perfeita!`, `You love ${g}, right? I have the perfect book idea!`),
  topic: t => L('excited', `Lembra que a gente falou de ${t}? Eu quero continuar!`, `Remember we talked about ${t}? I want to keep going!`),
  strong: s => L('happy', `Você arrasou em ${s}! Faz de novo, faz de novo!`, `You rocked ${s}! Do it again, do it again!`),
  weak: w => L('wink', `"${w}" foi difícil, né? Hoje vai ser fácil, promessa!`, `"${w}" was tricky, right? Today it will be easy, promise!`),
  other: (t, n) => L('surprised', `Espera, você falou de ${t} com ${n === 'Bia' || n === 'Yuno' ? 'a' : 'o'} ${n}? Me conta também!`, `Wait, you talked about ${t} with ${n}? Tell me too!`),
  missed: () => L('sad', 'Faz uns dias que você não aparece... I missed you so much!', 'You have not been around for days... I missed you so much!'),
}

const YURI: TutorVoice = {
  bank: [
    L('happy', 'Suave? Bora uma partida de inglês?', 'All good? Up for a round of English?'),
    L('wink', 'Errar faz parte do jogo. Respawn e segue.', 'Mistakes are part of the game. Respawn and keep going.'),
    L('excited', 'Missão do dia: três frases. Desbloqueia um level?', 'Daily quest: three sentences. Unlock a level?'),
    L('confused', 'Qual jogo ou série você tá curtindo? Fala aí, in English.', 'What game or series are you into? Tell me, in English.'),
    L('happy', 'Sem pressa, mano. Cada frase conta XP.', 'No rush. Every sentence gives XP.'),
    L('laughing', 'Meu inglês também já foi nível tutorial. Relax.', 'My English was tutorial level once too. Relax.'),
    L('surprised', 'Opa, player novo no servidor! Começamos?', 'Oh, a player joined the server! Shall we start?'),
    L('angry', 'Tô AFK te esperando faz tempo... joga uma frase aí.', 'I have been AFK waiting for ages... drop a sentence.'),
    L('shy', 'Eu não falo muito no começo, mas depois engato.', 'I do not talk much at first, but then I get going.'),
    L('confused', 'Pizza ou hambúrguer? Escolhe e defende a escolha.', 'Pizza or burger? Pick one and defend it.'),
    L('excited', 'Boss da fase: pedir comida em inglês. Bora tentar?', 'Level boss: ordering food in English. Wanna try?'),
    L('happy', 'Combo: cinco minutos por dia. Funciona, confia.', 'Combo: five minutes a day. It works, trust me.'),
    L('wink', 'Pro tip: fala devagar que a mira fica melhor.', 'Pro tip: speak slowly and your aim gets better.'),
    L('sad', 'Faz tempo, hein. O save ainda tá aqui, bora continuar?', 'Been a while. Your save is still here, continue?'),
    L('confused', 'Se você pudesse morar em qualquer jogo, qual seria?', 'If you could live in any game, which one?'),
    L('happy', 'Primeiro "hi", depois a gente vai pro próximo nível.', 'First a "hi", then we go to the next level.'),
  ],
  reading: t => [
    L('happy', `Como tá a campanha em "${t}"? Que fase você tá?`, `How is your run in "${t}" going? What part are you on?`),
    L('confused', `"${t}" tá bom mesmo? Me dá a review sem spoiler.`, `Is "${t}" actually good? Give me a no-spoiler review.`),
  ],
  finished: t => L('excited', `Zerou "${t}"! E aí, valeu o final? Rate it.`, `You beat "${t}"! Was the ending worth it? Rate it.`),
  untouched: t => L('wink', `"${t}" tá no inventário sem usar. Bora equipar?`, `"${t}" is in your inventory unused. Wanna equip it?`),
  genre: g => L('happy', `Você curte ${g}, né? Tenho uma recomendação que é seu estilo.`, `You like ${g}, right? I have a rec that is your style.`),
  topic: t => L('happy', `Último save: a gente falando de ${t}. Continua daí?`, `Last save: we were talking about ${t}. Continue from there?`),
  strong: s => L('excited', `Seu ${s} tava no nível pro. Repete aí?`, `Your ${s} was pro level. Run it back?`),
  weak: w => L('wink', `"${w}" foi tipo um boss difícil. Hoje a gente vence.`, `"${w}" was like a tough boss. Today we win.`),
  other: (t, n) => L('confused', `Vi que você jogou o assunto ${t} com ${n === 'Bia' || n === 'Yuno' ? 'a' : 'o'} ${n}. Co-op comigo agora?`, `I saw you covered ${t} with ${n}. Co-op with me now?`),
  missed: () => L('sad', 'Uns dias offline, hein. Bora logar de novo?', 'A few days offline. Log back in?'),
}

export const TUTOR_VOICES: Record<string, TutorVoice> = {
  'bookmoo-mulher': BIA,
  'bookmoo-homem': LUCK,
  'bookmoo-yuno': YUNO,
  'bookmoo-yuri': YURI,
}
export const voiceOf = (tutorId: string) => TUTOR_VOICES[tutorId] ?? BIA
