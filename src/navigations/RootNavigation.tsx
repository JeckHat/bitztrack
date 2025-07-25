import { useEffect, useMemo } from 'react'
import { View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { twMerge } from 'tailwind-merge'
import { SystemBars } from 'react-native-edge-to-edge'
import { AccountLayout, MintLayout } from '@solana/spl-token'

import { LoadingModal } from '@components'
import { BottomModalProvider } from '@providers'
import { useEclipseSocket } from '@hooks'
import { getBoostConfigResult, getBoostResult, getProofResult, getStakeResult } from '@models'
import { RootState } from '@store/types'
import { boostActions, updateBalance, updateMintSupply, updateStakeThunk } from '@store/actions'
import { persistor, store } from '@store/index'
import MainNavigation from './MainNavigation'

export function RootNavigation() {
  const ui = useSelector((state: RootState) => state.ui)
  const url = useSelector((state: RootState) => state.config.rpcUrl)
  const socketAccounts = useSelector((state: RootState) => state.socket) ?? {}
  
  type AppDispatch = typeof store.dispatch
  const useAppDispatch = () => useDispatch<AppDispatch>()
  const dispatch = useAppDispatch()


  const accounts = useMemo(() => {
    return Object.keys(socketAccounts).map((key) => ({
      ...socketAccounts[key],
    }));
  }, [socketAccounts])

  useEclipseSocket(`wss://${url}`, accounts, (event) => {
    updateData(event)
  })

  async function updateData(event: { id: string, data: any }) {
    try {
      const sockets = event.id.split("-")
      const json = await JSON.parse(event.data.value.data)
      const buffer = Buffer.from(json[0], 'base64')
      switch(sockets[0]) {
        case "boost": {
          const boost = await getBoostResult(buffer)
          dispatch(boostActions.updateBoostRedux({
            boost: boost.toJSON(),
            boostAddress: sockets[1]
          }))
          dispatch(boostActions.updateAllRewards())
          break;
        }
        case "boostStake": {
          const stake = await getStakeResult(buffer)
          dispatch(boostActions.updateStakeRedux({
            stake: stake.toJSON(),
            stakeAddress: sockets[1],
            boostAddress: stake.boost ?? ""
          }))
          dispatch(boostActions.updateAllRewards())
          break;
        }
        case "boostProof": {
          const boostProof = await getProofResult(buffer)
          dispatch(boostActions.updateProofRedux({
            boostProof: boostProof.toJSON(),
            boostProofAddress: sockets[1]
          }))
          dispatch(boostActions.updateAllRewards())
          break;
        }
        case "boostConfig": {
          const boostConfig = await getBoostConfigResult(buffer)
          dispatch(boostActions.updateConfigRedux({
            boostConfig: boostConfig.toJSON(),
            boostConfigAddress: sockets[1]
          }))
          dispatch(boostActions.updateAllRewards())
          break;
        }
        case "stake": {
          const stake = await getStakeResult(buffer)
          dispatch(updateStakeThunk({
            address: sockets[1],
            stake: stake
          }))
          break;
        }
        case "mint": {
          const rawMint = MintLayout.decode(buffer.slice(0, 82))
          dispatch(updateMintSupply({
            mintAddress: sockets[1],
            mintAuthority: rawMint.mintAuthority.toBase58(),
            supply: rawMint.supply.toString(),
            decimals: rawMint.decimals,
            isInitialized: rawMint.isInitialized? 1 : 0,
            freezeAuthority: rawMint.freezeAuthority.toBase58(),
          }))
          break;
        }
        case "balance": {
          const accountBalance = AccountLayout.decode(buffer)
          dispatch(updateBalance({
            mintAddress: accountBalance.mint.toBase58(),
            amount: accountBalance.amount.toString(),
            ataAddress: sockets[1]
          }))
          break;
        }
      }
    } catch(error) {
      console.log("error", error)
    }
  }

  useEffect(() => {
    persistor.purge();
  }, [])
  
  return (
    <NavigationContainer>
      <View className={twMerge(`flex-1 bg-baseBg`, ui.classNameGlobal)}>
        <SystemBars
          hidden={{ statusBar: false, navigationBar: true }}
        />
        {/* <StatusBar
          className={'bg-baseBg'}
          // translucent={true}
          barStyle={'light-content'}
          animated={true}
        /> */}
        <BottomModalProvider>
          <MainNavigation />
          <LoadingModal show={ui.loading} />
        </BottomModalProvider>
      </View>
    </NavigationContainer>
  )
}
