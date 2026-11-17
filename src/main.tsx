import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {setupPwa} from './lib/pwa';
import {setupNative} from './lib/native';
import {installDeviceVoiceUnlock} from './lib/deviceVoice';

// iPhone: a voz do aparelho só fala depois do primeiro toque; este toque libera.
installDeviceVoiceUnlock();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

setupPwa();
void setupNative();
