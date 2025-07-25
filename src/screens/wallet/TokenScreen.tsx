import { useEffect, useState } from 'react'
import { Image, RefreshControl, SafeAreaView, View, ScrollView, TouchableOpacity } from 'react-native'
import { useSelector } from 'react-redux'
import { twMerge } from 'tailwind-merge'

import { ButtonIcon, CustomText, HeaderButton, LineChart, SkeletonLoader } from '@components'
import { Colors, Fonts } from '@styles'
import { ChevronLeftIcon, ReceiveIcon, SendIcon, StakeIcon, SwapIcon } from '@assets/icons'
import Images from '@assets/images'
import { delimiterFormat } from '@helpers'
import { createStackOptions, TokenNavigationProps } from '@navigations/types'
import { GECKO_TERMINAL_PRICE, TOKENLIST } from '@constants'
import { RootState } from '@store/types'
import { getBalance } from '@services/eclipse'
import { isUseKeypair } from '@providers'

export default function TokenScreen({ navigation, route }: TokenNavigationProps) {

    const walletAddress = useSelector((state: RootState) => state.wallet.publicKey) ?? ""

    const token = TOKENLIST[route.params?.mintAddress ?? ""]
    const [data, setData] = useState({
        loading: true,
        price: 0,
        balance: 0
    })
    const [range, setRange] = useState('1D');
    const [chartData, setChartData] = useState({
        '1H': [] as number[],
        '1D': [] as number[],
        '1W': [] as number[],
        '1M': [] as number[],
    })

    useEffect(() => {
        fetchToken()
    }, [])
    
    async function fetchToken() {
        const mintAddress = route.params?.mintAddress ?? ""
        setData({ ...data, loading: true })
        try {
            const [balance, price] = await Promise.all([
                getBalance(walletAddress, mintAddress).then((res) => res),
                fetch(`${GECKO_TERMINAL_PRICE}${mintAddress}`).then((res) => res.json().then((json) => {
                    return parseFloat(json.data[mintAddress].price)
                }).catch(() => 0))
            ])
            setData({
                price: price,
                balance: balance.amount,
                loading: false
            })
            fetchAllCharts(price)
            return { balance: balance || 0, price: price || 0, loading: false }
        } catch(error) {
            return null
        }
    }

    function getTimeframeParams() {
        const curDate = new Date()
        curDate.setSeconds(0)
        curDate.setMilliseconds(0)
        const now = curDate.getTime()
        return {
            "1H": {
                interval: "1_MINUTE",
                from: now - 60 * 60 * 1000,
                to: now
            },
            "1D": {
                interval: "15_MINUTE",
                from: now - 24 * 60 * 60 * 1000,
                to: now
            },
            "1W": {
                interval: "15_MINUTE",
                from: now - 7 * 24 * 60 * 60 * 1000,
                to: now
            },
            "1M": {
                interval: "1_HOUR",
                from: now - 30 * 24 * 60 * 60 * 1000,
                to: now
            },
        };
    }

    function getIntervalMs(intervalStr: string) {
        switch (intervalStr) {
            case "1_MINUTE": return 60 * 1000;
            case "5_MINUTE": return 5 * 60 * 1000;
            case "15_MINUTE": return 15 * 60 * 1000;
            case "30_MINUTE": return 30 * 60 * 1000;
            case "1_HOUR": return 60 * 60 * 1000;
            case "1_DAY": return 24 * 60 * 60 * 1000;
            default: throw new Error("Unsupported interval");
        }
    }

    async function fetchAllCharts(price: number) {
        const timeframes = getTimeframeParams();
        
        const baseUrl = `https://datapi.jup.ag/v2/charts/${route.params?.mintAddress}`;
        
        const promises = Object.entries(timeframes).map(async ([key, params]) => {
            const { interval, from, to } = params;
            const intervalMs = getIntervalMs(interval);
            const candles = Math.floor((to - from) / intervalMs);
            const url = `${baseUrl}?interval=${params.interval}&baseAsset=${route.params?.mintAddress}&from=${params.from}&to=${params.to}&candles=${candles}&type=price`;
            const response = await fetch(url);
            const resData = await response.json();
            
            const lastChart = resData.candles[resData.candles.length - 1]
            const lastPrice = (lastChart.high + lastChart.low + (2 * lastChart.close))
            const data = resData.candles.map((candle: { high: number, low: number, close: number }) => {
                const currentPrice = (candle.high + candle.low + (2 * candle.close))
                return Math.round(((currentPrice / lastPrice) * price) * Math.pow(10, 3)) / Math.pow(10, 3)
            })
            return { key, data };
        });
        
        const results = await Promise.all(promises);
        
        const chartDataMap = {
            '1H': [] as number[],
            '1D': [] as number[],
            '1W': [] as number[],
            '1M': [] as number[],
        };
        results.forEach(({ key, data }) => {
            chartDataMap[key as keyof typeof chartData] = data;
        });

        setChartData(chartDataMap)
    }

    const isLP = false
    return (
        <SafeAreaView className="flex-1 bg-baseBg">
            <ScrollView
                refreshControl={<RefreshControl refreshing={false} onRefresh={() => fetchToken()}/>}
                contentContainerClassName="grow-1" stickyHeaderIndices={[0]}
            >
                <View className="flex-1">
                    {data.loading && <SkeletonLoader className='w-36 h-14 self-center mt-2'/>}
                    {!data.loading && <CustomText className='text-primary text-4xl font-PlusJakartaSansBold text-center mt-2'>
                        ${delimiterFormat(data.price.toFixed(3))}
                    </CustomText>}
                    {chartData[range as keyof typeof chartData].length > 0 && <CustomText
                        className={twMerge('text-md font-PlusJakartaSansBold text-center mb-4', (chartData[range as keyof typeof chartData]?.[0]) - data.price > 0? 'text-red-400' : 'text-green-400')}
                    >
                        {(chartData[range as keyof typeof chartData]?.[0]) - data.price > 0 ? "-" : "+"} ${Math.abs((chartData[range as keyof typeof chartData]?.[0]) - data.price).toFixed(5)}
                    </CustomText>}
                    {chartData[range as keyof typeof chartData].length <= 0 && <View className="bg-baseBg items-center w-full h-80 py-2" />}
                    {chartData[range as keyof typeof chartData].length > 0 && <View className="bg-baseBg items-center py-2">
                        <View className='w-full py-4'>
                            {range === '1H' && <LineChart data={chartData['1H']} />}
                            {range === '1D' && <LineChart data={chartData['1D']} />}
                            {range === '1W' && <LineChart data={chartData['1W']} />}
                            {range === '1M' && <LineChart data={chartData['1M']} />}
                        </View>
                        <View className="flex-row w-full items-center justify-evenly mt-4">
                            {Object.keys(chartData).map((btnRange, idx) => (
                                <TouchableOpacity
                                    key={`chart-button-token-${idx}`}
                                    className={twMerge('px-4 pb-1 pt-[1px] rounded-lg', range === btnRange? 'bg-gray-800' : 'bg-baseBg')}
                                    onPress={() => setRange(btnRange)}
                                >
                                    <CustomText
                                        className={twMerge(`font-PlusJakartaSansSemiBold text-md`, range === btnRange ? 'text-gold' : 'text-gray-400')}
                                    >
                                        {btnRange}
                                    </CustomText>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>}
                    <View className="flex-row mt-6 justify-center gap-x-6 mb-8">
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
                                    // call function
                                }
                            }}
                        />
                        <ButtonIcon
                            title="Swap"
                            icon={<SwapIcon width={24} height={24} color={Colors.primary}/>}
                            onPress={() => {
                                if(isUseKeypair()) {
                                    // call function
                                }
                            }}
                        />
                        {token.boostAddress && <ButtonIcon
                            title="Stake"
                            icon={<StakeIcon width={24} height={24} color={Colors.primary}/>}
                            onPress={() => {
                                if(isUseKeypair()) {
                                    navigation.navigate('DepositStake', {
                                        boost: token.boostAddress
                                    })
                                }
                                
                            }}
                        />}
                    </View>
                    <CustomText className='text-primary font-PlusJakartaSans mx-2'>
                        Your Balance
                    </CustomText>
                    <View className="flex-row items-center justify-between p-4 m-2 rounded-2xl bg-gray-800">
                        <View className="flex-row items-center">
                            {!token.isLP && <View className="h-12 w-12 mr-3">
                                <Image
                                    className="h-12 w-12 rounded-full"
                                    source={Images[token.image as keyof typeof Images]}
                                />
                            </View>}
                            {token.isLP && <View className="h-12 w-12 mr-3 items-center justify-center">
                                <Image
                                    className="h-10 w-10 rounded-full absolute left-3"
                                    source={Images[token.pairImage as keyof typeof Images]}
                                />
                                <Image
                                    className="h-10 w-10 mr-3 rounded-full"
                                    source={Images[token.image as keyof typeof Images]}
                                />
                            </View>}
                            <View className="mb-1">
                                <CustomText className="text-primary font-PlusJakartaSansBold text-md">{token.name}</CustomText>
                                {data.loading && <SkeletonLoader className="mt-1 bg-gray-700 rounded-lg w-16 h-[16px]" />}
                                {!data.loading && <CustomText className="text-gray-200 font-PlusJakartaSans text-sm">${delimiterFormat(data.price.toFixed(3))}</CustomText>}
                            </View>
                        </View>
                        <View className="items-end mb-1">
                            {data.loading && <SkeletonLoader className="mb-1 bg-gray-700 rounded-lg w-20 h-[18px]" width={80} height={18} />}
                            {!data.loading && <CustomText className="text-primary font-PlusJakartaSansBold text-md">{data.balance}</CustomText>}
                            {data.loading && <SkeletonLoader className="w-20 h-4" />}
                            {!data.loading && <CustomText className="text-gray-200 font-PlusJakartaSans text-sm">${delimiterFormat((data.balance * data.price).toFixed(2))}</CustomText>}
                        </View>
                    </View>
                    
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

export const screenOptions = createStackOptions<'Token'>(({ navigation, route }) => {
    const token = TOKENLIST[route.params?.mintAddress ?? ""]
    return {
        headerTitle: () => (
            <View className='flex-row items-center'>
                <Image className='h-8 w-8 mr-2 rounded-full' source={Images[token.image as keyof typeof Images]}/>
                <CustomText className='text-primary font-PlusJakartaSansSemiBold text-xl'>{`${token?.name}`}</CustomText>
            </View>
        ),
        headerTintColor: Colors.primary,
        headerTitleStyle: {
            fontFamily: Fonts.PlusJakartaSansSemiBold,
            fontSize: 18,
        },
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: Colors.baseBg },
        headerLeft: () => (
            <HeaderButton
                className='mr-5 mb-2'
                icon={<ChevronLeftIcon width={24} height={24} color={Colors.primary}/>}
                onPress={() => navigation.goBack() }
            />
        )
    }
})
