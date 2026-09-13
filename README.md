# vexflow-native

React Native Skia bridge for rendering VexFlow music notation: a typed score
model, a `ScoreRenderer` component with scrolling, playhead and per-item
style overrides, a MusicXML importer, and a low-level canvas for drawing with
VexFlow directly.

## Installation

Install the library and its peer dependencies:

```sh
npm install vexflow-native react react-native vexflow @shopify/react-native-skia react-native-gesture-handler react-native-reanimated react-native-worklets
```

`ScoreRenderer` uses gesture handling and Reanimated worklets for scrolling,
so configure `react-native-gesture-handler`, `react-native-reanimated`, and
`react-native-worklets` as required by your React Native app.

Load a notation font with Skia; the `defaultFont` prop must match one of the
family names passed to `useFonts`.

## Quick start

```tsx
import { useMemo } from 'react';
import { useFonts } from '@shopify/react-native-skia';
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
