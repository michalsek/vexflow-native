import { registerRootComponent } from 'expo';
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';
import { version } from 'canvaskit-wasm/package.json';

LoadSkiaWeb({
  locateFile: (file) =>
    `https://cdn.jsdelivr.net/npm/canvaskit-wasm@${version}/bin/full/${file}`,
}).then(async () => {
  const { default: App } = await import('./src/App');
  registerRootComponent(App);
});
