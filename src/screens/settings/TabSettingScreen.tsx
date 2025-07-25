import { useEffect, useState } from "react"
import { SafeAreaView, View } from "react-native"
import { useSelector } from "react-redux"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import BitzTrackInfo from "@modules/BitzTrackInfo"
import { ChevronRightIcon } from "@assets/icons"
import { Button, CustomText } from "@components"
import { MainStackParamList, TabSettingScreenProps } from "@navigations/types"
import { boostActions, deleteCredentials, getMnemonic, poolActions, socketActions, stakeActions, walletActions } from "@store/actions"
import { Colors } from "@styles"
import { store } from "@store/index"
import { RootState } from "@store/types"
import { useNavigation } from "@react-navigation/native"
import { getAPILevel } from "@helpers"

export default function TabSettingScreen({ navigation }: TabSettingScreenProps) {
    const wallet = useSelector((state: RootState) => state.wallet)

    const [version, setVersion] = useState<string | null>(null);
    const stackNav = useNavigation<NativeStackNavigationProp<MainStackParamList>>()

    useEffect(() => {
        BitzTrackInfo.getVersionName()
        .then(setVersion)
        .catch(error => {
            console.error('Failed to get version:', error);
            setVersion('Unknown');
        });
    }, []);

    useEffect(() => {
        if (!wallet.publicKey) {
            stackNav.reset({
                index: 0,
                routes: [{ name: 'Start' }]
            });
        }
    }, [wallet.publicKey])
    
    return (
        <SafeAreaView
            className="flex-1 bg-baseBg"
            style={{ paddingBottom: getAPILevel() > 34? 40 : 0 }}
        >
            <View className="flex-1">
                <Button
                    containerClassName="rounded-2xl mx-4 mb-2 mt-4"
                    className=" bg-baseComponent rouned-sm py-5 items-start"
                    textClassName="text-primary font-PlusJakartaSansSemiBold text-md"
                    title={
                        <View className="flex-row w-full justify-between items-center">
                            <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary">
                                Account Address
                            </CustomText>
                            <ChevronRightIcon
                                width={25} height={25}
                                color={Colors.primary}
                            />
                        </View>
                    }
                    onPress={() => navigation.navigate('Receive')}
                />
                {wallet.useMnemonic && <Button
                    containerClassName="rounded-2xl mx-4 mb-2"
                    className=" bg-baseComponent rouned-sm py-5 items-start"
                    textClassName="text-primary font-PlusJakartaSansSemiBold text-md"
                    title={
                        <View className="flex-row w-full justify-between items-center">
                            <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary">
                                Show Recovery Phrase
                            </CustomText>
                            <ChevronRightIcon
                                width={25} height={25}
                                color={Colors.primary}
                            />
                        </View>
                    }
                    onPress={async () => {
                        const mnemonic = await getMnemonic()
                        navigation.navigate('PrivateKey', {
                            importWallet: false, words: mnemonic, title: "Recovery Phrase"
                        })
                    }}
                />}
                {wallet.usePrivateKey && <Button
                    containerClassName="rounded-2xl mx-4 mb-6"
                    className=" bg-baseComponent rouned-sm py-5 items-start"
                    textClassName="text-primary font-PlusJakartaSansSemiBold text-md"
                    title={
                        <View className="flex-row w-full justify-between items-center">
                            <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary">
                                Show Private Key
                            </CustomText>
                            <ChevronRightIcon
                                width={25} height={25}
                                color={Colors.primary}
                            />
                        </View>
                    }
                    onPress={() => navigation.navigate('Receive')}
                />}
                <Button
                    containerClassName="rounded-2xl mx-4 mb-6"
                    className=" bg-baseComponent rouned-sm py-5 items-start"
                    textClassName="text-primary"
                    title={
                        <View className="flex-row w-full justify-between items-center">
                            <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary">
                                Rpc Url
                            </CustomText>
                            <ChevronRightIcon
                                width={25} height={25}
                                color={Colors.primary}
                            />
                        </View>
                    }
                    onPress={() => navigation.navigate("RPC")}
                />
                <Button
                    containerClassName="rounded-2xl mx-4"
                    className=" bg-baseComponent rouned-sm py-3 items-center"
                    textClassName="text-red-700"
                    title="Disconnect"
                    onPress={async () => {
                        store.dispatch(walletActions.clearWallet())
                        store.dispatch(boostActions.resetBoosts())
                        store.dispatch(poolActions.resetPool())
                        store.dispatch(stakeActions.resetStakes())
                        store.dispatch(socketActions.resetSockets())
                        await deleteCredentials()
                    }}
                />
                <View className="absolute bottom-[80px] text-center self-center">
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                        BitzTrack {version}
                    </CustomText>
                </View>
            </View>
        </SafeAreaView>
    )
}