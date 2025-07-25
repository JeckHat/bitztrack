import { useEffect, useState } from "react";
import { RefreshControl, SafeAreaView, ScrollView, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { twMerge } from "tailwind-merge";

import { Button, CustomText, HeaderButton, ModalAlert, ModalTransaction, SkeletonLoader } from "@components";
import { uiActions } from "@store/actions";
import { createStackOptions, PoolDetailNavigationProps } from "@navigations/types";
import { Colors, Fonts } from "@styles";
import { ChevronLeftIcon, ChevronRightIcon } from "@assets/icons";
import { delimiterFormat, getAPILevel, shortenAddress } from "@helpers";
import { BITZ_MINT, GECKO_TERMINAL_PRICE, POOL_LIST, TOKENLIST } from "@constants";
import { getWalletAddress } from "@providers";
import { useBottomModal } from "@hooks";
import { RootState } from "@store/types";

export default function PoolDetailScreen({ navigation, route }: PoolDetailNavigationProps) {
    const poolData = POOL_LIST[route.params?.poolId ?? 0]
    const pool = useSelector((state: RootState) => state.pools.byId[route.params?.poolId ?? ""])

    const [bitzPrice, setBitzPrice] = useState(0)
    const [totalMiners, setTotalMiners] = useState({ data: 0, loading: true })
    const [poolScore, setPoolScore] = useState({
        avg: 0,
        high: 0,
        loading: true
    })
    const [detail, setDetail] = useState({ totalHashes: 0, lastHashAt: "", lastClaimAt: "", loading: true })
    const [poolHashpower, setPoolHashpower] = useState({ data: 0, loading: true })
    const [poolEarned, setPoolEarned] = useState({ data: 0, loading: true })
    const [avgPoolEarned, setAvgPoolEarned] = useState({ data: 0, loading: true })
    const [minerRewards, setMinerRewards] = useState({ data: 0, loading: true })
    const [totalMachines, setTotalMachines] = useState({ data: 0, loading: false })
    const [minerHashpower, setMinerHashpower] = useState({ data: 0, loading: true })
    const [minerScore, setMinerScore] = useState({
        avg: 0,
        high: 0,
        loading: true
    })

    const dispatch = useDispatch()

    useEffect(() => {
        loadData()
    }, [])

    async function loadData() {
        if (poolData.api.getPoolDetail){
            const detail = await poolData.api.getPoolDetail(getWalletAddress() ?? "")
            setDetail({
                ...detail,
                loading: false
            })
        }
        const [
            poolPrice,
            totalMiners,
            poolHashpower,
            poolScore,
            poolEarned,
            avgPoolEarned,
            minerRewards,
            totalMachines,
            minerHashpower,
            minerScore
        ] = await Promise.all([
            fetch(`${GECKO_TERMINAL_PRICE}/${TOKENLIST[BITZ_MINT].geckoPriceAddress}`, {
                method: 'GET',
            }).then((res) => res.json().then((json) => {
                return parseFloat(json?.data?.attributes?.price_in_usd ?? 60.0)
            }).catch(() => 0)),
            poolData?.api?.getActiveMiners?.().then(res => {
                return res.total
            }).catch(() => 0) ?? 0,
            poolData?.api?.getHashpower?.().then(res => {
                return res.hashpower
            }).catch(() => 0) ?? 0,
            poolData?.api?.getHighScore?.().then(res => {
                return res
            }).catch(() => { return { avg: 0, high: 0} }) ?? { avg: 0, high: 0 },
            poolData?.api?.getPoolEarned?.().then(res => {
                return res.balance
            }).catch(() => 0) ?? 0,
            poolData?.api?.getAvgEarned?.().then(res => {
                return res.daily
            }).catch(() => 0) ?? 0,
            poolData?.api?.getRewards?.(getWalletAddress() ?? "").then(res => {
                return res.balance
            }).catch(() => 0) ?? 0,
            poolData?.api?.getActiveMiners?.(getWalletAddress() ?? "").then(res => {
                return res.total
            }).catch(() => 0) ?? 0,
            poolData?.api?.getHashpower?.(getWalletAddress() ?? "").then(res => {
                return res.hashpower
            }).catch(() => 0) ?? 0,
            poolData?.api?.getHighScore?.(getWalletAddress() ?? "").then(res => {
                return res
            }).catch(() => { return { avg: 0, high: 0 } }) ?? { avg: 0, high: 0 },
        ])

        setBitzPrice(poolPrice)
        setTotalMiners({
            data: totalMiners,
            loading: false
        })
        setPoolScore({
            avg: poolScore.avg,
            high: poolScore.high,
            loading: false
        })
        setPoolHashpower({
            data: poolHashpower,
            loading: false
        })
        setPoolEarned({
            data: poolEarned,
            loading: false
        })
        setAvgPoolEarned({
            data: avgPoolEarned,
            loading: false
        })
        setMinerRewards({
            data: minerRewards,
            loading: false
        })
        setTotalMachines({
            data: totalMachines,
            loading: false
        })
        setMinerHashpower({
            data: minerHashpower, loading: false
        })
        setMinerScore({
            avg: minerScore.avg, high: minerScore.high, loading: false
        })
    }

    const { showModal, hideModal } = useBottomModal()

    async function onClaim() {
        try {
            await dispatch(uiActions.showLoading(true))
            const confirmationResponse = await fetch(`https://pool.bitztrack.com/v2/confirmation-claim?pubkey=${getWalletAddress()}`, {
                method: 'POST'
            })
            const resConfirmation = await confirmationResponse.json()
            if((resConfirmation.balance ?? 0) / Math.pow(10, 11) < 0.02) {
                throw Error("balance low")
            }

            let tokenTransfers = [{
                id: 'bitz-2',
                ticker: 'BITZ',
                isLp: false,
                balance: (Math.round(resConfirmation.balance / Math.pow(10, 6)) / Math.pow(10, 5)).toString(),
                tokenImage: 'BitzToken',
                isMinus: false
            }]
            
            if (resConfirmation.requires_ata_creation) {
                tokenTransfers.push({
                    id: 'bitz-2',
                    ticker: 'BITZ',
                    isLp: false,
                    balance: "0.02",
                    tokenImage: 'BitzToken',
                    isMinus: true
                })
            }

            let transferInfo = [
                {
                    label: 'Account',
                    value: shortenAddress(getWalletAddress() ?? "")
                },
                {
                    label: 'Network Fee',
                    value: `0 ETH`
                }
            ]

            dispatch(uiActions.showLoading(false))

            showModal(
                <ModalTransaction
                    tokenTransfers={tokenTransfers}
                    transferInfo={transferInfo}
                    onClose={hideModal}
                    onConfirm={async () => {
                        try {
                            await dispatch(uiActions.showLoading(true))
                            await fetch(`https://pool.bitztrack.com/v2/claim-direct?pubkey=${getWalletAddress()}`, {
                                method: 'POST'
                            })

                            showModal(
                                <ModalAlert
                                    title="Claim Successful"
                                    message={"Claim successful. Please wait a moment for it to appear in your wallet."}
                                    onClose={hideModal}
                                />
                            )
                        } catch(error: any) {
                            showModal(
                                <ModalAlert
                                    title="Claim Failed"
                                    message={error.message}
                                    onClose={hideModal}
                                />
                            )
                        } finally {
                            dispatch(uiActions.showLoading(false))
                        }
                    }}
                />
            )
        } catch (error) {
            dispatch(uiActions.showLoading(false))
            showModal(
                <ModalAlert
                    title="Claim Failed"
                    message={"Oops! Your mining reward is still below 0.02 BITZ. Keep going — you're almost there!"}
                    onClose={hideModal}
                />
            )
        }
    }

    return (
        <SafeAreaView
            style={{ paddingBottom: getAPILevel() > 34? 20 : 0 }}
            className="flex-1 bg-baseBg"
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={false} onRefresh={loadData}/>}
                contentContainerStyle={{flexGrow: 1, paddingBottom: getAPILevel() > 34? 40 : 0 }}
            >
                {/* <CustomText className="text-primary font-PlusJakartaSansBold text-lg mx-3 mt-2 mb-1">Wallet Address</CustomText> */}
                {!poolData.isSolo && <CustomText className={"text-primary font-PlusJakartaSansBold text-lg mx-3 mt-2 mb-1"}>Pool Data</CustomText>}
                {!poolData.isSolo &&<View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Pool Status:</CustomText>
                        {totalMiners.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!totalMiners.loading && (
                            <CustomText
                                className={twMerge("font-PlusJakartaSansSemiBold", totalMiners.data > 0? "text-green-400 " : "text-red-400")}
                            >
                                {totalMiners.data > 0 ? "Running" : "Stopped"}
                            </CustomText>
                        )}
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Active Miners:</CustomText>
                        {totalMiners.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!totalMiners.loading && (
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                                {totalMiners.data}
                            </CustomText>
                        )}
                    </View>
                </View>}
                {!poolData.isSolo &&<View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">High Score (24h):</CustomText>
                        {poolScore.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!poolScore.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">{poolScore.high}</CustomText>}
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Daily Avg Score (24h):</CustomText>
                        {poolScore.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!poolScore.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">{poolScore.avg}</CustomText>}
                    </View>
                </View>}
                {!poolData.isSolo && <View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Current Hashpower:</CustomText>
                        {poolHashpower.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!poolHashpower.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {delimiterFormat(poolHashpower.data, ",")} H/s
                        </CustomText>}
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Avg Hashpower (24h):</CustomText>
                        {poolScore.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!poolScore.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {/* {delimiterFormat(poolHashpower.data, ",")} H/s */}
                            {delimiterFormat(Math.round(80 * Math.pow(2, poolScore.avg - 12)), ",")} H/s
                        </CustomText>}
                    </View>
                </View>}
                {!poolData.isSolo && <View className="flex-row gap-x-2 mx-2">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2 pb-5">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Pool Balance:</CustomText>
                        {poolEarned.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!poolEarned.loading && <CustomText className="text-green-400 font-PlusJakartaSansSemiBold">
                            {poolEarned.data} BITZ
                        </CustomText>}
                        <CustomText className="font-PlusJakartaSansBold text-green-400 self-end text-[11px] absolute bottom-1 right-2">
                            ${(poolEarned.data * bitzPrice).toFixed(2)}
                        </CustomText>
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2 pb-5">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Daily Earned:</CustomText>
                        {totalMiners.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!totalMiners.loading && <CustomText className="text-green-400 font-PlusJakartaSansSemiBold">{(avgPoolEarned.data / Math.pow(10, 11))} BITZ</CustomText>}
                        <CustomText className="font-PlusJakartaSansBold text-green-400 self-end text-[11px] absolute bottom-1 right-2">
                            ${((avgPoolEarned.data / Math.pow(10, 11))* bitzPrice).toFixed(2)}
                        </CustomText>
                    </View>
                </View>}
                {!poolData.isSolo && <View className="flex-row gap-x-2 mx-3 mt-1">
                    <View className="flex-1 flex-row items-center">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold mb-1 mr-1">View Pool Statistics</CustomText>
                        <ChevronRightIcon color={Colors.primary} width={20} height={20} />
                    </View>
                </View>}
                <CustomText className={twMerge("text-primary font-PlusJakartaSansBold text-lg mx-3 mt-4 mb-1", poolData.isSolo && "mt-1")}>Miner Data</CustomText>
                <View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold">Miner Status:</CustomText>
                        {totalMachines.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!totalMachines.loading && (
                            <CustomText
                                className={twMerge("font-PlusJakartaSansSemiBold", totalMachines.data > 0? "text-green-400 " : "text-red-400")}
                            >
                                {totalMachines.data > 0 ? "Running" : "Stopped"}
                            </CustomText>
                        )}
                    </View>
                    {!poolData.isSolo && <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Total Machines:</CustomText>
                        {totalMachines.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!totalMachines.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {totalMachines.data}
                        </CustomText>}
                    </View>}
                    {poolData.isSolo && <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Total Hashes:</CustomText>
                        {detail.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!detail.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {delimiterFormat(detail.totalHashes)}
                        </CustomText>}
                    </View>}
                </View>
                {!poolData.isSolo && <View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">High Score (24h):</CustomText>
                        {minerScore.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!minerScore.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">{minerScore.high}</CustomText>}
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Daily Avg Score (24h):</CustomText>
                        {minerScore.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!minerScore.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">{minerScore.avg}</CustomText>}
                    </View>
                </View>}
                {!poolData.isSolo && <View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Miner Hashpower:</CustomText>
                        {minerHashpower.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!minerHashpower.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {delimiterFormat(minerHashpower.data, ",")} H/s
                        </CustomText>}
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Avg Hashpower (24h):</CustomText>
                        {minerScore.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!minerScore.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {delimiterFormat(Math.round(80 * Math.pow(2, minerScore.avg - 12)), ",")} H/s
                        </CustomText>}
                    </View>
                </View>}
                {poolData.isSolo && <View className="flex-row gap-x-2 mx-2 mb-1">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Last Hash At:</CustomText>
                        {detail.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!detail.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {detail.lastHashAt}
                        </CustomText>}
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Last Claim At:</CustomText>
                        {detail.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!detail.loading && <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                            {detail.lastClaimAt}
                        </CustomText>}
                    </View>
                </View>}
                <View className="flex-row gap-x-2 mx-2">
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2 pb-5">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Miner Rewards:</CustomText>
                        {minerRewards.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!minerRewards.loading && <CustomText className="text-green-400 font-PlusJakartaSansSemiBold">
                            {minerRewards.data} BITZ
                        </CustomText>}
                        <CustomText className="font-PlusJakartaSansBold text-green-400 self-end text-[11px] absolute bottom-1 right-2">
                            ${(minerRewards.data * bitzPrice).toFixed(2)}
                        </CustomText>
                    </View>
                    <View className="flex-1 bg-gray-800 items-center rounded-lg px-1 py-2">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">Daily Average:</CustomText>
                        {poolHashpower.loading && <SkeletonLoader className="w-20 h-5 mt-2"/>}
                        {!poolHashpower.loading && <CustomText className="text-green-400 font-PlusJakartaSansSemiBold">
                            {(Math.round(pool.avgRewards) / Math.pow(10, 11))} BITZ
                        </CustomText>}
                        <CustomText className="font-PlusJakartaSansBold text-green-400 self-end text-[11px] absolute bottom-1 right-2">
                            ${((pool.avgRewards / Math.pow(10, 11)) * bitzPrice).toFixed(2)}
                        </CustomText>
                    </View>
                </View>
                {!poolData.isSolo && <View className="flex-row gap-x-2 mx-3 mt-1">
                    <View className="flex-1 flex-row items-center">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold mb-1 mr-1">View Mining Data</CustomText>
                        <ChevronRightIcon color={Colors.primary} width={20} height={20} />
                    </View>
                    <View className="flex-1 flex-row items-center">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold mb-1 mr-1">View Miner Statistics</CustomText>
                        <ChevronRightIcon color={Colors.primary} width={20} height={20} />
                    </View>
                </View>}
                <Button
                    containerClassName="rounded-full w-1/2 mb-3 border-2 border-solid border-green-600 mt-4 self-center"
                    className="py-1 bg-baseBg rounded-full items-center"
                    textClassName="text-green-600"
                    title="Claim Rewards"
                    onPress={onClaim}
                />
            </ScrollView>
        </SafeAreaView>
    )
}

export const screenOptions = createStackOptions<'PoolDetail'>(({ navigation, route }) => {
    const poolId = route.params?.poolId ?? ""
    const pool = POOL_LIST[poolId]
    return {
        headerTitle: `${pool?.name}`,
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