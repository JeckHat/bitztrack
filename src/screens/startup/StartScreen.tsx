import React, { useState } from 'react'
import { Image, SafeAreaView, View } from 'react-native'
import { Keypair } from '@solana/web3.js'
import { useDispatch } from 'react-redux'

import { StartNavigationProps } from '@navigations/types'
import { CustomText, CheckBox, Button, ModalButtonList, ModalImportAddress } from '@components'
import Images from '@assets/images'
import { useBottomModal } from '@hooks'
import { poolActions, saveCredentials, walletActions } from '@store/actions'
import { POOL_LIST } from '@constants'

export default function StartScreen({ navigation }: StartNavigationProps) {
  const [checkedTerm, setCheckedTerm] = useState(false)

  const { showModal, hideModal } = useBottomModal()

  const dispatch = useDispatch()

  function onCreateWallet() {
    navigation.navigate('PrivateKey', { importWallet: false, title: "Recovery Phrase", onNext: (navData) => {
      navData.navigate('BottomTab')
  } })
  }

  function updateMinerRedux(walletAddress: string) {
    Object.keys(POOL_LIST).forEach(poolId => {
      dispatch(poolActions.joinMinerToPool({
        poolId: poolId,
        walletAddress: walletAddress
      }))
    })
  }

  function onImportWallet() {
    showModal(
      <ModalButtonList
        buttons={[
          {
            text: 'Wallet Address',
            onPress: () => {
              showModal(
                <ModalImportAddress
                  onImport={(address) => {
                    dispatch(walletActions.setWallet({
                      address: address,
                      useMnemonic: false,
                      usePrivateKey: false,
                      allowTrx: false
                    }))
                    updateMinerRedux(address)
                    hideModal()
                    navigation.replace('BottomTab')
                  }}
                />
              )
            }
          },
          {
            text: 'Recovery Phrase',
            onPress: () => {
              navigation.navigate('PrivateKey', {
                importWallet: true, title: "Recovery Phrase", isSeedPhrase: true,
                onSubmit: async (keypair: Keypair, words?: string) => {
                  await saveCredentials(keypair, words)
                  dispatch(walletActions.setWallet({
                    address: keypair.publicKey?.toBase58(),
                    useMnemonic: true,
                    usePrivateKey: true,
                    allowTrx: true
                  }))
                  updateMinerRedux(keypair.publicKey?.toBase58())
                  navigation.replace('BottomTab')
                },
                onNext: (navigation) => {
                  navigation.replace('BottomTab')
                }
              })
              hideModal()
            }
          },
          {
            text: 'Private Key',
            onPress: () => {
              navigation.navigate('PrivateKey', {
                importWallet: true, title: "Private Key", isSeedPhrase: false,
                onSubmit: async (keypair: Keypair) => {
                  await saveCredentials(keypair)
                  dispatch(walletActions.setWallet({
                    address: keypair.publicKey?.toBase58(),
                    useMnemonic: false,
                    usePrivateKey: true,
                    allowTrx: true
                  }))
                  updateMinerRedux(keypair.publicKey?.toBase58())
                },
                onNext: (navigation) => {
                  navigation.replace('BottomTab')
                }
              })
              hideModal()
            }
          }
        ]}
      />
    )
  }
  
  return (
    <SafeAreaView className="flex-1 justify-center items-center bg-baseBg">
      <View className="flex-1 justify-center items-center">
        <View className="border-2 border-green-600 rounded-full w-min px-3 py-1 text-xs font-semibold mb-4 mt-8">
          <CustomText className="text-green-600 mx-auto text-nowrap font-PlusJakartaSansSemiBold">
            PowPow
          </CustomText>
        </View>
        <CustomText className="font-PlusJakartaSansBold text-primary text-4xl">
          Proof of Work
        </CustomText>
        <CustomText className="text-lowEmphasis font-PlusJakartaSansBold text-4xl mb-8">
          On Eclipse
        </CustomText>
        <Image
          className="w-48 h-48"
          source={Images.BitzTrackText}
        />
        <CustomText className='text-lowEmphasis font-PlusJakartaSansItalic mx-8 mt-4 text-center'>
          {`Tracking your collecting performance. \nAnalyze the flow, optimize the rewards.`}
        </CustomText>
      </View>
      <View className="my-8 w-full px-[8%]">
        <CheckBox
          value={checkedTerm}
          onChange={setCheckedTerm}
          containerClassName='mx-2 w-full items-center'
          label={
            <CustomText className='font-PlusJakartaSansSemiBold text-primary text-lg'>
              I agree to the <CustomText className='text-green-600 underline'>Term of Service</CustomText>
            </CustomText>
          }
        />
        <Button
          containerClassName='rounded-full my-5'
          disabled={!checkedTerm}
          title="Create a new Wallet"
          onPress={onCreateWallet}
        />
        <View className='px-4 items-center mb-8'>
          <CustomText
            className={`font-PlusJakartaSansBold text-primary text-lg text-center ${!checkedTerm && "opacity-35"}`}
            disabled={!checkedTerm}
            onPress={onImportWallet}
          >
            I already have a wallet
          </CustomText>
        </View>
      </View>
    </SafeAreaView>
  )
}
