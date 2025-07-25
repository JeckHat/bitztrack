import { useCallback, useEffect, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
    FlatList,
    Image,
    RefreshControl,
    SafeAreaView,
    TouchableHighlight,
    View
} from "react-native"
import { useDispatch, useSelector } from "react-redux"

import { CustomText, SkeletonLoader } from "@components"
import Images from "@assets/images"
import { RootState } from "@store/types"
import { getAPILevel, shortenAddress } from "@helpers"
import { ChevronRightIcon, DataIcon, MachineIcon, WalletIcon } from "@assets/icons"
import { Colors } from "@styles"
import { TabMonitoringScreenProps, TabScreenOptionsFn } from "@navigations/types"
import { BITZ_MINT, GECKO_TERMINAL_PRICE, POOL_LIST, TOKENLIST } from "@constants"
import { poolActions } from "@store/actions";

export default function TabMonitoringScreen({ navigation }: TabMonitoringScreenProps) {
    const walletAddress = useSelector((state: RootState) => state.wallet.publicKey) ?? ""
    const pools = useSelector((state: RootState) => state.pools.byId)
    const order = useSelector((state: RootState) => state.pools.order)
    const [isBalanceReady, setIsBalanceReady] = useState(false)
    const [isPoolReady, setIsPoolReady] = useState(false)
    const [total, setTotal] = useState({
        avg: 0,
        rewards: 0,
        loading: true
    })
    const [price, setPrice] = useState(0.0)
    const dispatch = useDispatch()

    useFocusEffect(
        useCallback(() => {
            loadPool()
        }, [])
    )

    useEffect(() => {
        if (!isBalanceReady) return;
    
        let newTotal = {
            avg: 0,
            rewards: 0,
        };
      
        Object.keys(POOL_LIST)
        .filter(filterId => POOL_LIST[filterId].api.getBalance && pools[filterId].show !== false)
        .forEach(poolId => {
            const pool = pools[poolId];
            if (!pool) return;
            newTotal.avg += pool.avgRewards ?? 0;
            newTotal.rewards += pool.rewards ?? 0;
        });
      
        setTotal({ ...newTotal, loading: false });
    }, [isBalanceReady]);

    useEffect(() => {
        if (!isPoolReady) return;
    
        loadData()
    }, [isPoolReady]);

    async function loadPool() {
        try {
            Object.keys(POOL_LIST).forEach(poolId => {
                if (!pools[poolId]) {
                    dispatch(poolActions.addPool({ id: poolId, walletAddress: "Cm6tuDv9WYjv9LuELUKM4jDwVJ1r3gxgQKERofPqouH3" }))
                }
            })
            setIsPoolReady(true)
        } catch(error) {

        }
    }

    async function loadData() {
        try {
            setIsBalanceReady(false)
            await loadPrice()
            await loadPoolsBalance()
        } catch(error) {
            console.log("error pool", error)
        }
    }

    async function loadPoolsBalance() {
        const poolList = Object.keys(POOL_LIST)
            .filter(filterId => POOL_LIST[filterId].api.getBalance && pools[filterId].show !== false)
            .map(poolId => {
                return {
                    poolId: poolId,
                    fetch: POOL_LIST[poolId].api.getMinerData?.(pools[poolId].walletAddress)
                }
            })

        const results = await Promise.allSettled(poolList.map(pool => {
            return pool.fetch
        }))

        const updatePromises = results.map(async (result) => {
            if (result.status === 'fulfilled') {
                const newPool = result.value
                const existing = JSON.parse(JSON.stringify(pools[newPool?.poolId ?? ""]))
                const isSame = existing &&
                    existing.rewards === newPool?.rewards &&
                    existing.running === newPool?.running &&
                    existing.totalMachine === newPool?.totalMachine &&
                    existing.avgRewards === newPool?.avgRewards &&
                    existing.avgInitiatedAt === newPool?.avgInitiatedAt &&
                    existing.lastKnownRewards === newPool?.lastKnownRewards &&
                    existing.lifetimeRewards === newPool?.lifetimeRewards &&
                    existing.lastCheckAt === newPool?.lastCheckAt;
                
                if (!isSame) {
                    dispatch(poolActions.updateBalance({
                        poolId: newPool?.poolId ?? "",
                        avgRewards: newPool?.avgRewards ?? 0,
                        rewards: newPool?.rewards ?? 0,
                        lastKnownRewards: newPool?.lastKnownRewards ?? 0,
                        avgInitiatedAt: newPool?.avgInitiatedAt ?? new Date().getTime(),
                        totalMachine: newPool?.totalMachine ?? 0,
                        running: newPool?.running ?? false,
                        lifetimeRewards: newPool?.lifetimeRewards ?? 0,
                        lastCheckAt: newPool?.lastCheckAt ?? new Date().getTime(),
                    }))
                }
            }
        })
        await Promise.all(updatePromises)
        setIsBalanceReady(true)
    }

    async function loadPrice() {
        try {
            const [priceBitz] = await Promise.all([
                fetch(`${GECKO_TERMINAL_PRICE}/${TOKENLIST[BITZ_MINT].geckoPriceAddress}`, {
                    method: 'GET',
                }).then((res) => res.json().then((json) => {
                    return parseFloat(json?.data?.attributes?.price_in_usd ?? 60.0)
                }).catch(() => 0)),
            ])
            setPrice(priceBitz)
        } catch(error) {
            console.log("error", error)
        }
    }
   
    return (
        <SafeAreaView
            style={{ paddingBottom: getAPILevel() > 34? 40 : 0 }}
            className="flex-1 bg-baseBg px-2"
        >
            <FlatList
                refreshControl={<RefreshControl refreshing={false} onRefresh={loadData}/>}
                data={
                    (() => {
                        const ordered = order.filter(key => POOL_LIST[key] && pools[key]?.show !== false)
                        if (ordered.length % 2 !== 0) ordered.push('BLANK_SLOT')
                        return ordered
                    })()
                }
                contentContainerClassName="grow py-2 pb-[56px] mx-2"
                ListHeaderComponent={(
                    <View className="flex gap-2 mx-2">
                        <View className="bg-gray-800 p-4 rounded-lg">
                            <CustomText className="text-primary mb-1 font-PlusJakartaSansSemiBold text-sm">
                                Main Wallet
                            </CustomText>
                            <View className="flex-row items-center mb-2">
                                <WalletIcon height={20} width={20} color={Colors.primary} />
                                <CustomText className="text-primary ml-2 font-PlusJakartaSansSemiBold text-sm">
                                    {shortenAddress(walletAddress)}
                                </CustomText>
                            </View>
                            <View className="flex-row items-center">
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm mb-1">
                                    Daily Average:
                                </CustomText>
                            </View>
                            <View className="flex-row items-center justify-between pb-1 mb-1 border-b border-solid border-gray-500">
                                <View>
                                    <View className="flex-row items-center">
                                        <Image
                                            className="h-6 w-6 mr-1 rounded-full"
                                            source={Images.BitzToken}
                                        />
                                        {!total.loading && <CustomText
                                            className="text-primary font-PlusJakartaSans text-sm"
                                        >
                                            {(total.avg / Math.pow(10, 11))?.toFixed(11)} BITZ
                                        </CustomText>}
                                        {total.loading && <SkeletonLoader className="mt-1 bg-gray-700 rounded-lg w-32 h-[14px]" />}
                                    </View>
                                </View>
                                <View>
                                    <CustomText className="text-green-400 font-PlusJakartaSans text-[11px] self-end">
                                        $ {((total.avg / Math.pow(10, 11)) * price).toFixed(3)}
                                    </CustomText>
                                </View>
                            </View>
                            <View className="flex-row items-center">
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm mb-1">
                                    Total Rewards:
                                </CustomText>
                            </View>
                            <View className="flex-row items-center">
                                <Image
                                    className="h-6 w-6 mr-1 rounded-full"
                                    source={Images.BitzToken}
                                />
                                {!total.loading && <CustomText
                                    className="text-green-400 font-PlusJakartaSansSemiBold text-sm"
                                >
                                    {(total.rewards / Math.pow(10, 11))?.toFixed(11)} BITZ
                                </CustomText>}
                                {total.loading && <SkeletonLoader className="mt-1 bg-gray-700 rounded-lg w-32 h-[14px]" />}
                            </View>
                            <CustomText className="text-green-400 font-PlusJakartaSans text-[11px] mb-[1px] self-end">
                                $ {((total.rewards / Math.pow(10, 11)) * price).toFixed(3)}
                            </CustomText>
                        </View>
                        <View className="flex-row w-full justify-between items-center mt-4 px-1">
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xl">Pools</CustomText>
                            <ChevronRightIcon
                                width={24}
                                height={24}
                                color={Colors.primary}
                                onPress={() => navigation.navigate('ManagePool')}
                            />
                        </View>
                    </View>
                )}
                keyExtractor={(data) => data}
                numColumns={2}
                columnWrapperClassName="gap-2 mx-2"
                renderItem={({ item }) => {
                    if(item === "BLANK_SLOT") {
                        return (
                            <View className="flex-1 rounded-xl overflow-hidden my-2" />
                        )
                    }
                    return (
                        <MinerPoolItem
                            id={item}
                            name={POOL_LIST[item].name}
                            walletAddress={pools[item].walletAddress}
                            image={POOL_LIST[item].image}
                            totalMachine={pools[item].totalMachine}
                            running={pools[item].running}
                            avg={pools[item].avgRewards ?? 0}
                            rewards={pools[item].rewards ?? 0}
                            price={price}
                            onPress={() => navigation.navigate('PoolDetail', { poolId: item })}
                        />
                    )
                }}
            />
        </SafeAreaView>
    )
}

interface minerPoolItemProps {
    id: string
    name: string
    walletAddress: string
    image: keyof typeof Images
    totalMachine: number
    running: boolean
    avg: number
    rewards: number
    price: number
    onPress: () => void
}

function MinerPoolItem(props: minerPoolItemProps) {
    const { id, name, walletAddress, image, totalMachine, running, avg, rewards, price, onPress } = props
    
    return (
        <TouchableHighlight
            className="flex-1 rounded-xl overflow-hidden my-2"
            // onPress={id === 'pool-bitztrack'? onPress : () => {}}
            onPress={id === 'pool-hatzpool' || id === 'pool-solo' || id === 'pool-solo-2'? onPress : () => {}}
        >
            <View className="flex-1 bg-gray-800 px-3 p-2">
                <View className="flex-row items-center">
                    <Image
                        className="h-8 w-8 mr-1 rounded-lg"
                        source={Images[image]}
                    />
                    <CustomText
                        className="text-primary text-[13px] font-PlusJakartaSansSemiBold text-md"
                    >
                        {name}
                    </CustomText>
                </View>
                <View className="mt-2">
                    <View className="flex-row items-center mb-1">
                        <WalletIcon height={12} width={15} color={Colors.primary} />
                        <CustomText className="text-primary mx-1 font-PlusJakartaSansSemiBold text-[12px]">
                            {shortenAddress(walletAddress)}
                        </CustomText>
                    </View>
                    {(id === 'pool-hatzpool' || id === 'pool-solo' || id === 'pool-solo-2') && <View className="flex-row items-center">
                        <MachineIcon height={15} width={15} color={Colors.gold} />
                        <CustomText
                            className="text-gold mx-1 font-LatoBold text-[12px] flex-1"
                            numberOfLines={1}
                        >
                            {`${totalMachine} Machines`}
                        </CustomText>
                    </View>}
                    {/* {id === 'pool-hatzpool' && <View className="flex-row items-center">
                        <MachineIcon height={15} width={15} color={Colors.gold} />
                        <CustomText
                            className="text-gold mx-1 font-LatoBold text-[12px] flex-1"
                            numberOfLines={1}
                        >
                            {`${totalMachine} Machines`}
                        </CustomText>
                    </View>} */}
                    {running && <CustomText
                        className="text-primary font-PlusJakartaSans text-[11px] mb-1"
                    >
                        Status: <CustomText className="text-green-400 font-PlusJakartaSansSemiBold">Running</CustomText>
                    </CustomText>}
                    {!running && <CustomText
                        className="text-primary font-PlusJakartaSans text-[11px] mb-1"
                    >
                        Status: <CustomText className="text-red-400 font-PlusJakartaSansSemiBold">Stopped</CustomText>
                    </CustomText>}
                    {/* <CustomText
                        className="text-primary font-PlusJakartaSans text-[11px] mb-1"
                    >
                        {dayjs(miners[0].startMiningAt).format("DD/MM/YYYY HH:mm")}
                    </CustomText> */}
                    {/* <Button
                        containerClassName="rounded-lg"
                        className="py-1 px-3 bg-[#1D1C22]"
                        textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                        title="Update"
                        onPress={() => dispatch(minerPoolActions.updateStartMining({
                            minerPoolId: miners[0].minerPoolId,
                            startAt: miners[0].lastClaimAt
                        }))}
                    /> */}
                    <CustomText
                        className="text-primary font-PlusJakartaSans text-[12px]"
                    >
                        Daily Average:
                    </CustomText>
                    <View className="flex-row items-center justify-between pb-1 border-b border-solid border-gray-500">
                        <View>
                            <View className="flex-row items-center">
                                <Image
                                    className="h-4 w-4 mr-1"
                                    source={Images.BitzToken}
                                />
                                <CustomText
                                    className="text-primary font-PlusJakartaSans text-[10px]"
                                >
                                    {(avg / Math.pow(10, 11)).toFixed(6)}
                                </CustomText>
                            </View>
                        </View>
                        <CustomText
                            className="text-green-400 font-PlusJakartaSans text-[11px]"
                        >
                            $ {(price * (avg / Math.pow(10, 11))).toFixed(3)}
                        </CustomText>
                    </View>
                    <CustomText
                        className="text-primary font-PlusJakartaSans text-[12px] mb-[1px]"
                    >
                        Your Rewards:
                    </CustomText>
                    <View className="flex-row items-center">
                        <Image
                            className="h-4 w-4 mr-1"
                            source={Images.BitzToken}
                        />
                        <CustomText
                            className="text-green-400 font-PlusJakartaSansSemiBold text-[11px] mb-[1px]"
                        >
                            {(rewards / Math.pow(10, 11)).toFixed(11)} BITZ
                        </CustomText>
                    </View>
                    <CustomText
                        className="text-green-400 font-PlusJakartaSans text-[11px] mb-[1px] self-end"
                    >
                        $ {(price * (rewards / Math.pow(10, 11))).toFixed(3)}
                    </CustomText>
                </View>
            </View>
        </TouchableHighlight>
    )
}

export const screenOptions: TabScreenOptionsFn = () => {
    return {
        headerTitle: 'Monitoring',
        tabBarIcon({ color, size }) {
            return <DataIcon width={size} height={size} color={color} />
        },
    }
}
