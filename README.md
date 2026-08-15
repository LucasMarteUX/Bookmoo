<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/6d14231d-4951-4d80-bf95-7ba9986ae3b2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. (Optional) Set `GEMINI_API_KEY` in `.env.local` for IA features (explanations, TTS, comic generation). The app runs without it; those features will prompt you to configure the key.
3. For ElevenLabs page narration, set `ELEVENLABS_API_KEY` and `VITE_ELEVENLABS_VOICE_ID` in `.env.local`. The ElevenLabs secret is consumed by `/api/elevenlabs-tts` and must be configured as a server environment variable in Vercel.
4. Run the app:
   `npm run dev`

## Deploy no Supabase (Storage)

1. Crie ou abra um projeto no [Supabase Dashboard](https://supabase.com/dashboard). Em **Project Settings → API**, copie a **URL** do projeto e a chave **service_role** (secret).
2. No `.env.local` (nunca commite este arquivo), preencha:
   - `SUPABASE_URL` (ex.: `https://SEU-PROJETO.supabase.co`)
   - `SUPABASE_SERVICE_ROLE_KEY` com a chave service_role.
   - `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesma URL + chave anon/public) para login e sync no app.
3. Aplique o schema descrito em `docs/SUPABASE_SCHEMA.md` (tabelas, RLS e buckets).
4. Gere o build e faça o deploy:
   ```bash
   npm run build
   npm run deploy:supabase
   ```
5. Abra o site: `https://SEU-PROJETO.supabase.co/storage/v1/object/public/web/index.html`
