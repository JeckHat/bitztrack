import { useEffect, useReducer } from "react";
import { Image, RefreshControl, SafeAreaView, ScrollView, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { twMerge } from "tailwind-merge";
import {
    AddressLookupTableAccount,
    ComputeBudgetProgram,
    PublicKey,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { Button, CustomText, HeaderButton, Input, ModalTransaction, OptionMenu } from "@components";
import { createStackOptions, WithdrawStakeNavigationProps } from "@navigations/types";
import { BITZ_MINT, BOOSTLIST, COMPUTE_UNIT_LIMIT, TOKENLIST } from "@constants";
import Images from "@assets/images";
import { RootState } from "@store/types";
import { getLiquidityPair, getStakeBitz, withdrawStakeInstruction } from "@services/bitz";
import { getConnection } from "@providers";
import { getKeypair, uiActions } from "@store/actions";
import { useBottomModal } from "@hooks";
import { getAPILevel, shortenAddress } from "@helpers";
import { Colors, Fonts } from "@styles";
import { ChevronLeftIcon } from "@assets/icons";

interface FormState {
    token: {
        limit: number
        value: string
        touched: boolean
        valid: boolean
    },
    stakeData: {
        unstake: number
        staked: number
        stakedBitz: number
        stakedPair: number
        ratio: number
        shares: number
        lpBalanceBitz: number
        lpBalancePair: number
    },
    fee: number,
    isValid: boolean
}

type FormAction =
    | {
        type: 'SET_FIELD'
        pairDecimals: number
        value: string
    }
    | {
        type: 'SET_STAKE_DATA'
        ratio: number
        limit: number
        staked: number
        stakedBitz: number
        stakedPair: number
        pairDecimals: number
        lpBalanceBitz?: number
        lpBalancePair?: number
        shares?: number
    }
    | {
        type: 'SET_FEE'
        fee: number
    }

const initialState: FormState = {
    token: {
        limit: 0.0,        
        touched: false,
        valid: false,
        value: "",
    },
    stakeData: {
        unstake: 0.0,
        staked: 0.0,
        stakedBitz: 0.0,
        stakedPair: 0.0,
        ratio: 1.0,
        shares: 0.0,
        lpBalanceBitz: 0.0,
        lpBalancePair: 0.0
    },
    fee: 5000,
    isValid: false
};


function formReducer(state: FormState, action: FormAction): FormState {
    switch(action.type) {
        case 'SET_FIELD': {
            let value = action.value
            let isValid = true
            isValid = isValid && !!action.value
            isValid = isValid && state.token.limit >= (value? parseFloat(value) : 0)
            return {
                ...state,
                token: {
                    ...state.token,
                    touched: true,
                    value: value,
                    valid: state.token.limit >= (value? parseFloat(value) : 0)
                },
                isValid: isValid
            }
        }
        case 'SET_STAKE_DATA': {
            let value = state.token.value
            let isValid = true
            isValid = isValid && !!value
            isValid = isValid && action.limit >= (value? parseFloat(value) : 0)
            return {
                ...state,
                token: {
                    ...state.token,
                    limit: action.limit,
                    valid: action.limit >= (value? parseFloat(value) : 0),
                    value: value
                },
                stakeData: {
                    ...state.stakeData,
                    ratio: action.ratio,
                    staked: action.staked,
                    stakedBitz: action.stakedBitz,
                    stakedPair: action.stakedPair,
                    lpBalanceBitz: action.lpBalanceBitz ?? 0,
                    lpBalancePair: action.lpBalancePair ?? 0,
                    shares: action.shares ?? 0,
                },
                isValid: isValid
            }
        }
        case 'SET_FEE': {
            return {
                ...state,
                fee: action.fee
            }
        }
        default:
            return state
    }
} 

export default function WithdrawStakeScreen({ navigation, route }: WithdrawStakeNavigationProps) {
    const boostAddress = route?.params?.boost ?? ""
    const boostData = BOOSTLIST[boostAddress]
    const pairDecimals = TOKENLIST[boostData.pairMint?? ""]?.decimals ?? 0
    const walletAddress = useSelector((state: RootState) => state.wallet.publicKey) ?? ""
    const dispatch = useDispatch()
    const [forms, onChangeForms] = useReducer(formReducer, initialState)
    const { showModal, hideModal } = useBottomModal()

    useEffect(() => {
        const interval = setInterval(() => {
            loadData()
        }, 1000)
        return () => clearInterval(interval)
    }, [])

    async function loadData() {
        if(boostData?.pairMint) {
            loadDataPair()
        } else {
            loadDataBitz()
        }
    }

    async function loadDataBitz() {
        try {
            const stakeBitz = await getStakeBitz(BITZ_MINT, boostAddress)
            onChangeForms({
                type: 'SET_STAKE_DATA',
                limit: (stakeBitz.stake.balance ?? 0) / Math.pow(10, stakeBitz.decimals),
                staked: (stakeBitz.stake.balance ?? 0) / Math.pow(10, stakeBitz.decimals),
                stakedBitz: (stakeBitz.stake.balance ?? 0) / Math.pow(10, stakeBitz.decimals),
                stakedPair: 0.0,
                ratio: 1.0,
                pairDecimals: pairDecimals
            })
        } catch(error) {
            console.log("error", error)
        }
    }

    async function loadDataPair() {
        try {
            const [_, liquidityPair] = await Promise.all([
                getEstimateFee(),
                getLiquidityPair(route?.params?.boost ?? "")
            ])
            
            onChangeForms({
                type: 'SET_STAKE_DATA',
                limit: liquidityPair.stakeBalance,
                staked: liquidityPair.stakeBalance,
                stakedBitz: liquidityPair.stakeAmountBitz,
                stakedPair: liquidityPair.stakeAmountPair,
                ratio: (liquidityPair?.LPBalanceBitz ?? 0) / (liquidityPair?.LPBalancePair ?? 1),
                lpBalanceBitz: liquidityPair.LPBalanceBitz,
                lpBalancePair: liquidityPair.LPBalancePair,
                shares: liquidityPair.shares,
                pairDecimals: pairDecimals
            })
        } catch(error) {
            console.log("error", error)
        }
    }

    async function getEstimateFee(){
        const connection = getConnection()
        const walletPublicKey = new PublicKey(walletAddress)
        const mintPublicKey = new PublicKey(boostData?.lpMint)
        const mintAta = getAssociatedTokenAddressSync(mintPublicKey, walletPublicKey)
        const accountInfo = await connection.getAccountInfo(mintAta)

        let fee = 5000 + 5000
        if (!accountInfo) {
            fee += 5000
        }
        onChangeForms({
            type: 'SET_FEE',
            fee: fee
        })
    }

    async function onWithdraw() {
        try {
            const connection = getConnection()
            const walletPublicKey = new PublicKey(walletAddress)
            dispatch(uiActions.showLoading(true))

            let instructions = []
            instructions.push(ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNIT_LIMIT
            }))

            let feeAta = 0
            let tokenTransfers = []

            const stakeInstruction = await withdrawStakeInstruction(boostData?.lpMint, boostAddress, Number(forms.token.value))
            instructions.push(stakeInstruction)

            if (boostData.lpMint === BITZ_MINT) {
                tokenTransfers.push({
                    id: 'bitz-2',
                    ticker: 'BITZ',
                    isLp: false,
                    balance: (Math.round(Number(forms.token.value) * Math.pow(10, 5)) / Math.pow(10, 5)).toString(),
                    tokenImage: 'BitzToken',
                    isMinus: false
                })
            }

            let luts: AddressLookupTableAccount[] = []
            if (boostData.lut) {
                const res = await connection.getAddressLookupTable(new PublicKey(boostData.lut));
                const addressLookupTable = res.value;
            
                if (addressLookupTable) {
                    luts.push(addressLookupTable);
                }
            }

            let latestBlock = await connection.getLatestBlockhash();
            let messageV0 = new TransactionMessage({
                payerKey: walletPublicKey,
                recentBlockhash: latestBlock.blockhash,
                instructions: instructions,
            }).compileToV0Message(luts);
            let trx = new VersionedTransaction(messageV0);

            const trxFee = await connection.getFeeForMessage(trx.message, "confirmed")

            latestBlock = await connection.getLatestBlockhash('finalized')
            messageV0 = new TransactionMessage({
                payerKey: walletPublicKey,
                recentBlockhash: latestBlock.blockhash,
                instructions: instructions,
            }).compileToV0Message(luts);
            trx = new VersionedTransaction(messageV0);

            const transferInfo = [
                {
                    label: 'Account',
                    value: shortenAddress(walletAddress ?? "")
                },
                {
                    label: 'Network Fee',
                    value: `${((trxFee.value ?? 0) /  Math.pow(10, 9)).toFixed(8)} ETH`
                }
            ]

            dispatch(uiActions.showLoading(false))
            onShowModal(tokenTransfers, transferInfo, trx)
        } catch(error) {
            console.log("error", error)
            dispatch(uiActions.showLoading(false))
        }

    }

    function onShowModal(tokenTransfers: any[], transferInfo: any[], transaction: VersionedTransaction) {
        const connection = getConnection()
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
                        transaction.sign([keypair])    
                        
                        const signature = await connection.sendTransaction(transaction, {
                            skipPreflight: false,
                        });
                        await connection.confirmTransaction(signature, "confirmed")

                        loadData().finally(() => {
                            loadData().finally(() => {
                                onChangeForms({
                                    type: 'SET_FIELD',
                                    value: "",
                                    pairDecimals: pairDecimals
                                })
                                dispatch(uiActions.showLoading(false))
                            })
                        })
                    } catch(error) {
                        console.log("error", error)
                        setTimeout(() => {
                            loadData()
                            dispatch(uiActions.showLoading(false))
                        }, 5000)
                    }
                }}
            />
        )
    }
    
    return (
        <SafeAreaView
            style={{ paddingBottom: getAPILevel() > 34? 20 : 0 }}
            className="flex-1 bg-baseBg"
        >
            <ScrollView
                refreshControl={<RefreshControl refreshing={false} onRefresh={loadData}/>}
                contentContainerClassName="grow-1 pb-[52px]"
            >
                <CustomText className="text-primary font-PlusJakartaSansBold mx-3 text-2xl">Stake {boostData.name}</CustomText>
                <CustomText className="text-[#707070] font-PlusJakartaSansSemiBold mx-3 text-md">Manage your {boostData.name} position.</CustomText>
                <View className="flex-row items-center mt-4 mx-3">
                    <CustomText className="text-primary font-PlusJakartaSansBold text-lg mr-2">
                        Withdraw
                    </CustomText>
                    <OptionMenu
                        iconSize={16}
                        menu={[
                            {
                                text: 'Deposit',
                                onPress: () => navigation.replace('DepositStake', {
                                    ...route.params,
                                })
                            }
                        ]}
                    />
                </View>
                <View className="m-2 border border-gray-800 border-solid rounded-2xl">
                    <View className="flex-row justify-between items-center gap-x-2 mx-2 mt-4 mb-2">
                        <View>
                            <CustomText className="font-PlusJakartaSansSemiBold text-sm text-[#707070]">WITHDRAW</CustomText>
                        </View>
                        <View className="flex-row items-center gap-x-2">
                            <CustomText
                                className="font-PlusJakartaSansSemiBold text-sm text-[#707070]"
                            >
                                {Math.floor(forms.token.limit * Math.pow(10, boostData.decimals)) / Math.pow(10, boostData.decimals)}
                            </CustomText>
                            <Button
                                containerClassName="rounded-lg"
                                className="py-1 px-3 bg-[#1D1C22]"
                                textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                                title="HALF"
                                onPress={() => onChangeForms({
                                    type: 'SET_FIELD',
                                    value: (forms.token.limit / 2).toFixed(boostData.decimals),
                                    pairDecimals: boostData.decimals
                                })}
                            />
                            <Button
                                containerClassName="rounded-lg"
                                className="py-1 px-3 bg-[#1D1C22]"
                                textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                                title="MAX"
                                onPress={() => onChangeForms({
                                    type: 'SET_FIELD',
                                    value: forms.token.limit.toString(),
                                    pairDecimals: boostData.decimals
                                })}
                            />
                        </View>
                    </View>
                    <View className="flex-row pl-2 pb-4 items-center mt-2 border-b-[0.5px] border-gray-800 border-solid">
                        {!boostData?.pairMint && <View className="w-14 h-10 items-center justify-center">
                            <Image
                                className="w-8 h-8"
                                source={Images.BitzToken}
                            />
                        </View>}
                        {boostData?.pairMint && <View className="w-10 h-10 items-center justify-center">
                            <Image
                                className="w-8 h-8 absolute right-0"
                                source={Images[boostData.pairImage as keyof typeof Images]}
                            />
                            <Image
                                className="w-8 h-8 mr-3"
                                source={Images.BitzToken}
                            />
                        </View>}
                        <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary ml-2">{boostData.name}</CustomText>
                        <Input
                            containerClassName="flex-1 ml-4 border-none"
                            inputContainerClassName="border-none border-0 bg-transparent items-end"
                            className={twMerge("font-LatoBold text-lg py-0 text-primary text-right", forms.token.touched && !forms.token.valid && "text-red-600")}
                            keyboardType='number-pad'
                            value={forms.token.value}
                            onChangeText={(text) => onChangeForms({
                                type: 'SET_FIELD',
                                value: text,
                                pairDecimals: pairDecimals
                            })}
                        />
                    </View>
                </View>
                <View className="flex-row justify-between mx-4 mt-2 mb-4">
                    <CustomText className="text-primary font-PlusJakartaSansBold">Transaction fee</CustomText>
                    <CustomText className="text-primary font-PlusJakartaSansBold">
                        {/* {forms.fee / LAMPORTS_PER_SOL} ETH */}
                        0.00000005 ETH
                    </CustomText>
                </View>
                <Button
                    disabled={!forms.isValid}
                    title={"Withdraw"}
                    onPress={onWithdraw}
                />
                <View className="mt-8 mx-3 mb-2">
                    <CustomText className="text-primary font-PlusJakartaSansSemiBold text-xl">Account Info</CustomText>
                    <View className="my-2 flex-row justify-between">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg mt-1">Deposits</CustomText>
                        <View className="items-end flex-1">
                            <View className="flex-row items-center">
                                {!boostData?.pairMint && <View className="w-14 h-10 items-center justify-center">
                                    <Image
                                        className="w-8 h-8"
                                        source={Images.BitzToken}
                                    />
                                </View>}
                                {boostData?.pairMint && <View className="w-14 h-10 items-center justify-center">
                                    <Image
                                        className="w-6 h-6 absolute right-2"
                                        source={Images[boostData.pairImage as keyof typeof Images]}
                                    />
                                    <Image
                                        className="w-6 h-6"
                                        source={Images.BitzToken}
                                    />
                                </View>}
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {forms.stakeData.staked} {TOKENLIST[boostData.lpMint].ticker}
                                </CustomText>
                            </View>
                            {boostData?.pairMint && <View className="flex-row items-center">
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm ml-2">(</CustomText>
                                <Image
                                    className="w-6 h-6 ml-2 mr-1"
                                    source={Images.BitzToken}
                                />
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {forms.stakeData.stakedBitz.toFixed(4)} BITZ
                                </CustomText>
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm ml-2">/</CustomText>
                                <Image
                                          className="w-6 h-6 ml-2 mr-1"
                                    source={Images[boostData.pairImage as keyof typeof Images]}
                                />
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {forms.stakeData.stakedPair.toFixed(4)} {TOKENLIST[boostData.pairMint ?? ""].ticker}
                                </CustomText>
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm ml-2">)</CustomText>
                            </View>}
                        </View>
                    </View>
                    {boostData?.pairMint && forms.stakeData.unstake > 0 && <View className="mt-2 flex-row justify-between">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold text-lg mt-1">Unstaked</CustomText>
                        <View className="items-end">
                            <View className="flex-row items-center">
                                <View className="w-14 h-10 items-center justify-center">
                                    <Image
                                        className="w-6 h-6 absolute right-2"
                                        source={Images[boostData.pairImage as keyof typeof Images]}
                                    />
                                    <Image
                                        className="w-6 h-6"
                                        source={Images.BitzToken}
                                    />
                                </View>
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {forms.stakeData.unstake} {TOKENLIST[boostData.lpMint].ticker}
                                </CustomText>
                            </View>
                            <View className="flex-row items-center">
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm ml-2">(</CustomText>
                                <Image
                                    className="w-6 h-6 ml-2 mr-1"
                                    source={Images.BitzToken}
                                />
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {(forms.stakeData.lpBalanceBitz * (forms.stakeData.unstake * Math.pow(10, boostData.decimals)) / forms.stakeData.shares).toFixed(4)} BITZ
                                </CustomText>
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm ml-2">/</CustomText>
                                <Image
                                    className="w-6 h-6 ml-2 mr-1"
                                    source={Images[boostData.pairImage as keyof typeof Images]}
                                />
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm">
                                    {(forms.stakeData.lpBalancePair * (forms.stakeData.unstake * Math.pow(10, boostData.decimals)) / forms.stakeData.shares)
                                        .toFixed(4)} {TOKENLIST[boostData.pairMint ?? ""].ticker}
                                </CustomText>
                                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-sm ml-2">)</CustomText>
                            </View>
                        </View>
                    </View>}
                </View>
                {boostData?.pairMint && forms.stakeData.unstake > 0 && (
                    <View className="flex-row self-end">
                        <Button
                            containerClassName="rounded-none mr-2"
                            className="py-2 px-6 rounded-full"
                            textClassName="text-sm mb-[1px]"
                            disabled={forms.stakeData.unstake <= 0}
                            title={"Withdraw Token"}
                            onPress={() => {}}
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

export const screenOptions = createStackOptions<'WithdrawStake'>(({ navigation }) => {
    return {
        headerTitle: "Withdraw Stake",
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
