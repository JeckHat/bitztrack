import { useEffect, useRef, useState } from "react";
import { Image, TouchableHighlight, View, SafeAreaView, ScrollView, RefreshControl } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { FetcherRecords, Market, Network, Pair, SimulationTwoHopResult } from "@invariant-labs/sdk-eclipse";
import { FEE_TIERS, fromFee } from "@invariant-labs/sdk-eclipse/lib/utils";
import { parseTick, Tick, Tickmap } from "@invariant-labs/sdk-eclipse/lib/market";
import { useDispatch, useSelector } from "react-redux"; 
import { PublicKey } from "@solana/web3.js";
import debounce  from 'lodash/debounce'
import { BN } from '@coral-xyz/anchor'
import { BottomSheetFlatList } from "@gorhom/bottom-sheet";

import { KeypairWallet } from "@models";
import { getKeypair, tokenActions } from "@store/actions";
import { RootState } from "@store/types";
import { delimiterFormat, formatNumberWithoutSuffix, formatNumberWithSuffix, printBN, shortenAddress } from "@helpers";
import { ensureAtaExists, getPools, getTickmapsFromPools, getTicksFromAddresses, getTokenPrice, getTwoHopSwapData, handleSimulate, handleSimulateWithHop, hasLuts, PoolWithAddress } from "@services/eclipse";
import { TOKENLIST } from "@constants";
import { CircularTimer, CustomText, HeaderButton, Input, SkeletonLoader } from "@components";
import Images from "@assets/images";
import { createStackOptions } from "@navigations/types";
import { Colors, Fonts } from "@styles";
import { ChevronDownIcon, ChevronLeftIcon, RouteArrowLong, RouteArrowShort, SettingLineIcon } from "@assets/icons";
import { getConnection, getWalletAddress } from "@providers";
import { useBottomModal } from "@hooks";

const NativeStack = createNativeStackNavigator()

interface SimulationResult {
    amountOut: BN
    poolIndex: number
    AmountOutWithFee: BN
    estimatedPriceAfterSwap: BN
    minimumReceived: BN
    priceImpact: BN
    error: string[]
}

interface SimulationWithHopResult {
    simulation: SimulationTwoHopResult | null
    route: [Pair, Pair] | null
    error: boolean
}

interface SimulateResult {
    tokenFrom: string
    tokenTo: string
    tokenBetween: string | null
    firstFeePercent: number
    secondFeePercent: number
    firstAmount: string
    secondAmount: string | null
    priceImpact: string
    exchangeRate: string | number
}

const DURATION = 60

export default function SwapScreen() {
    const [tokenFrom, setTokenFrom] = useState<PublicKey>(new PublicKey("So11111111111111111111111111111111111111112")) //So11111111111111111111111111111111111111112
    const [tokenTo, setTokenTo] = useState<PublicKey>(new PublicKey("AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE")) //64mggk2nXg6vHC1qCdsZdEFzd5QGN4id54Vbho4PswCF
    // const [tokenFrom, setTokenFrom] = useState<PublicKey>(new PublicKey("64mggk2nXg6vHC1qCdsZdEFzd5QGN4id54Vbho4PswCF")) //AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE
    // const [tokenTo, setTokenTo] = useState<PublicKey>(new PublicKey("AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE")) //64mggk2nXg6vHC1qCdsZdEFzd5QGN4id54Vbho4PswCF

    const [amountOut, setAmountOut] = useState("")
    const [amountIn, setAmountIn] = useState("")
    const [timer, setTimer] = useState({
        countdown: DURATION,
        run: false
    })
    const [pools, setPools] = useState<PoolWithAddress[]>([])
    const [poolTicks, setPoolTicks] = useState<{[key in string]: Tick[]}>({})
    const [tickmaps, setTickmaps] = useState<{[x: string]: Tickmap}>({})
    const [simulation, setSimulation] = useState<SimulateResult | null>()
    const [accountData, setAccountData] = useState<FetcherRecords | null>()
    const [initLoading, setInitLoading] = useState(true)
    const [loading, setLoading] = useState(false)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)
    const debounceRef = useRef<ReturnType<typeof debounce> | null>(null)

    const reduxToken = useSelector((state: RootState) => state.token)

    const dispatch = useDispatch()

    const { showModal, hideModal } = useBottomModal()

    useEffect(() => {
        if (!tokenFrom.toBase58() || !tokenTo.toBase58()) return
        loadInitData()
        return () => {
            if(intervalRef.current){
                clearInterval(intervalRef.current);
            }
        }
    }, [tokenFrom.toBase58(), tokenTo.toBase58()])

    useEffect(() => {
        if(!timer.run) {
            return
        }
        if(timer.countdown <= 0){
            if(intervalRef.current){
                clearInterval(intervalRef.current);
            }
            loadData()
            return
        }
        if(!timer.run){
            if(intervalRef.current){
                clearInterval(intervalRef.current);
            }
            return
        }
        
        intervalRef.current = setInterval(() => {
            if (timer.countdown > 0) {
                setTimer({ 
                    ...timer,
                    countdown: timer.countdown - 1
                })
            }
        }, 1000)
        return () => {
            if(intervalRef.current){
                clearInterval(intervalRef.current);
            }
        }
    }, [timer])

    useEffect(() => {
        debounceRef.current = debounce((amount) => {
            if (!amount || parseFloat(amount) === 0 || isNaN(parseFloat(amount)) || !accountData || !tokenFrom || !tokenTo) {
                return
            }
            updateSwapSimulation(amount, accountData)
        }, 300)
    }, [accountData, tokenFrom.toBase58(), tokenTo.toBase58()])

    async function onChangeAmountIn(amount: string) {
        setAmountIn(amount)
        debounceRef.current?.(amount)
    }

    async function loadInitData() {
        setInitLoading(true)
        try {
            const keypair = await getKeypair()
            const market = Market.build(
                Network.MAIN,
                new KeypairWallet(keypair),
                getConnection(),
                new PublicKey("iNvTyprs4TX8m6UeUEkeqDFjAL9zRCRWcexK9Sd4WEU")
            )
            const pairs = FEE_TIERS.map(fee => new Pair(tokenFrom, tokenTo, fee))
            const pools = await getPools(pairs, market)

            const tickmaps = await getTickmapsFromPools(pools, market)

            let poolTicks: { [key in string]: Tick[] } = {}

            const tickAddresses: PublicKey[][] = pools.map(pool => {
                const isXtoY = tokenFrom.equals(pool.tokenX)
                const pair = new Pair(tokenFrom, tokenTo, {
                    fee: pool.fee,
                    tickSpacing: pool.tickSpacing
                })
        
                return market.findTickAddressesForSwap(
                    pair,
                    pool,
                    tickmaps[pool.tickmap.toBase58()],
                    isXtoY,
                    hasLuts(pool.address) ? 34 + 1 : 19
                )
            })
            
            const ticks = await getTicksFromAddresses(market, tickAddresses.flat())

            let offset = 0
            for (let i = 0; i < tickAddresses.length; i++) {
                const ticksInPool = tickAddresses[i].length
                poolTicks = {
                    ...poolTicks,
                    [pools[i].address.toBase58()]: ticks
                        .slice(offset, offset + ticksInPool)
                        .filter(t => !!t)
                        .map(t => parseTick(t))
                }
                offset += ticksInPool
            }

            setPools(pools)
            setPoolTicks(poolTicks)
            setTickmaps(tickmaps)

            const [accounts, priceTokenFrom, priceTokenTo] = await Promise.all([
                getDataAccounts(tokenFrom, tokenTo),
                getTokenPrice(tokenFrom.toBase58()),
                getTokenPrice(tokenTo.toBase58())
            ])
            setAccountData(accounts)
            dispatch(tokenActions.updatePrice({ mintAddress: tokenFrom.toBase58(), price: priceTokenFrom }))
            dispatch(tokenActions.updatePrice({ mintAddress: tokenTo.toBase58(), price: priceTokenTo }))
            if (accounts && amountIn) {
                await updateSwapSimulation(amountIn, accounts)
            }
            setInitLoading(false)
        } catch(error) {
            setInitLoading(false)
        } finally {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
            setTimer({
                countdown: DURATION,
                run: true
            })
            setInitLoading(false)
        }
    }

    async function loadData() {
        setLoading(true)
        try {
            const [accounts, priceTokenFrom, priceTokenTo] = await Promise.all([
                getDataAccounts(tokenFrom, tokenTo),
                getTokenPrice(tokenFrom.toBase58()),
                getTokenPrice(tokenTo.toBase58())
            ])
            setAccountData(accounts)
            dispatch(tokenActions.updatePrice({ mintAddress: tokenFrom.toBase58(), price: priceTokenFrom }))
            dispatch(tokenActions.updatePrice({ mintAddress: tokenTo.toBase58(), price: priceTokenTo }))
            if (accounts && amountIn) {
                await updateSwapSimulation(amountIn, accounts)
            }
            setLoading(false)
        } catch(error) {
            setLoading(false)
        } finally {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
            }
            setTimer({
                countdown: DURATION,
                run: true
            })
            setLoading(false)
        }
    }

    async function getDataAccounts(tokenFrom: PublicKey, tokenTo: PublicKey) {
        try {
            const keypair = await getKeypair()
            const market = Market.build(
                Network.MAIN,
                new KeypairWallet(keypair),
                getConnection(),
                new PublicKey("iNvTyprs4TX8m6UeUEkeqDFjAL9zRCRWcexK9Sd4WEU")
            )

            const accounts = await getTwoHopSwapData({ tokenFrom, tokenTo, market })
            if (!accounts) throw new Error('Accounts fetch returned undefined')

            // setAccountData(accounts)

            if (amountIn) {
                updateSwapSimulation(amountIn, accounts)
            }
            return accounts
        } catch (err) {
            console.error('❌ fetchTwoHopSwapAccounts error:', err)
            return null
        }
    }

    async function updateSwapSimulation(amount: string, accounts?: FetcherRecords | null) {
        try {
            setLoading(true)
            const isExistsAccounts = accounts? accounts : accountData
            if (!isExistsAccounts || !tokenFrom || !tokenTo || !amount) {
                setLoading(false)
                return "0"
            }
            const keypair = await getKeypair()
            const market = Market.build(
                Network.MAIN,
                new KeypairWallet(keypair),
                getConnection(),
                new PublicKey("iNvTyprs4TX8m6UeUEkeqDFjAL9zRCRWcexK9Sd4WEU")
            )

            const decimalsFrom = TOKENLIST[tokenFrom.toBase58()]?.decimals

            const newAmount = parseFloat(amount) * Math.pow(10, decimalsFrom)

            let slippTolerance = 0.50

            const [simulation, simulationTwoHop] = await Promise.all([
                handleSimulate(
                    pools,
                    poolTicks,
                    tickmaps,
                    fromFee(new BN(Number(+slippTolerance * 1000))),
                    tokenFrom,
                    tokenTo,
                    new BN(Math.round(newAmount)),
                    true
                ),
                handleSimulateWithHop(
                    market,
                    tokenFrom,
                    tokenTo,
                    new BN(Math.round(newAmount)),
                    true,
                    isExistsAccounts
                )
            ])
            await updateSimulation(amount, simulation, simulationTwoHop)
        } catch(error) {
            setLoading(false)
            console.log("error", error)
            return "0"
        }
    }

    const updateSimulation = async (
        amountIn: string,
        simulateResult: SimulationResult,
        simulateWithHopResult: SimulationWithHopResult
    ) => {

        let useTwoHop = false
    
        const isSimulateError = simulateResult.error.length > 0 || simulateResult.amountOut.eq(new BN(0))
        const isSimulateWithHopError = simulateWithHopResult.error
    
        if (isSimulateError && !isSimulateWithHopError) {
            useTwoHop = true
        }
    
        if (
            (isSimulateError && isSimulateWithHopError) ||
            (!isSimulateError && !isSimulateWithHopError)
        ) {
            const tokenBetween = simulateWithHopResult!!.simulation!!.xToYHopOne?
                simulateWithHopResult.route?.[0].tokenY.toBase58() : simulateWithHopResult.route?.[0].tokenX.toBase58()
            
            const ataExists = await ensureAtaExists(new PublicKey(getWalletAddress()!!), new PublicKey(tokenBetween!!))
            if (
                !ataExists && simulateWithHopResult?.simulation?.totalAmountOut.gte(simulateResult.amountOut) &&
                !simulateWithHopResult.error
            ) {
                useTwoHop = true
            }
        }

        if (useTwoHop && simulateWithHopResult.simulation && simulateWithHopResult.route) {
            const tokenBetween = simulateWithHopResult.simulation.xToYHopOne?
                simulateWithHopResult.route[0].tokenY.toBase58() : simulateWithHopResult.route[0].tokenX.toBase58()
            console.log("tokenBetween", tokenBetween)
            const firstAmount = printBN(simulateWithHopResult.simulation.swapHopOne.accumulatedAmountIn.add(
                simulateWithHopResult.simulation.swapHopOne.accumulatedFee
            ), TOKENLIST[tokenFrom.toBase58()].decimals)
            const secondAmount = printBN(simulateWithHopResult.simulation.swapHopTwo.accumulatedAmountIn.add(
                simulateWithHopResult.simulation.swapHopTwo.accumulatedFee
            ), TOKENLIST[tokenBetween].decimals)

            const priceImpact = Math.pow(
                Math.max(
                    +printBN(simulateWithHopResult.simulation.swapHopOne.priceImpact, 10),
                    +printBN(simulateWithHopResult.simulation.swapHopTwo.priceImpact, 10)
                ),
                2
            )
            const amountOut = printBN(simulateWithHopResult.simulation?.swapHopTwo.accumulatedAmountOut, TOKENLIST[tokenTo.toBase58()].decimals)
            setSimulation({
                tokenFrom: tokenFrom.toBase58(),
                tokenTo: tokenTo.toBase58(),
                tokenBetween: tokenBetween,
                firstFeePercent: Number(printBN(simulateWithHopResult.route[0]?.feeTier.fee ?? new BN(0), 10)),
                secondFeePercent: Number(printBN(simulateWithHopResult.route[1]?.feeTier.fee ?? new BN(0), 10)),
                firstAmount: formatNumberWithoutSuffix(firstAmount),
                secondAmount: formatNumberWithoutSuffix(secondAmount),
                priceImpact: priceImpact < 0.01 ? "<0.01" : priceImpact.toFixed(2),
                exchangeRate: formatNumberWithSuffix((parseFloat(amountOut) / parseFloat(amountIn)).toFixed(TOKENLIST[tokenTo.toBase58()].decimals)),
            })
            setAmountOut(amountOut)
        } else {
            const amountOut = printBN(simulateResult.amountOut, TOKENLIST[tokenTo.toBase58()].decimals)
            const priceImpact = printBN(simulateResult.priceImpact, 10)
            const fee = pools[simulateResult.poolIndex].fee
            setSimulation({
                tokenFrom: tokenFrom.toBase58(),
                tokenTo: tokenTo.toBase58(),
                tokenBetween: null,
                firstFeePercent: Number(printBN(fee ?? new BN(0), 10)),
                secondFeePercent: 0,
                firstAmount: formatNumberWithoutSuffix(amountIn),
                secondAmount: null,
                priceImpact: parseFloat(priceImpact) < 0.01 ? "<0.01" : parseFloat(priceImpact).toFixed(2),
                exchangeRate: formatNumberWithSuffix((parseFloat(amountOut) / parseFloat(amountIn)).toFixed(TOKENLIST[tokenTo.toBase58()]?.decimals)),
            })
            setAmountOut(amountOut)
        }
        setLoading(false)
    }

    function onShowModal(tokenList: string[], onSelectToken: (token: string) => void) {
        showModal(
            <ModalListToken
                hideModal={hideModal}
                dataToken={tokenList}
                selectToken={onSelectToken}
            />
        )
    }

    return (
        <SafeAreaView className="flex-1 bg-baseBg">
            <ScrollView
                refreshControl={<RefreshControl refreshing={false} onRefresh={loadInitData}/>}
                contentContainerClassName="grow-1" stickyHeaderIndices={[0]}
            >
                <TouchableHighlight
                    className="bg-gray-900 self-end mb-1 mx-2 px-2 py-1 rounded-lg"
                    onPress={() => {}}
                >
                    <View className="flex-row items-center  ">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold mr-[1px]">0.5%</CustomText>
                        <SettingLineIcon
                            color={Colors.primary}
                            width={18} height={18}
                        />
                    </View>
                </TouchableHighlight>
                <View className="bg-gray-900 mx-2 p-4 rounded-lg">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold">Send</CustomText>
                        </View>
                        <View className="flex-1 items-end">
                            <CustomText className="text-primary text-sm font-PlusJakartaSansSemiBold">
                                {`Balance: ${delimiterFormat(reduxToken[tokenFrom.toBase58()].balance.amountUI)} ${TOKENLIST[tokenFrom.toBase58()].ticker}`}
                            </CustomText>
                        </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-2">
                        <View className="flex-1">
                            {initLoading &&  <SkeletonLoader className="w-3/4 h-8"/>}
                            {!initLoading && <Input
                                inputContainerClassName="py-1 px-0 rounded-none justify-center bg-gray-900 border-0"
                                className="py-1 leading-none text-2xl text-primary font-LatoBold"
                                keyboardType="numeric"
                                placeholder="0"
                                value={amountIn}
                                onChangeText={onChangeAmountIn}
                            />}
                        </View>
                        <View className="w-[35%] items-end">
                            <TouchableHighlight
                                onPress={() => {
                                    onShowModal(
                                        Object.keys(reduxToken).filter(token => token !== tokenFrom.toBase58() && parseFloat(reduxToken[token].balance.amount) > 0),
                                        (token) => {
                                            if (token !== tokenFrom.toBase58()) {
                                                onChangeAmountIn("")
                                                setAmountOut("")
                                            }
                                            setTokenFrom(new PublicKey(token))
                                        }
                                    )
                                }}
                                className="bg-baseComponent rounded-lg overflow-hidden"
                            >
                                <View className="flex-row items-center p-2">
                                    <Image
                                        source={Images[TOKENLIST[tokenFrom.toBase58()].image as keyof typeof Images]}
                                        className="h-6 w-6 rounded-full mr-2"
                                    />
                                    <CustomText className="text-primary font-PlusJakartaSansSemiBold mb-[1px] mr-1">
                                        {TOKENLIST[tokenFrom.toBase58()].ticker}
                                    </CustomText>
                                    <ChevronDownIcon
                                        color={Colors.primary}
                                        width={18}
                                        height={18}
                                    />
                                </View>
                            </TouchableHighlight>
                        </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-2">
                        <View className="flex-1">
                            {initLoading && <SkeletonLoader className="w-16 h-5"/>}
                            {!initLoading && <CustomText className="text-gray-400 text-sm font-PlusJakartaSans">
                                ~${delimiterFormat(((reduxToken?.[tokenFrom.toBase58()]?.balance?.price ?? 0.0) * parseFloat(amountIn === ""? "0" : amountIn)).toFixed(2))}
                            </CustomText>}
                        </View>
                        <View className="w-[40%] items-end">
                            <View className="flex-row gap-x-2">
                                <TouchableHighlight
                                    className="bg-gray-600 rounded-lg p-1 px-2"
                                    onPress={() => {
                                        const half = Math.round(parseInt(reduxToken?.[tokenFrom.toBase58()]?.balance?.amount ?? 0) / 2)
                                        setAmountIn((half / Math.pow(10, reduxToken?.[tokenFrom.toBase58()].mint.decimals)).toString())
                                        debounceRef.current?.((half / Math.pow(10, reduxToken?.[tokenFrom.toBase58()].mint.decimals)).toString())
                                    }}
                                >
                                    <CustomText className="text-primary text-xs font-PlusJakartaSansSemiBold">Half</CustomText>
                                </TouchableHighlight>
                                <TouchableHighlight
                                    className="bg-gray-600 rounded-lg p-1 px-2"
                                    onPress={() => {
                                        setAmountIn(reduxToken?.[tokenFrom.toBase58()]?.balance?.amountUI ?? "0")
                                        debounceRef.current?.(reduxToken?.[tokenFrom.toBase58()]?.balance?.amountUI ?? "0")
                                    }}
                                >
                                    <CustomText className="text-primary text-xs font-PlusJakartaSansSemiBold">Max</CustomText>
                                </TouchableHighlight>
                            </View>
                        </View>
                    </View>
                </View>
                <View className="bg-gray-900 m-2 p-4 rounded-lg">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold">Receive</CustomText>
                        </View>
                        <View className="flex-1 items-end">
                            <CustomText className="text-primary text-sm font-PlusJakartaSansSemiBold">
                                {`Balance: ${reduxToken?.[tokenTo.toBase58()]?.balance?.amountUI ?? "0.00"} ${TOKENLIST[tokenTo.toBase58()].ticker}`}
                            </CustomText>
                        </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-2">
                        <View className="flex-1">
                            {(loading || initLoading) &&  <SkeletonLoader className="w-3/4 h-8"/>}
                            {!loading && !initLoading &&  <Input
                                inputContainerClassName="py-1 px-0 rounded-none justify-center bg-gray-900 border-0"
                                className="py-1 leading-none text-2xl text-primary font-LatoBold"
                                keyboardType="number-pad"
                                placeholder="0"
                                readOnly
                                value={amountOut}
                                onChangeText={setAmountOut}
                            />}
                            {/* <CustomText className="text-primary text-2xl font-LatoBold mb">0.12312312312312</CustomText> */}
                        </View>
                        <View className="w-[35%] items-end">
                            <TouchableHighlight
                                onPress={() => {
                                    onShowModal(
                                        Object.keys(TOKENLIST).filter(token => token !== tokenTo.toBase58()),
                                        (token) => {
                                            if (token !== tokenTo.toBase58()) {
                                                onChangeAmountIn("")
                                                setAmountOut("")
                                            }
                                            setTokenTo(new PublicKey(token))
                                        }
                                    )
                                }}
                                className="bg-baseComponent rounded-lg overflow-hidden"
                            >
                                <View className="flex-row items-center p-2">
                                    <Image
                                        source={Images[TOKENLIST[tokenTo.toBase58()].image as keyof typeof Images]}
                                        className="h-6 w-6 rounded-full mr-2"
                                    />
                                    <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                                        {TOKENLIST[tokenTo.toBase58()].ticker}
                                    </CustomText>
                                    <ChevronDownIcon
                                        color={Colors.primary}
                                        width={18}
                                        height={18}
                                    />
                                </View>
                            </TouchableHighlight>
                        </View>
                    </View>
                    <View className="flex-row items-center justify-between mt-2">
                        <View className="flex-1">
                            {(loading || initLoading) &&  <SkeletonLoader className="w-16 h-5"/>}
                            {!loading && !initLoading &&  <CustomText className="text-gray-400 text-sm font-PlusJakartaSans">
                                ~${delimiterFormat(((reduxToken?.[tokenTo.toBase58()]?.balance?.price ?? 0.0) * parseFloat(amountOut === ""? "0" : amountOut)).toFixed(2))}
                            </CustomText>}
                        </View>
                        <View className="w-[40%] items-end">
                            {/* <View className="flex-row gap-x-2">
                                <TouchableHighlight
                                    className="bg-gray-600 rounded-lg p-1 px-2"
                                    onPress={() => alert("asdasdsd")}
                                >
                                    <CustomText className="text-primary text-xs font-PlusJakartaSansSemiBold">Half</CustomText>
                                </TouchableHighlight>
                                <View className="bg-gray-600 rounded-lg p-1 px-2">
                                    <CustomText className="text-primary text-xs font-PlusJakartaSansSemiBold">Max</CustomText>
                                </View>
                            </View> */}
                        </View>
                    </View>
                </View>

                <View className="bg-gray-900 mx-2 p-2 rounded-lg mb-2 flex-row items-center justify-between">
                    {loading || initLoading && <SkeletonLoader className="h-6 w-24" />}
                    {amountIn && simulation && !loading && !initLoading && <CustomText className="text-primary font-PlusJakartaSans">
                        {`1 ${TOKENLIST[tokenFrom.toBase58()].ticker} = ${simulation.exchangeRate} ${TOKENLIST[tokenTo.toBase58()].ticker}`}
                    </CustomText>}
                    <View className="flex-1" />
                    {/* <View className="flex-row">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold mr-1">{timer.countdown}</CustomText>
                        <CircularTimer
                            countdown={timer.countdown}
                            duration={DURATION}
                        />
                    </View> */}
                    <CircularTimer
                        countdown={timer.countdown}
                        duration={DURATION}
                    />
                </View>

                {!loading && !initLoading && simulation && amountIn && <View className="bg-gray-900 mx-2 py-2 rounded-lg mb-2">
                    <View className="flex-row items-center justify-around px-4 pb-2 mb-2 border-b-[1px] border-b-gray-600">
                        <View className="items-center">
                            <Image
                                className="w-6 h-6 rounded-full mb-1"
                                source={Images[TOKENLIST[simulation.tokenFrom].image as keyof typeof Images]}
                            />
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                {TOKENLIST[simulation.tokenFrom].ticker}
                            </CustomText>
                        </View>

                        {simulation.tokenBetween && <View className="items-center">
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xs mb-1">
                                {simulation.firstFeePercent}% fee
                            </CustomText>
                            <RouteArrowShort fill={Colors.primary}/>
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xs mt-1">
                                {simulation.firstAmount} {TOKENLIST[simulation.tokenFrom].ticker}
                            </CustomText>
                        </View>}

                        {simulation.tokenBetween && !loading && !initLoading &&  (
                            <View className="items-center">
                                <Image
                                    className="w-6 h-6 rounded-full mb-1"
                                    source={Images[TOKENLIST[simulation.tokenBetween].image as keyof typeof Images]}
                                />
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {TOKENLIST[simulation.tokenBetween].ticker}
                                </CustomText>
                            </View>
                        )}

                        {!simulation.tokenBetween && <View className="items-center">
                            {!loading && !initLoading &&  <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xs mb-1">
                                {simulation.firstFeePercent}% fee
                            </CustomText>}
                            {!loading && !initLoading &&  <RouteArrowLong width="180" fill={Colors.primary}/>}
                            {!loading && !initLoading &&  <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xs mt-1">
                                {simulation.firstAmount} {TOKENLIST[simulation.tokenFrom].ticker}
                            </CustomText>}
                        </View>}

                        {simulation.tokenBetween && <View className="items-center">
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xs mb-1">
                                {simulation.secondFeePercent}% fee
                            </CustomText>
                            <RouteArrowShort fill={Colors.primary}/>
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xs mt-1">
                                {simulation.secondAmount} {TOKENLIST[simulation.tokenBetween].ticker}
                            </CustomText>
                        </View>}

                        <View className="items-center">
                            <Image
                                className="w-6 h-6 rounded-full mb-1"
                                source={Images[TOKENLIST[simulation.tokenTo].image as keyof typeof Images]}
                            />
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                {TOKENLIST[simulation.tokenTo].ticker}
                            </CustomText>
                        </View>
                    </View>
                    <View className="flex-row justify-between mb-1 px-4">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            Exchange Rate:
                        </CustomText>
                        {loading || initLoading &&  <SkeletonLoader className="w-24 h-5"/>}
                        {!loading && !initLoading &&  <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            {simulation.exchangeRate} {TOKENLIST[simulation.tokenTo].ticker}
                        </CustomText>}
                    </View>
                    <View className="flex-row justify-between mb-1 px-4">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            Fee:
                        </CustomText>
                        {loading && initLoading &&  <SkeletonLoader className="w-24 h-5"/>}
                        {!loading && !initLoading &&  <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            {simulation.firstFeePercent + simulation.secondFeePercent}%
                        </CustomText>}
                    </View>
                    <View className="flex-row justify-between mb-1 px-4">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            Price Impact:
                        </CustomText>
                        {loading && initLoading &&  <SkeletonLoader className="w-24 h-5"/>}
                        {!loading && !initLoading &&  <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            {simulation.priceImpact}%
                        </CustomText>}
                    </View>
                    <View className="flex-row justify-between mb-1 px-4">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            Slippage Tolerance:
                        </CustomText>
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                            0.5%
                        </CustomText>
                    </View>
                </View>}

                <View className="bg-gray-900 mx-2 py-2 rounded-lg flex-row items-center gap-x-2 justify-between px-4">
                    <View className="flex-1 flex-row items-center">
                        <Image
                            className="w-8 h-8 rounded-full mr-2"
                            source={Images[TOKENLIST[tokenFrom.toBase58()].image as keyof typeof Images]}
                        />
                        <View className="flex-1">
                            <View className="flex-row">
                                <View className="flex-1">
                                    <CustomText
                                        className="text-primary font-PlusJakartaSansSemiBold text-sm"
                                    >
                                        {TOKENLIST[tokenFrom.toBase58()].ticker}
                                    </CustomText>
                                </View>
                                <View className="flex-1 items-end">
                                    <CustomText
                                        className="text-primary font-PlusJakartaSansSemiBold text-sm"
                                    >
                                        ${formatNumberWithSuffix((reduxToken?.[tokenFrom.toBase58()]?.balance?.price ?? 0.0), { decimalsAfterDot: 1 })}
                                    </CustomText>
                                </View>
                            </View>
                            <View>
                                <CustomText className="text-primary text-xs font-PlusJakartaSans">
                                    {shortenAddress(tokenFrom.toBase58())}
                                </CustomText>
                            </View>
                        </View>
                    </View>
                    <View className="flex-1 flex-row items-center">
                        <Image
                            className="w-8 h-8 rounded-full mr-2"
                            source={Images[TOKENLIST[tokenTo.toBase58()].image as keyof typeof Images]}
                        />
                        <View className="flex-1">
                            <View className="flex-row">
                                <View className="flex-1">
                                    <CustomText
                                        className="text-primary font-PlusJakartaSansSemiBold text-sm"
                                    >
                                        {TOKENLIST[tokenTo.toBase58()].ticker}
                                    </CustomText>
                                </View>
                                <View className="flex-1 items-end">
                                    <CustomText
                                        className="text-primary font-PlusJakartaSansSemiBold text-sm"
                                    >
                                        ${formatNumberWithSuffix((reduxToken?.[tokenTo.toBase58()]?.balance?.price ?? 0.0), { decimalsAfterDot: 1 })}
                                    </CustomText>
                                </View>
                            </View>
                            <View>
                                <CustomText className="text-primary text-xs font-PlusJakartaSans">
                                    {shortenAddress(tokenTo.toBase58())}
                                </CustomText>
                            </View>
                        </View>
                    </View>
                </View>
            {/* <NativeStack.Navigator>
                <NativeStack.Screen
                    name="ListToken"
                    component={ListToken}
                    options={{ headerShown: false }}
                />
                <NativeStack.Screen
                    name="Recipient"
                    component={Recipient}
                    options={{ headerShown: false}}
                />
            </NativeStack.Navigator> */}
            </ScrollView>
        </SafeAreaView>
    )
}

function ModalListToken(props: { hideModal: () => void, selectToken: (token: string) => void, dataToken: string[] }) {

    return (
        <BottomSheetFlatList
            ListHeaderComponent={(
                <View className="px-3 pb-2 mb-4 border-b-[0.5px] border-b-primary">
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xl">Select Token</CustomText>
                </View>
            )}
            data={props.dataToken}
            keyExtractor={(idx) => `List-token-send-item-${idx}`}
            renderItem={(itemData) => (
                <TouchableHighlight
                    className="mb-4"
                    onPress={() => {
                        props.selectToken(itemData.item)
                        props.hideModal()
                    }}
                >
                    <View className="flex-row items-center py-2 px-3">
                        <Image
                            className="w-10 h-10 rounded-full mr-2"
                            source={Images[TOKENLIST[itemData.item].image as keyof typeof Images]}
                        />
                        <View className="flex-1 mb-1">
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                                {TOKENLIST[itemData.item].name}
                            </CustomText>
                            <CustomText className="text-primary text-sm font-PlusJakartaSans">
                               {TOKENLIST[itemData.item].ticker}
                            </CustomText>
                            {/* <CustomText className="text-primary text-sm font-PlusJakartaSans">
                                0.123123123 {TOKENLIST[itemData.item].ticker}
                            </CustomText> */}
                        </View>
                        <CustomText className="font-LatoBold text-md text-primary">
                            
                        </CustomText>
                    </View>
                </TouchableHighlight>
            )}
        />
    )
}

function ListToken() {
    return (
        <View className="h-1/2 bg-red-200 w-full">
            
        </View>
    )
}

function Recipient() {
    return (
        <View className="h-1/2 bg-red-200 w-full">
            
        </View>
    )
}

export const screenOptions = createStackOptions<'Swap'>(({ navigation }) => {
    return {
        headerTitle: "Swap",
        headerTintColor: Colors.primary,
        headerTitleStyle: {
            fontFamily: Fonts.PlusJakartaSansSemiBold,
            fontSize: 18,
        },
        headerTitleAlign: 'left',
        headerStyle: { backgroundColor: Colors.baseBg },
        headerLeft: () => (
            <HeaderButton
                className='mr-6 mb-1'
                icon={<ChevronLeftIcon width={24} height={24} color={Colors.primary}/>}
                onPress={() => navigation.goBack() }
            />
        )
    }
})

  