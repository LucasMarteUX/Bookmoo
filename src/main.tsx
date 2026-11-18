import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {setupPwa} from './lib/pwa';
import {setupNative} from './lib/native';
import {installDeviceVoiceUnlock} from './lib/deviceVoice';
import {ensureKokoroReady} from './lib/kokoro/engine';
import {installAudioWarmup} from './lib/audioWarm';

// iPhone: a voz do aparelho só fala depois do primeiro toque; este toque libera.
installDeviceVoiceUnlock();

// Voz dos personagens já vem instalada no computador: baixa em segundo plano depois que a página abre.
window.setTimeout(() => { void ensureKokoroReady(); }, 4000);
installAudioWarmup();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setupPwa();
void setupNative();
