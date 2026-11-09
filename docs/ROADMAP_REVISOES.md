# Revisões com histórias personalizadas (planejado)

## Ideia
Uma pasta **Revisão** que junta as maiores dificuldades do aluno e gera **mini-histórias com IA**
usando exatamente essas palavras. Em vez de revisar uma lista solta, o aluno lê, ouve, fala e
digita um texto curto e novo, feito sob medida para o que ele ainda erra.

## De onde vêm as palavras
Tudo isso já é registrado hoje:

| Fonte | Onde está | O que entra na revisão |
|---|---|---|
| Falar | `practice_sessions` (`kind = 'speak'`, `words.bad/close/skipped`) | palavras pronunciadas errado, quase ou não faladas |
| Ditado | `practice_sessions` (`kind = 'write'`, `words.bad/close/skipped`) | palavras digitadas errado, na 2ª tentativa ou puladas |
| Vocabulário | `vocabulary` (`status = 'review'` / `'important'`) | palavras marcadas para revisar |

**Prioridade de cada palavra** = quantas vezes errou (peso maior para erros recentes) − quantas
vezes acertou depois (as "recuperadas", que hoje já valem pontos em dobro). Palavras recuperadas
várias vezes seguidas saem da revisão.

## Fluxo
1. A pasta Revisão mostra as ~10–15 palavras de maior prioridade, com filtro por livro.
2. "Gerar história": a IA do usuário (chave OpenAI ou Gemini no Vault, via Edge Function
   `ai-text`, nova ação `review-story`) cria uma mini-história de 120–180 palavras que:
   - usa todas as palavras escolhidas, em contexto natural;
   - respeita o nível do aluno (CEFR) e, opcionalmente, o universo do livro de onde vieram;
   - devolve JSON `{ title, text, usedWords[] }`, validado no servidor (cada palavra precisa aparecer).
3. A história vira uma "página" de prática com as mesmas ferramentas: Ler (com voz e destaque),
   Falar (nota por palavra) e Ditado. As palavras-alvo aparecem destacadas.
4. O resultado alimenta `practice_sessions` com `kind` próprio (ex.: `review`) e a gamificação:
   acertar uma palavra-alvo conta como "recuperada" (pontos em dobro).

## Dados (proposta)
- `review_stories (id, user_id, book_id null, words text[], title, text, created_at)` com RLS por dono.
- Cache: a mesma combinação de palavras reaproveita a história em vez de gerar outra (custo zero).

## Custo
Uma história curta com `gpt-4.1-mini` ou `gemini-2.5-flash` custa frações de centavo na chave do
próprio usuário. Sem chave conectada, a revisão continua funcionando com a lista de palavras e o
ditado/fala delas, só sem a história.
