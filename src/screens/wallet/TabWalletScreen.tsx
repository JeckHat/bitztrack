import { useCallback, useRef, useState } from "react";
import { Image, ImageSourcePropType, RefreshControl, SafeAreaView, ScrollView, TouchableHighlight, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useDispatch, useSelector } from "react-redux";

import { ButtonIcon, CustomText, SkeletonLoader } from "@components";
import Images from "@assets/images";
import { ChevronRightIcon, ReceiveIcon, SendIcon, StakeIcon, SwapIcon } from "@assets/icons";
import { Colors } from "@styles";
import { delimiterFormat, getAPILevel } from "@helpers";
import { COINGECKO_API, GECKO_TERMINAL_PRICE, TokenInfo, TOKENLIST } from "@constants";
import { RootState } from "@store/types";
import { getBalance, getTokenPrice } from "@services/eclipse";
import { TabWalletScreenProps } from "@navigations/types";
import { isUseKeypair } from "@providers";
import { useBottomModal } from "@hooks";
import { SendModalNavigation } from "@navigations/ModalNavigation";
import { socketActions, tokenActions } from "@store/actions";

interface TokenBalance {
    mintAddress: string
    mint: string
    balance: number
    price: number
    loading: boolean
}

export default function TabWalletScreen({ navigation }: TabWalletScreenProps) {
    const [total, setTotal] = useState({
        balance: 0,
        loading: true
    })
    const [tokenData, setTokenData] = useState<Record<string, TokenBalance | null>>(
        Object.entries(TOKENLIST).reduce((acc, [key]) => {
            acc[key] = {
                mintAddress: "",
                balance: 0,
                price: 0.0,
                mint: key,
                loading: true
            }
            return acc;
        }, {} as Record<string, TokenBalance>)
    )
    const cacheRef = useRef<Record<string, { mintAddress: string, balance: number, price: number, loading: boolean } | null>>({})

    const walletAddress = useSelector((state: RootState) => state.wallet.publicKey) ?? ""
    const reduxToken = useSelector((state: RootState) => state.token)
    const reduxSocket = useSelector((state: RootState) => state.socket)

    const dispatch = useDispatch()

    const { showModal, hideModal } = useBottomModal()

    useFocusEffect(
        useCallback(() => {
            loadData(true);
        }, [])
    )

    async function onRefresh() {
        setTotal(prev => {
            return { ...prev, loading: true }
        })
        loadData(true)
    }
    
    async function loadData(forceRefresh = false) {
        try {
            const results = await Promise.all(
                Object.keys(TOKENLIST).map(async (token) => {
                    if(cacheRef.current[token] && !forceRefresh) {
                        return cacheRef.current[token]
                    }
                    const data = await fetchToken(token, TOKENLIST[token]?.geckoPriceAddress)
                        cacheRef.current[token] = data
                        return {
                            ...TOKENLIST[token],
                            ...data
                        }
                })
            )
            const newData: Record<string, TokenBalance | null> = Object.entries(TOKENLIST).reduce(
                (acc, [key], index) => {
                    acc[key] = {
                        mintAddress: results[index].mintAddress ?? "",
                        balance: results[index].balance ?? 0,
                        price: results[index].price ?? 0.0,
                        loading: results[index]?.loading ?? false,
                        mint: key,
                    }
                    return acc
                }, 
            {} as Record<string, TokenBalance>)

            const total = Object.values(newData)
                .filter((token) => token)
                .reduce((sum, token) => sum + ((token?.balance ?? 0) * (token?.price ?? 0)), 0)

            setTokenData(newData)
            setTotal({ balance: total, loading: false })

        } catch(error) {
            return null
        }
    }

    async function fetchToken(mintAddress: string, geckoPrice?: string) {
        try {
            const [balance, price] = await Promise.all([
                getBalance(walletAddress, mintAddress).then((res) => res),
                getTokenPrice(mintAddress)
            ])
            if (!reduxToken[mintAddress]) {
                dispatch(tokenActions.addToken({
                    mintAddress: mintAddress,
                    token: {
                        mint: {
                            mintAuthority: "",
                            supply: "0",
                            decimals: balance.decimals,
                            isInitialized: 0,
                            freezeAuthority: "",
                            stakeAddresses: []
                        },
                        balance: {
                            ataAddress: balance.address,
                            amount: balance.amount.toString(),
                            amountUI: balance.amountUI,
                            price: price,
                            mintAddress: mintAddress
                        }
                    }
                }))
            }

            if (!reduxSocket[balance.address]) {
                dispatch(socketActions.updateSocketAccount({
                    type: 'balance',
                    address: balance.address
                }))
            }
            if(reduxToken[mintAddress]) {
                dispatch(tokenActions.updateBalance({
                    mintAddress: mintAddress,
                    amount: (parseFloat(balance?.amountUI ?? 0) * Math.pow(10, TOKENLIST[mintAddress].decimals)).toString(),
                    amountUI: balance.amountUI.toString(),
                    price: price
                }))
            }
            return { mintAddress: mintAddress, balance: parseFloat(balance.amountUI) || 0, price: price || 0, loading: false }
        } catch(error) {
            return null
        }
    }

    return (
        <SafeAreaView
            style={{ paddingBottom: getAPILevel() > 34? 40 : 0 }}
            className="flex-1 bg-baseBg px-2"
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh}/>}
                contentContainerClassName="grow-1" stickyHeaderIndices={[0]}
            >
                <View className="items-center pt-4 mb-2 bg-baseBg">
                    {total.loading && <SkeletonLoader
                        className="rounded-xl bg-gray-900 w-40 h-12"
                        colors={["#111827", "#1f2937", "#111827"]}
                    />}
                    {!total.loading && <CustomText className="font-PlusJakartaSansBold text-5xl text-primary mb-2 text-center">
                        {`$${delimiterFormat(total.balance.toFixed(2))}`}
                    </CustomText>}
                    <View className="flex-row mt-6 w-[95%] justify-between">
                        <ButtonIcon
                            title="Receive"
                            icon={<ReceiveIcon width={24} height={24} color={Colors.primary}/>}
                            onPress={() => navigation.navigate('Receive')}
                        />
                        <ButtonIcon
                            title="Send"
                            icon={<SendIcon width={24} height={24} color={Colors.primary}/>}
                            onPress={() => {
                                if(isUseKeypair()) {
                                    // showModal(
                                    //     <ListToken
                                    //         hideModal={hideModal}
                                    //         tokenData={tokenData}
                                    //         onSelectToken={(mintAddress) => {
                                    //             navigation.navigate('Send', { mintAddress: mintAddress })
                                    //         }}
                                    //     />
                                    // )

                                    // navigation.navigate('Swap')
                                    // call function
                                }
                            }}
                        />
                        <ButtonIcon
                            title="Swap"
                            icon={<SwapIcon width={24} height={24} color={Colors.primary}/>}
                            onPress={() => {
                                if(isUseKeypair()) {
                                    navigation.navigate('Swap')
                                    // showModal(
                                    //     <SendModalNavigation tokenData={tokenData} />
                                    //     // <View style={{ backgroundColor: 'blue', width: '100%', height: 400}} />
                                    // )
                                    // call function
                                }
                            }}
                        />
                        <ButtonIcon
                            title="Stake"
                            icon={<StakeIcon width={24} height={24} color={Colors.primary}/>}
                            onPress={() => navigation.navigate('TabStake')}
                        />
                    </View>
                    <View className="flex-row w-full justify-between items-center mb-2 mt-4 px-4">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">Tokens</CustomText>
                        <ChevronRightIcon
                            width={24}
                            height={24}
                            color={Colors.primary}
                        />
                    </View>
                </View>
                <View className="flex-1">
                    {Object.keys(TOKENLIST).map((token, idx) => {
                        if(tokenData[token]?.balance !== 0 || (tokenData[token].loading && TOKENLIST[token].isAlways)) {
                            return (
                                <TokenItem
                                    key={`walletscreen-${token}`}
                                    tokenLogo={Images[TOKENLIST[token]?.image as keyof typeof Images]}
                                    secondTokenLogo={Images[TOKENLIST[token]?.pairImage as keyof typeof Images]}
                                    tokenName={TOKENLIST[token]?.name}
                                    tokenPrice={reduxToken?.[tokenData[token]?.mintAddress ?? ""]?.balance?.price ?? 0.0}
                                    tokenBalance={parseFloat(reduxToken?.[tokenData[token]?.mintAddress ?? ""]?.balance?.amountUI  ?? 0)}
                                    isLP={TOKENLIST[token]?.isLP}
                                    mintAddress={token}
                                    loading={tokenData[token]?.loading}
                                    priceLoading={tokenData[token]?.loading}
                                    navigate={navigation.navigate}
                                />
                            )
                        }
                    })}
                </View>
                
            </ScrollView>
        </SafeAreaView>
    )
}

interface TokenItemProps {
    tokenLogo?: ImageSourcePropType
    secondTokenLogo?: ImageSourcePropType
    tokenName?: string
    tokenPrice: number
    tokenBalance: number
    isLP?: boolean
    mintAddress: string
    priceLoading?: boolean
    loading?: boolean
    navigate: any
} 

function TokenItem(props: TokenItemProps){
    const {
        tokenLogo, secondTokenLogo, tokenName, tokenBalance, tokenPrice, mintAddress, isLP, loading, priceLoading, navigate
    } = props
    return (
        <TouchableWithoutFeedback onPress={() => navigate('StartToken', { mintAddress: mintAddress })}>
            <View className="flex-row items-center justify-between p-4 m-2 rounded-2xl bg-gray-800">
                <View className="flex-row items-center">
                    {!isLP && <View className="h-12 w-12 mr-3">
                        <Image
                            className="h-12 w-12 rounded-full bg-primary"
                            source={tokenLogo}
                        />
                    </View>}
                    {isLP && <View className="h-12 w-12 mr-3 items-center justify-center">
                        <Image
                            className="h-10 w-10 rounded-full absolute left-3"
                            source={secondTokenLogo}
                        />
                        <Image
                            className="h-10 w-10 mr-3 rounded-full"
                            source={tokenLogo}
                        />
                    </View>}
                    <View className="mb-1">
                        <CustomText className="text-primary font-PlusJakartaSansBold text-md">{tokenName}</CustomText>
                        {priceLoading && <SkeletonLoader className="mt-1 bg-gray-700 rounded-lg w-16 h-[16px]" />}
                        {!priceLoading && <CustomText className="text-gray-200 font-PlusJakartaSans text-sm">${delimiterFormat(tokenPrice.toFixed(2))}</CustomText>}
                    </View>
                </View>
                <View className="items-end mb-1">
                    {loading && <SkeletonLoader className="mb-1 bg-gray-700 rounded-lg w-20 h-[18px]" width={80} height={18} />}
                    {!loading && <CustomText className="text-primary font-PlusJakartaSansBold text-md">{tokenBalance}</CustomText>}
                    {priceLoading && <SkeletonLoader className="w-20 h-4" />}
                    {!priceLoading && <CustomText className="text-gray-200 font-PlusJakartaSans text-sm">${delimiterFormat((tokenBalance * tokenPrice).toFixed(5))}</CustomText>}
                </View>
            </View>
        </TouchableWithoutFeedback>
    )
}

function ListToken(props: { hideModal: () => void, tokenData: any, onSelectToken: (mint: String) => void }) {
    const tokenList = Object.keys(props.tokenData).filter((token) => props.tokenData[token]?.balance !== 0)
    return (
        <View className="h-[90%] bg-baseBg pt-3 rounded-t-2xl">
            <View className="items-center mr-4 mb-4">
                <CustomText className="text-primary text-xl mb-1 font-PlusJakartaSansBold">
                    Select Token
                </CustomText>
            </View>
            <ScrollView>
                <TouchableOpacity>
                    <TouchableWithoutFeedback>
                        <View>
                            {tokenList.map((token, idx) => (
                                <TouchableHighlight
                                    key={`List-token-send-${idx}`}
                                    onPress={() => {
                                        props.onSelectToken(token)
                                        props.hideModal()
                                    }}
                                >
                                <View className="flex-row items-center px-3 mb-2" >
                                    <Image
                                        className="w-10 h-10 rounded-full mr-2"
                                        source={Images[TOKENLIST[token].image as keyof typeof Images]}
                                    />
                                    <View className="flex-1 mb-1">
                                        <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                                            {TOKENLIST[token].name}
                                        </CustomText>
                                        <CustomText className="text-primary text-sm font-PlusJakartaSans">
                                            {`${props.tokenData[token]?.balance ?? 0} ${TOKENLIST[token].ticker}`}
                                        </CustomText>
                                    </View>
                                    <CustomText className="font-LatoBold text-md text-primary">
                                        ${delimiterFormat(((props.tokenData[token]?.price ?? 0.0) * (props.tokenData[token]?.balance ?? 0)).toFixed(5))}
                                    </CustomText>
                                </View>
                                </TouchableHighlight>
                            ))}
                    </View>
                    </TouchableWithoutFeedback>
                </TouchableOpacity>
            </ScrollView>
        </View>
    )
}

export const screenOptions = () => {
    return {
        headerTitle: 'Wallet',
        
    }
}