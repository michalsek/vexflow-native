# vexflow-native

React Native Skia bridge for rendering VexFlow music notation: a typed score
model, a `ScoreRenderer` component with scrolling, playhead and per-item
style overrides, a MusicXML importer, and a low-level canvas for drawing with
VexFlow directly.

## Installation

Install the library and its peer dependencies:

```sh
npm install vexflow-native react react-native vexflow react-native-skia react-native-gesture-handler react-native-reanimated react-native-worklets
```

`ScoreRenderer` uses gesture handling and Reanimated worklets for scrolling,
so configure `react-native-gesture-handler`, `react-native-reanimated`, and
`react-native-worklets` as required by your React Native app.

Load a notation font with Skia; the `defaultFont` prop must match one of the
family names passed to `useFonts`.

### Requirements

| Package                   | Version                       |
| ------------------------- | ----------------------------- |
| `react-native-skia`       | ≥ 3.0.0                       |
| `react-native-reanimated` | ≥ 4.0.0                       |
| `react-native-worklets`   | ≥ 0.7.0                       |
| `react` / `react-native`  | React 19, React Native ≥ 0.78 |

- iOS 15.1 or newer.
- Android: minSdkVersion 26 (Android 8.0) or higher and a GPU with Vulkan.
  react-native-skia 3 draws with Skia Graphite, which uses Vulkan on Android
  and has no OpenGL fallback. The Android Emulator works with `-gpu auto` or
  `-gpu host`, but may fall back to software (llvmpipe) Vulkan, so don't judge
  performance there.
- Colour: `ScoreRenderer` and `VexflowCanvas` draw into react-native-skia 3's
  Graphite `<Canvas>`, which picks its colour space itself: Display P3 on
  wide-gamut Apple screens, sRGB elsewhere (always sRGB on Android). Colours
  are managed, so sRGB colours look the same either way; there is no
  `colorSpace` option.
- Web: react-native-skia 3.0.x throws from `matchFamilyStyle` on `useFonts`
  providers, so scores need
  [this patch](example/patches/react-native-skia+3.0.3.patch) (apply it with
  `patch-package`) until upstream ships the fix.

With Expo, raise the Android minSdkVersion with `expo-build-properties`:

```json
{
  "expo": {
    "plugins": [
      ["expo-build-properties", { "android": { "minSdkVersion": 26 } }]
    ]
  }
}
```

In a bare React Native app, set `minSdkVersion = 26` in `buildscript.ext` of
`android/build.gradle`.

## Quick start

```tsx
import { useMemo } from 'react';
import { useFonts } from 'react-native-skia';
import { ScoreRenderer } from 'vexflow-native/renderer';
import { parseMusicXmlToScore } from 'vexflow-native/musicxml';

import bravuraFont from './assets/fonts/Bravura.otf';

export function MusicXmlScore({ xml }: { xml: string }) {
  const fontManager = useFonts({ Bravura: [bravuraFont] });
  const score = useMemo(() => parseMusicXmlToScore(xml), [xml]);

  if (!fontManager) {
    return null;
  }

  return (
    <ScoreRenderer
      score={score}
      defaultFont="Bravura"
      fontManager={fontManager}
    />
  );
}
```

## Documentation

| Entry point                 | Page                                     | Contents                                                           |
| --------------------------- | ---------------------------------------- | ------------------------------------------------------------------ |
| `vexflow-native/state`      | [docs/state.md](docs/state.md)           | Score model: staves, measures, voices, pitches, attachments, meter |
| `vexflow-native/renderer`   | [docs/renderer.md](docs/renderer.md)     | `ScoreRenderer` props, layout contract, per-item hooks             |
| `vexflow-native/musicxml`   | [docs/musicxml.md](docs/musicxml.md)     | `parseMusicXmlToScore` coverage and limitations                    |
| `vexflow-native/percussion` | [docs/percussion.md](docs/percussion.md) | One-line staff, sticking, flams, drags, accents, ghost notes       |
| `vexflow-native`            | [docs/canvas.md](docs/canvas.md)         | `VexflowCanvas` and the recording layer                            |

Generate the API reference from the TypeScript sources with `yarn docs:api`
(output in `docs/api/`, not committed).

## Contributing

- [Development workflow](CONTRIBUTING.md#development-workflow)
- [Sending a pull request](CONTRIBUTING.md#sending-a-pull-request)
- [Code of conduct](CODE_OF_CONDUCT.md)

Before sending changes run `yarn lint:fix`, `yarn format`, `yarn typecheck`,
`yarn test` and `yarn prepare` (builds `lib/`). Public API changes update the
matching `docs/` page in the same change.

## License

MIT
