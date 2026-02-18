import type { HybridObject } from 'react-native-nitro-modules'

export interface Database extends HybridObject<{ ios: 'c++'; android: 'c++' }> {
  readonly isOpen: boolean
  close(): void
}
