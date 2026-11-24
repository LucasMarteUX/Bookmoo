import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {setupPwa} from './lib/pwa';
import {setupNative} from './lib/native';
import {installDeviceVoiceUnlock} from './lib/deviceVoice';
import {ensureKokoroReady} from './lib/kokoro/engine';
import {installAudioWarmup} from './lib/audioWarm';
import {installAudioUnlock} from './lib/tts';

// iPhone: a voz do aparelho só fala depois do primeiro toque; este toque libera.
installDeviceVoiceUnlock();

// Voz dos personagens já vem instalada no computador: baixa em segundo plano depois que a página abre.
// Visitante do site (sem sessão salva) não baixa o pacote de voz.
const hasSession = (() => {
  try { return Object.keys(localStorage).some(k => k.startsWith('sb-') && k.endsWith('-auth-token')); } catch { return true; }
})();
if (hasSession) window.setTimeout(() => { void ensureKokoroReady(); }, 4000);
installAudioWarmup();
// Celular: o primeiro toque destrava o player único das vozes dos tutores, para a fala tocar depois sem precisar de outro toque.
installAudioUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setupPwa();
void setupNative();
