import type { LinkingOptions } from '@react-navigation/native';

import type { ExampleStackParamList } from './ExampleStackParamList';

export const linking: LinkingOptions<ExampleStackParamList> = {
  prefixes: ['vexflownative://'],
  config: {
    initialRouteName: 'Main',
    screens: {
      Main: '',
      Benchmark: 'bench',
      ParityGallery: 'parity',
      ParityCase: 'parity/:case',
    },
  },
};
