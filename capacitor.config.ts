import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gun.app',
  appName: '건명기업 HRM',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
