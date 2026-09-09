import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'io.github.tssa8.snowballquest',
  appName: 'Snowball Quest',
  webDir: 'dist',
  backgroundColor: '#242633',
  // Bundle the game in the app. No remote server URL or live-reload dependency.
  android: { backgroundColor: '#242633', allowMixedContent: false, minWebViewVersion: 89 },
  ios: { backgroundColor: '#242633', contentInset: 'never', scrollEnabled: false },
  plugins: { SystemBars: { hidden: true, insetsHandling: 'css', animation: 'NONE' } },
};

export default config;
