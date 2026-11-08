-- Reforço: as tabelas de TTS não precisam ser visíveis sem login; escrita em catálogo/cache/jobs é só via service role.
revoke all on public.tts_voices, public.user_voice_preferences, public.tts_audio_cache, public.tts_generation_jobs from anon;
revoke insert, update, delete, truncate on public.tts_voices, public.tts_audio_cache, public.tts_generation_jobs from authenticated;
