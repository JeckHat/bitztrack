import { useCallback, useState } from "react"
import { Alert, Image, RefreshControl, SafeAreaView, ScrollView, View } from "react-native"
import { useFocusEffect } from "@react-navigation/native"
import {
    ComputeBudgetProgram,
    Connection,
    PublicKey,
    Transaction
} from "@solana/web3.js"
import { useDispatch, useSelector } from "react-redux"
import { computeBitzSbitzRewards } from '@invariant-labs/sbitz'
import { BN } from "@coral-xyz/anchor"

import { Button, CustomText, SkeletonLoader, ModalTransaction } from "@components"
import Images from "@assets/images"
import { BITZ_MINT, BOOSTLIST, COMPUTE_UNIT_LIMIT, GECKO_TERMINAL_PRICE, sBITZ_MINT, TOKENLIST } from "@constants"
import { boostActions, getKeypair, uiActions } from "@store/actions"
import { CustomError } from "@models"
import { RootState } from "@store/types"
import { TabStakeScreenProps } from "@navigations/types"
import { useBottomModal } from "@hooks"
import { claimStakeBitzInstruction, getLiquidityPair, getStakeBitz, getStakeSBitz } from "@services/bitz"
import { printBN, shortenAddress } from "@helpers"
import { getConnection, isUseKeypair } from "@providers"

export default function TabStakeScreen(props: TabStakeScreenProps) {
    const [bitzPrice, setBitzPrice] = useState(0.0)
    const [loading, setLoading] = useState(true)
    const dispatch = useDispatch()
    const { showModal, hideModal } = useBottomModal()

    const boostData = useSelector((state: RootState) => state.boost)
    const stake = useSelector((state: RootState) => state.stake)
    const rpcUrl = useSelector((state: RootState) => state.config.rpcUrl)
    const walletAddress = useSelector((state: RootState) => state.wallet.publicKey)
    const balance = useSelector((state: RootState) => state.token[sBITZ_MINT]?.balance)
    console.log("sockets", useSelector((state: RootState) => state.socket))

    useFocusEffect(
        useCallback(() => {
            loadData()
        }, [])
    )

    async function loadData() {
        try {
            await Promise.all([
                loadStakes(),
                loadPrice(),
                loadSBitz()
            ])
        } catch(error) {
            console.log("error", error)
        }
    }

    async function loadStakes() {
        let promisesNetDeposits: Promise<{
            stakeBalance: number;
            stakeAmountBitz: number;
            stakeAmountPair: number;
            LPBalanceBitz: number;
            LPBalancePair: number;
            totalValueUsd: any;
            shares: number;
        }>[] = []
        const promises = Object.keys(BOOSTLIST).map((boost) => {
            promisesNetDeposits.push(getLiquidityPair(boost, true))
            return getStakeBitz(BOOSTLIST[boost].lpMint, boost)
        })

        await Promise.all(promises)
        await dispatch(boostActions.updateAllRewards())
        setLoading(false)
        Promise.all(promisesNetDeposits)

        dispatch(boostActions.updateAllNetDeposits())
    }

    async function loadPrice() {
        try {
            const price = await fetch(`${GECKO_TERMINAL_PRICE}/${TOKENLIST[BITZ_MINT].geckoPriceAddress}`, {
                method: 'GET',
            }).then((res) => res.json().then((json) => {
                return parseFloat(json?.data?.attributes?.price_in_usd ?? 60.0)
            }).catch(() => 0))
            setBitzPrice(price)
        } catch(error) {
            console.log("error", error)
        }
    }

    async function loadSBitz() {
        await getStakeSBitz()
    }

    async function onClaimAll() {
        try {
            dispatch(uiActions.showLoading(true))
            if (!rpcUrl) {
                throw new CustomError("Rpc is undefined", 500)
            }
        
            if (!walletAddress) {
                throw new CustomError("Public Key is undefined", 500)
            }

            const connection = getConnection()
            const publicKey = new PublicKey(walletAddress)
            const boosts: string[] = []
            let rewards = 0
            const transaction = new Transaction()
            transaction.add(
                ComputeBudgetProgram.setComputeUnitLimit({
                    units: COMPUTE_UNIT_LIMIT
                })
            )

            for (const boost of Object.keys(BOOSTLIST)) {
                const instruction = await claimStakeBitzInstruction(BOOSTLIST[boost].lpMint, boost)
                if (instruction.rewards > 0) {
                    transaction.add(instruction.transaction)
                    boosts.push(boost)
                    rewards += instruction.rewards
                }
            }

            const { blockhash } = await connection.getLatestBlockhash()
            transaction.recentBlockhash = blockhash
            transaction.feePayer = publicKey

            const feeCalculator = await connection.getFeeForMessage(transaction.compileMessage())
            if (!feeCalculator.value) {
                throw new CustomError("Fee is empty", 500)
            }
            
            let tokenTransfers = [{
                id: 'bitz-2',
                ticker: 'BITZ',
                isLp: false,
                balance: (Math.round(rewards / Math.pow(10, 6)) / Math.pow(10, 5)).toString(),
                tokenImage: 'BitzToken'
            }]

            let transferInfo = [
                {
                    label: 'Account',
                    value: shortenAddress(walletAddress)
                },
                {
                    label: 'Network Fee',
                    value: `${(feeCalculator.value / Math.pow(10, 9)).toFixed(8)} ETH`
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
                            hideModal()
                            dispatch(uiActions.showLoading(true))
                            const keypair = await getKeypair()
                            transaction.sign(keypair)
    
                            dispatch(uiActions.showLoading(true))
                            5122456109756001
                            const signature = await connection.sendRawTransaction(
                                transaction.serialize(), {
                                skipPreflight: false,
                                preflightCommitment: "confirmed",
                            })
    
                            await connection.confirmTransaction(signature, "confirmed")
                            setTimeout(() => {
                                dispatch(uiActions.showLoading(false))
                            }, 2000)
                        } catch(error) {
                            console.log("error", error)
                            setTimeout(() => {
                                loadData()
                                dispatch(uiActions.showLoading(false))
                            }, 2000)
                        }
                    }}
                />
            )
        } catch(error) {
            console.log("error", error)
            setTimeout(() => {
                loadData()
                dispatch(uiActions.showLoading(false))
            }, 5000)
            throw error
        }
    }

    return (
        <SafeAreaView
            // style={{ paddingBottom: getAPILevel() > 34? 40 : 0 }}
            className="flex-1 bg-baseBg px-2"
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={false} onRefresh={loadData}/>}
                contentContainerClassName="grow-1 pb-[52px]"
                // stickyHeaderIndices={[0]}
            >
                {Object.keys(BOOSTLIST).map(boost => (
                    <StakeRow
                        key={`stakescreen-${BOOSTLIST[boost].id}`}
                        boost={boost}
                        bitzPrice={bitzPrice}
                        loadStakes={loadStakes}
                        navigationProps={props}
                        loading={loading}
                    />
                ))}
                <View className="mb-1 items-center px-2 bg-baseBg mt-2">
                    <CustomText className="font-PlusJakartaSans text-primary text-sm self-start mb-1">
                        Daily Avg
                    </CustomText>
                    {loading && <SkeletonLoader
                        className="rounded-xl bg-gray-900 mb-3 mt-1 w-full h-10"
                        colors={["#111827", "#1f2937", "#111827"]}
                        width={"100%"} height={32}
                    />}
                    {!loading && <View className="flex-row items-center justify-end self-end mb-3">
                        <Image
                            className="w-10 h-10 mr-2"
                            source={Images.BitzToken}
                        />
                        <CustomText className="font-LatoBold text-primary text-xl">
                            {(boostData.avgRewards / Math.pow(10, 11)).toFixed(11)} BITZ
                        </CustomText>
                        <View className="self-end absolute top-9">
                            <CustomText className="font-PlusJakartaSansSemiBold text-green-400 text-sm">
                                (${(boostData.avgRewards / Math.pow(10, 11) * bitzPrice).toFixed(2)})
                            </CustomText>
                        </View>
                    </View>}
                    <CustomText className="font-PlusJakartaSans text-green-400 text-sm self-start mb-1">
                        Total Yield
                    </CustomText>
                    {loading && <SkeletonLoader
                        className="rounded-xl bg-gray-900 mb-3 mt-1 w-full h-10"
                        colors={["#111827", "#1f2937", "#111827"]}
                    />}
                    {!loading && <View className="flex-row items-center justify-end self-end mb-6">
                        <Image
                            className="w-10 h-10 mr-2"
                            source={Images.BitzToken}
                        />
                        <CustomText className="font-LatoBold text-green-600 text-[20px]">
                            {(boostData.rewards / Math.pow(10, 11)).toFixed(11)} BITZ
                        </CustomText>
                        <View className="self-end absolute top-9">
                            <CustomText className="font-PlusJakartaSansSemiBold text-green-400 text-sm">
                                (${(boostData.rewards / Math.pow(10, 11) * bitzPrice).toFixed(2)})
                            </CustomText>
                        </View>
                    </View>}
                    {loading && <SkeletonLoader
                        className="rounded-full bg-gray-900 w-full h-14 overflow-hidden mb-3 mt-1"
                        colors={["#111827", "#1f2937", "#111827"]}
                    />}
                    {!loading && <Button
                        containerClassName="self-end rounded-full w-[60%] mb-1 border-2 border-solid border-green-600 mt-1"
                        className="py-1 bg-baseBg rounded-full items-center"
                        textClassName="text-green-600"
                        title="Claim"
                        onPress={() => {
                            if(isUseKeypair()) onClaimAll()
                        }}
                    />}
                    <View className="border-t my-3 border-green-400 w-full"/>
                    <View className="self-start flex-row mt-1 mb-2">
                        <Image
                            className="w-8 h-8 mr-2"
                            source={Images.sBitzToken}
                        />
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">Staked sBitz</CustomText>
                    </View>
                    <View className="w-full mt-1 border-green-600 border p-2 rounded-lg">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">Staked Balance</CustomText>
                        <View className="flex-row justify-end items-center self-end mt-2 w-full">
                            <Image
                                className="w-8 h-8 mr-2"
                                source={Images.sBitzToken}
                            />
                            <CustomText className="text-primary font-LatoBold text-lg mr-1">{balance?.amountUI ?? "0"}</CustomText>
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg mb-[1px]">sBITZ</CustomText>
                        </View>
                    </View>
                    <View className="w-full border-green-600 border p-2 rounded-lg">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">Daily Avg</CustomText>
                        <View className="flex-row justify-end items-center self-end mt-2 w-full">
                            <Image
                                className="w-8 h-8 mr-2"
                                source={Images.BitzToken}
                            />
                            <CustomText className="text-primary font-LatoBold text-lg mr-1">
                                {(computeBitzSbitzRewards(
                                    +printBN(new BN(parseFloat(balance?.amount).toFixed(0) ?? 0), 11),
                                    ((boostData.boosts?.["5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja"]?.boost?.totalDeposits ?? 0) /
                                        Math.pow(10, boostData.boosts?.["5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja"]?.decimals ?? 1)),
                                    1
                                ).sbitzPredictedYield[0] || 0).toFixed(11)}
                            </CustomText>
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg mb-[1px]">BITZ</CustomText>
                         </View>
                         <CustomText className="text-green-400 font-PlusJakartaSansSemiBold text-xs self-end">
                            (${((computeBitzSbitzRewards(
                                +printBN(new BN(parseFloat(balance?.amount).toFixed(0) ?? 0), 11),
                                ((boostData.boosts?.["5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja"]?.boost?.totalDeposits ?? 0) /
                                    Math.pow(10, boostData.boosts?.["5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja"]?.decimals ?? 1)),
                                1
                            ).sbitzPredictedYield[0] || 0) * bitzPrice).toFixed(2)})
                        </CustomText>
                    </View>
                    <View className="w-full border-green-600 border p-2 rounded-lg">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">You receive</CustomText>
                        <View className="flex-row justify-end items-center self-end mt-2 w-full">
                            <Image
                                className="w-8 h-8 mr-2"
                                source={Images.BitzToken}
                            />
                            <CustomText className="text-green-600 font-LatoBold text-lg mr-1">{stake["GeUdiTzzAzKUi4WkZj2kxS9J9HC61gxW1HSBBJ9qtdPf"]?.rewards ?? 0}</CustomText>
                            <CustomText className="text-green-600 font-PlusJakartaSansSemiBold text-lg mb-[1px]">BITZ</CustomText>
                        </View>
                        <CustomText className="text-green-400 font-PlusJakartaSansSemiBold text-xs self-end">
                            (${(parseFloat(stake["GeUdiTzzAzKUi4WkZj2kxS9J9HC61gxW1HSBBJ9qtdPf"]?.rewards ?? 0) * bitzPrice).toFixed(2)})
                        </CustomText>
                    </View>
                    <View className="flex-row gap-x-2 mt-2">
                        <Button
                            containerClassName="rounded-full w-1/2 mb-3 border-2 border-solid border-green-600 mt-1"
                            className="py-1 bg-baseBg rounded-full items-center"
                            textClassName="text-green-600"
                            title="Stake"
                            onPress={() => {}}
                        />
                        <Button
                            containerClassName="rounded-full w-1/2 mb-3 border-2 border-solid border-green-600 mt-1"
                            className="py-1 bg-baseBg rounded-full items-center"
                            textClassName="text-green-600"
                            title="Unstake"
                            onPress={() => {}}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    )
}

interface StakeRowProps {
    boost: string
    bitzPrice: number
    loading: boolean
    loadStakes: () => void,
    navigationProps: TabStakeScreenProps
}

function StakeRow(props: StakeRowProps) {
    const { boost, bitzPrice, navigationProps } = props
    const boosts = useSelector((state: RootState) => state.boost.boosts)    

    return (
        <View key={`boost-${BOOSTLIST[boost].id}`} className="mx-8">
            <View className="flex-row items-center w-fit justify-between mb-1">
                <View className="flex-row items-center">
                    <Image
                        className="w-8 h-8 mr-2"
                        source={Images[BOOSTLIST[boost].tokenImage as keyof typeof Images]}
                    />
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">BITZ</CustomText>
                </View>
                <View className="flex-row items-center">
                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">Price: </CustomText>
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">${bitzPrice.toFixed(2)}</CustomText>
                </View>
            </View>
            <View className="flex-row items-center w-fit justify-between">
                <View className="flex-row items-center">
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">Total Staker: </CustomText>
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg">{boosts[boost]?.boost?.totalStakers ?? 0}</CustomText>
                </View>
                <View className="flex-row items-center">
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">My Share: </CustomText>
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">{`${((boosts[boost]?.stake?.balance ?? 0) / (boosts[boost]?.boost?.totalDeposits ?? 1) * 100).toFixed(3)}%`}</CustomText>
                </View>
            </View>
            <View className="flex-row items-center justify-end">
                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">Total Deposit: </CustomText>
                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">{(boosts[boost]?.boost?.totalDeposits ?? 0) / Math.pow(10, boosts[boost]?.decimals ?? 0)} BITZ</CustomText>
            </View>
            <View className="flex-row items-center justify-end">
                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">My Deposit: </CustomText>
                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md">{(boosts[boost]?.stake?.balance ?? 0) / Math.pow(10, boosts[boost]?.decimals ?? 0)} BITZ</CustomText>
            </View>
            <View className="items-end mb-1">
                <CustomText className="text-green-400 font-PlusJakartaSansSemiBold text-md">
                    (${((boosts[boost]?.stake?.balance ?? 0) / Math.pow(10, boosts[boost]?.decimals ?? 0) * bitzPrice).toFixed(2)})
                </CustomText>
            </View>
            <View className="flex-row gap-x-2 mb-1">
                <Button
                    containerClassName="rounded-full w-1/2 border-2 border-solid border-green-600 mt-1"
                    className="py-1 bg-baseBg rounded-full items-center"
                    textClassName="text-green-600"
                    title="Deposit"
                    onPress={() => navigationProps.navigation.navigate('DepositStake', {
                        boost: boost
                    })}
                />
                <Button
                    containerClassName="rounded-full w-1/2 border-2 border-solid border-green-600 mt-1"
                    className="py-1 bg-baseBg rounded-full items-center"
                    textClassName="text-green-600"
                    title="Withdraw"
                    onPress={() => navigationProps.navigation.navigate('WithdrawStake', {
                        boost: boost
                    })}
                />
            </View>
        </View>
    )
}
