// Resultado de exemplo para revisar o visual do relatório em desenvolvimento (/prova/resultado/x?demo=1).
// Só é carregado com import.meta.env.DEV; nunca aparece em produção.
import type { Result } from '@/lib/proficiencyApi'

export const DEMO_RESULT: Result = {
  session_id: '00000000-demo-0000-0000-000000000000', status: 'final', overall: 4, cefr: 'B2',
  created_at: new Date().toISOString(), started_at: new Date().toISOString(), scoring_version: 'sc-1', rubric_version: 'rub-1',
  path: { reading: { module: 'hard' }, listening: { module: 'hard' } },
  sections: {
    reading: { band: 4.5, cefr: 'B2', status: 'ok', breakdown: { 'Complete the Words': { correct: 24, total: 30 }, 'Read in Daily Life': { correct: 8, total: 10 }, 'Read an Academic Passage': { correct: 7, total: 10 } } },
    listening: { band: 4, cefr: 'B2', status: 'ok', breakdown: { 'Listen and Choose a Response': { correct: 12, total: 15 }, 'Listen to a Conversation': { correct: 9, total: 12 }, 'Listen to an Announcement': { correct: 6, total: 8 }, 'Listen to an Academic Talk': { correct: 7, total: 12 } } },
    writing: { band: 3.5, cefr: 'B1', status: 'ok', breakdown: { 'Build a Sentence': { correct: 8, total: 10 }, 'Write an Email': { correct: 3.5, total: 5 }, 'Write for an Academic Discussion': { correct: 3, total: 5 } },
      evals: [
        { task: 'Write an Email', score: 3.5, rationale: 'O e-mail cobre os três pontos pedidos e tem tom adequado ao síndico. A frase "I already knocked on their door last Friday" mostra bom controle do passado; faltou variar os conectores.', strengths: ['Tom educado e adequado'], improve: ['Variar os conectores'], evidence: ['I already knocked on their door last Friday', 'Could you please remind all residents about the quiet hours'] },
        { task: 'Write for an Academic Discussion', score: 3, rationale: 'A contribuição traz uma ideia própria ("a middle solution"), mas o exemplo é pouco desenvolvido.', strengths: ['Posição clara'], improve: ['Desenvolver o exemplo com dados ou detalhes'], evidence: ['I think a middle solution is better'] },
      ] },
    speaking: { band: 4, cefr: 'B2', status: 'ok', breakdown: { 'Listen and Repeat': { correct: 5.6, total: 7 }, 'Take an Interview': { correct: 3.5, total: 5 } },
      evals: [{ task: 'Take an Interview', score: 3.5, rationale: 'Respostas completas e coerentes, com ritmo natural. Em "I usually study in the library because it is quiet" a justificativa é clara; nas perguntas de opinião, faltou aprofundar.', strengths: ['Fala sustentada'], improve: ['Aprofundar as opiniões'], evidence: ['I usually study in the library because it is quiet'] }] },
  },
  report: {
    overall: 'Você tem um inglês independente: entende bem textos e áudios do dia a dia e acadêmicos e se comunica com segurança. O próximo passo é ganhar precisão e profundidade na escrita.',
    skills: {
      reading: { summary: 'Ótimo desempenho no Complete the Words e nos textos do dia a dia; os textos acadêmicos pedem mais atenção a inferências.', strengths: ['Vocabulário amplo', 'Leitura rápida de avisos e e-mails'], improve: ['Perguntas de inferência'], next_steps: ['Ler um capítulo por dia de um livro Intermediário superior'] },
      listening: { summary: 'Entende bem conversas e anúncios; as aulas longas são o ponto a desenvolver.', strengths: ['Respostas rápidas e naturais'], improve: ['Manter o foco em áudios longos'], next_steps: ['Ditado diário de 10 minutos'] },
      writing: { summary: 'Textos organizados e com tom adequado; falta variar estruturas e desenvolver exemplos.', strengths: ['Organização'], improve: ['Conectores', 'Exemplos'], next_steps: ['Escrever um parágrafo de opinião por dia'] },
      speaking: { summary: 'Fala fluida e compreensível, com boa repetição de frases.', strengths: ['Fluência'], improve: ['Aprofundar opiniões'], next_steps: ['Conversa livre com um tutor três vezes por semana'] },
    },
    disclaimer: 'Resultado interno do Upoonly, inspirado no formato público do TOEFL iBT. Não é um exame oficial, não é certificado pela ETS e não tem equivalência oficial com nenhuma prova ou certificação.',
  },
}
