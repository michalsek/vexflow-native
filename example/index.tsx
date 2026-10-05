// Must stay the first import: worklets snapshots console.info when it
// initializes, so the profile tap has to be installed before that.
import './src/benchmark/benchLog';
import { registerRootComponent } from 'expo';

import App from './src/App';

registerRootComponent(App);
