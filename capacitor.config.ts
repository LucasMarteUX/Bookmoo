import type { CapacitorConfig } from '@capacitor/cli'

// App iOS: empacota o build do Vite (dist/). Para desenvolver com live reload no simulador,
// rode `CAP_DEV_URL=http://<ip-do-mac>:3000 npx cap run ios`.
const devUrl = process.env.CAP_DEV_URL

const config: CapacitorConfig = {
  appId: 'app.bookmoo',
  appName: 'Bookmoo',
  webDir: 'dist',
  ...(devUrl ? { server: { url: devUrl, cleartext: true } } : {}),
  ios: {
    contentInset: 'never',
    scheme: 'Bookmoo',
    backgroundColor: '#F6F3EE',
    limitsNavigationsToAppBoundDomains: false,
  },
  plugins: {
    SplashScreen: { launchAutoHide: false, backgroundColor: '#F6F3EE', showSpinner: false },
    Keyboard: { resizeOnFullScreen: true },
    StatusBar: { overlaysWebView: true },
  },
}

export default config
