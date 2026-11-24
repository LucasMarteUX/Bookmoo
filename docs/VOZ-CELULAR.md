# Voz dos tutores no celular

Regra: os tutores e a leitura em inglês falam **só com a nossa voz** (Kokoro-82M, gerada no próprio aparelho). Nada de
servidor gerando áudio e nada de voz do navegador (`speechSynthesis`) para o inglês no celular. Quando algo impede a fala,
a tela diz o motivo e oferece a saída; o tutor nunca fica mudo sem explicação.

## Histórico
- 17/11/2026: a Kokoro foi desligada no celular e a fala ia para a voz do aparelho. Resultado: no iPhone e no Android o
  tutor ficava mudo e de boca fechada (a voz do navegador também precisa de toque e de vozes instaladas).
- 24/11/2026 (esta versão): pacote de voz no celular (modelo q8 + 2 vozes, ~90 MB) e as correções abaixo.

## Causas encontradas e correções
1. **Som bloqueado pelo iPhone.** O avatar criava um `<audio>` novo e o ligava a um `AudioContext` próprio (lip sync da
   LivLiv). A fala chega segundos depois do toque, então o elemento nunca tinha sido destravado.
   - Agora há **um player único** (`globalPlayer` em `src/lib/tts.ts`). No celular o avatar não empresta elemento nem usa
     Web Audio; a boca segue os fonemas do Kokoro (`visemeTrack`).
   - `installAudioUnlock()` (chamado em `src/main.tsx`) toca um silêncio no primeiro toque e o player fica liberado.
   - Se o navegador ainda recusar, a fala espera um toque e aparece **"Toque para ouvir o tutor"**
     (`VoiceStatusLayer`, eventos `AUDIO_BLOCKED_EVENT` e `AUDIO_UNBLOCKED_EVENT`).
2. **Caía para a voz do navegador.** Isso acontecia com o motor frio, com qualquer erro e com 2 falhas na sessão.
   - Agora a fala espera o motor aquecer (`waitKokoroWarm`) e, em caso de erro, tenta de novo.
   - Se falhar outra vez, mostra o aviso com **"Tentar de novo"** (`VOICE_FAILED_EVENT`).
   - O corte por falhas na sessão saiu.
3. **Trava falsa de "a página caiu".** O motor só fica marcado como ocupado com a página visível, e a marca é limpa em
   `pagehide`, `visibilitychange` e `freeze`. A voz só pausa com 2 quedas em 15 minutos, e por 30 minutos. "Reativar voz"
   aparece no aviso, em Ajustes e no diagnóstico.
4. **Prazos curtos.** O prazo de geração sai da velocidade medida no próprio aparelho (`kokoroRtf`), com piso de 25 s.
5. **Primeira fala lenta.**
   - O motor aquece ao abrir o tutor.
   - Respostas longas viram trechos de até ~120 letras (`chunkForVoice`).
   - O trecho seguinte é gerado enquanto o atual toca (uma fala à frente; o worker aceita só 1 no celular).
   - A pré-geração usa os mesmos parâmetros da fala (`resolveSpeechOpts` e `kokoroParams`). Antes ela gerava com outra
     velocidade e o cache nunca servia.
6. **Microfone aberto.** Antes de falar no celular, o microfone e o reconhecedor fecham e há uma pausa de 250 ms para o
   aparelho sair do modo de gravação.

## Onde ver e testar
- **Ajustes › Voz (celular):**
  - estado do pacote;
  - "Testar voz", "Baixar de novo", "Reativar voz";
  - link para o diagnóstico.
- **`/diagnostico-voz`:**
  - aparelho e pacote: memória, WebGPU, `audioSession`, OPFS;
  - carga do motor;
  - 3 gerações com o RTF;
  - toque pelo player do app;
  - toque por Web Audio;
  - toque depois do microfone.
  
  "Enviar relatório" grava na tabela `voice_reports` (só o aluno logado insere; a leitura é pelo painel). "Copiar
  relatório" copia o JSON.
- **Registro de voz:** os últimos 150 eventos ficam em `localStorage` (`upoonly.voiceLog.v1`, `src/lib/voiceLog.ts`) e
  vão junto no relatório.

## Próximos passos, se o relatório mostrar
- Memória no limite: texturas da LivLiv em meia resolução só no celular (`scripts/characters/webp-pack.sh`).
- Geração lenta (RTF > 2,5): testar WebGPU no Safari do iOS 26 e no Chrome do Android.
