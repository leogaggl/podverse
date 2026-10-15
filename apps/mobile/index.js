import './src/shims/webCrypto';
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import './src/downloads/autoDownloadBackgroundBootstrap';
import { registerCarBackgroundSyncHeadlessTask } from './src/sync/carBackgroundSync';
import App from './App';

registerCarBackgroundSyncHeadlessTask();
registerRootComponent(App);
