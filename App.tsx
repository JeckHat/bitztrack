import './global.css'
import 'react-native-get-random-values'
import 'react-native-quick-crypto'
import React from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { Buffer } from 'buffer'
import QuickCrypto from 'react-native-quick-crypto'
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootNavigation } from '@navigations/RootNavigation'
import { persistor, store } from '@store/index'

global.Buffer = Buffer

// 2) Monkey-patch Uint8Array supaya punya metode-metode Buffer yang dipakai buffer-layout
;(() => {
  const p = Uint8Array.prototype as any
  if (typeof p.readUIntLE !== 'function') p.readUIntLE  = Buffer.prototype.readUIntLE
  if (typeof p.readUIntBE !== 'function') p.readUIntBE  = Buffer.prototype.readUIntBE
  if (typeof p.readIntLE  !== 'function') p.readIntLE   = Buffer.prototype.readIntLE
  if (typeof p.readIntBE  !== 'function') p.readIntBE   = Buffer.prototype.readIntBE
  if (typeof p.slice     !== 'function') p.slice        = Buffer.prototype.slice
})()

// @ts-expect-error subtle isn't fully implemented and Cryptokey is missing
global.crypto = QuickCrypto

export default function App() {
  return (
    <GestureHandlerRootView>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <RootNavigation />
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  )
}
