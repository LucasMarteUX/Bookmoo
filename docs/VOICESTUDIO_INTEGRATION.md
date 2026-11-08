# Bookmoo × VoiceStudio — integração TTS

## Status (2026-11-08)

| Item | Status |
|---|---|
| Auditoria (SpeechSynthesis em `Reader.tsx` e `VocabularyModal.tsx`) | ✅ feito |
| Migration (tabelas, RLS, fila, bucket privado, limpeza) | ✅ aplicada em `ywnmeacpvmcuhzhshpwz` (advisors: sem alertas nas tabelas TTS) |
| Edge Functions `tts-list-voices`, `tts-generate`, `tts-status`, `tts-save-preferences`, `tts-sync-voices` | ✅ implantadas (v1, verify_jwt) · ⏳ secrets `VOICESTUDIO_*` não definidos |
| Worker (`tts-worker/worker.mjs`) | ✅ escrito · ⏳ não executado |
| Camada de áudio `src/lib/tts.ts` + Reader + Vocabulário + tela de voz em Configurações | ✅ feito, build ok |
| Fallback para voz do navegador | ✅ automático quando o serviço falha (cooldown de 30s) |
| PoC com áudio real do VoiceStudio | ⏳ **pendente**: VoiceStudio não está instalado nesta máquina (nada em `:3900`) |

Nenhum teste end-to-end foi executado ainda. Nada acima foi simulado.

## Arquitetura

```
Browser (src/lib/tts.ts) ──JWT──▶ Edge Functions ──▶ Postgres (cache, jobs, prefs)
        ▲                                               ▲
        │ signed URL (1h)                               │ tts_claim_jobs (SKIP LOCKED)
 Storage tts-audio (privado) ◀── upload ── tts-worker ──┘
                                              │ Bearer OMNIVOICE_API_KEY, rede privada
                                              ▼
                                         VoiceStudio :3900
```

- A geração nunca roda no Postgres nem na Edge Function: a função só enfileira; o worker (processo de longa duração ao lado do VoiceStudio) sintetiza.
- **Fila:** tabela + `FOR UPDATE SKIP LOCKED` com lease (`locked_until`). Escolhi isso em vez de `pgmq` porque o status precisa ficar consultável por linha (o `tts-status` lê o job), a deduplicação vem do índice único parcial `(content_hash) where status in (pending, processing)` e não há extensão extra para habilitar. Se o volume crescer, dá para migrar para pgmq sem mudar a API.
- Jobs interrompidos voltam para a fila quando o lease expira. Há backoff exponencial (5s·2ⁿ, até 300s) e limite de 3 tentativas. Erros 4xx do VoiceStudio são permanentes. Cancelamento vale para jobs `pending` (`tts-status` com `{action:"cancel"}`).
- **Cache:** `content_hash = sha256(v1, texto normalizado, idioma, provedor, voz, modelo, versão do modelo, velocidade de síntese, formato, escopo)`. Mudar o modelo ou a versão (`model_version` em `tts_voices`) invalida o cache naturalmente.
- **Privacidade:** palavras e frases curtas (≤60 caracteres), conteúdo `lesson` e prévias usam o cache compartilhado. O texto do leitor (livros enviados pelo aluno) recebe `scope_user_id` = aluno, entra no hash, fica em `private/<uid>/…` e nunca aparece para outros alunos (RLS + checagem no `tts-status`).
- **Velocidade:** a síntese é sempre feita a 1.0 e a velocidade é aplicada no player (`playbackRate` + `preservesPitch`). Assim há um arquivo por frase, e não um por velocidade. O VoiceStudio aceita `speed`, se for preciso comparar a naturalidade.
- **Limpeza:** `tts_expire_cache()` remove privados sem acesso há 30 dias e compartilhados há 180 dias. O worker chama a cada 6h e apaga os objetos do Storage.
- **Limites:** 1000 caracteres por pedido e `TTS_MAX_JOBS_PER_HOUR` (300) por aluno. Cache hits não contam.
- **Destaque por palavra:** o `onboundary` do navegador não existe no áudio do VoiceStudio. O Reader mantém o destaque por frase (e por palavra na velocidade 0.3, que fala palavra a palavra). Nenhum alinhamento foi inventado.

## Licenças: requisito de lançamento

- O app VoiceStudio é **AGPL-3.0**. Ele roda como serviço separado, acessado só por HTTP e sem código copiado para o Bookmoo. Se o VoiceStudio for modificado e oferecido pela rede, o código modificado precisa ser disponibilizado. Vale validar com um advogado.
- **OmniVoice** (engine padrão): pesos **não comerciais**. Não usar no Bookmoo comercial.
- Segundo o inventário do próprio VoiceStudio (`docs/licensing/model-inventory.md`), **nenhum modelo está marcado como liberado para uso comercial**. Rótulos como MIT/Apache-2.0 no model card são metadados upstream ainda não revisados.
- Candidato recomendado: **Kokoro-82M** (o model card upstream diz Apache-2.0). Antes de produção, conferir os pesos, as vozes e o G2P/espeak (GPL) da revisão fixada, e só então marcar `commercial_use_verified = true` nas vozes.
- Nada de clonagem de voz de terceiros sem consentimento verificável.

## Passos para ativar

1. **Aplicar a migration:** `supabase db push`, ou colar `supabase/migrations/20261108000000_tts_voicestudio.sql` no SQL Editor.
2. **Secrets das funções:** `supabase secrets set VOICESTUDIO_URL=https://tts.interno.exemplo VOICESTUDIO_API_KEY=… VOICESTUDIO_MODEL=kokoro VOICESTUDIO_MODEL_VERSION=<revisão>`
3. **Deploy:** `supabase functions deploy tts-list-voices tts-generate tts-status tts-save-preferences tts-sync-voices`
4. **Admin:** defina `app_metadata.role = "admin"` no seu usuário (Dashboard → Auth → Users) e chame `tts-sync-voices`. Depois chame de novo com `{"activate":[ids], "default_voice_id": id}`. Vozes novas entram **inativas**.
5. **VoiceStudio local (PoC):** instale pelo README oficial (DMG/Homebrew no macOS), instale a engine Kokoro no Model Manager e rode:
   `node scripts/voicestudio-check.mjs` (lista modelos e vozes reais) e depois `node scripts/voicestudio-check.mjs kokoro <voice_id>` (gera `voicestudio-sample.mp3`).
6. **Worker:** `SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… VOICESTUDIO_URL=http://127.0.0.1:3900 node tts-worker/worker.mjs`
7. `VITE_TTS_PROVIDER=browser` desliga o VoiceStudio no frontend (rollback instantâneo).

## Produção

- Uma VM com GPU (ou CPU para Kokoro, que é leve) roda o **VoiceStudio em Docker** (`OMNIVOICE_SERVER_MODE=1`, `OMNIVOICE_API_KEY` forte) e o **worker** no mesmo host. A porta 3900 fica presa a `127.0.0.1`/rede privada, sem exposição pública.
- O worker só faz conexões de saída para o Supabase, então nenhuma porta de entrada é necessária. Se o `tts-sync-voices` precisar alcançar o VoiceStudio, use Tailscale ou Cloudflare Tunnel com TLS e a API key.
- Opções (estimativas, a confirmar com medição de latência real):
  - Hetzner CCX/CPX de 4–8 vCPU com Kokoro em CPU: cerca de €15–40/mês.
  - GPU sob demanda (RunPod, Vast, Lambda) com RTX 4000/A10: cerca de US$0,20–0,80/h.
  - Fly.io/Render GPU: mais caro, menos operação.
- **Pré-geração:** chamar `tts-generate` com `context:"lesson"` para o conteúdo oficial (script em lote) antes da publicação.
- **Observabilidade:** o worker e as funções emitem logs JSON (`job_completed` com `ms`, `job_failed`, `cache_hit`).

## Testes a executar (pendentes)

- [ ] `voicestudio-check` lista vozes reais e gera MP3 reproduzível
- [ ] migration aplicada; `get_advisors` sem alertas de RLS
- [ ] aluno A não lê cache, job ou preferências privadas do aluno B
- [ ] segunda reprodução da mesma frase devolve `cached: true`
- [ ] dois cliques simultâneos geram um job só
- [ ] VoiceStudio parado leva ao fallback do navegador; worker morto no meio do job leva à retomada após o lease
- [ ] Chrome, Safari (macOS/iOS), Firefox e Android: reprodução de MP3 e `preservesPitch`
