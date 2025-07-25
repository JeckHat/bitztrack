import { useEffect, useReducer } from "react";
import { Image, RefreshControl, SafeAreaView, ScrollView, View } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { twMerge } from "tailwind-merge";
import {
    ComputeBudgetProgram,
    PublicKey,
    SendTransactionError,
    TransactionMessage,
    VersionedTransaction
} from "@solana/web3.js";

import { Button, CustomText, HeaderButton, Input, ModalTransaction, OptionMenu } from "@components";
import { createStackOptions, DepositStakeNavigationProps } from "@navigations/types";
import { BITZ_MINT, BOOSTLIST, COMPUTE_UNIT_LIMIT, TOKENLIST } from "@constants";
import Images from "@assets/images";
import { RootState } from "@store/types";
import { depositStakeInstruction, getLiquidityPair, getStakeBitz } from "@services/bitz";
import { getBalance } from "@services/eclipse";
import { getConnection } from "@providers";
import { getKeypair, uiActions } from "@store/actions";
import { useBottomModal } from "@hooks";
import { getAPILevel, shortenAddress, toDecimalString } from "@helpers";
import { Colors, Fonts } from "@styles";
import { ChevronLeftIcon } from "@assets/icons";

interface FormState {
    tokenBitz: {
        limit: number
        value: string
        touched: boolean
        valid: boolean
    },
    tokenPair: {
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
        lpMint?: string
    },
    fee: number,
    currentEdit: 'tokenBitz' | 'tokenPair'
    isValid: boolean
}

type FormAction =
    | {
        type: 'SET_FIELD'
        field: keyof Omit<FormState, 'currentEdit' | 'isValid' | 'stakeData' | 'fee'>
        pairDecimals: number
        value: string
    }
    | {
        type: 'SET_STAKE_DATA'
        ratio: number
        limitBitz: number
        limitPair: number
        unstake: number
        staked: number
        stakedBitz: number
        stakedPair: number
        pairDecimals: number
        lpBalanceBitz?: number
        lpBalancePair?: number
        shares?: number,
        lpMint?: string
    }
    | {
        type: 'SET_FEE'
        fee: number
    }

const initialState: FormState = {
    tokenBitz: {
        limit: 0.0,        
        touched: false,
        valid: false,
        value: "",
    },
    tokenPair: {
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
    currentEdit: 'tokenBitz',
    isValid: false
};


function formReducer(state: FormState, action: FormAction): FormState {
    switch(action.type) {
        case 'SET_FIELD': {
            let bitzValue = ""
            let pairValue = ""
            if (action.field === 'tokenBitz') {
                bitzValue = action.value
                pairValue = action.value? (Math.floor((parseFloat(action.value) / state.stakeData.ratio) 
                    * Math.pow(10, action.pairDecimals)) / Math.pow(10, action.pairDecimals))
                    .toString() : ""
            } else {
                pairValue = action.value
                bitzValue = action.value? (Math.floor((parseFloat(action.value) * state.stakeData.ratio) 
                    * Math.pow(10, 11)) / Math.pow(10, 11)).toString() : ""
            }
            let isValid = true
            isValid = isValid && !!action.value
            isValid = isValid && state.tokenBitz.limit >= (bitzValue? parseFloat(bitzValue) : 0)
            if (state.stakeData.lpMint !== BITZ_MINT) {
                isValid = isValid && state.tokenPair.limit >= (pairValue? parseFloat(pairValue) : 0)
            }
            return {
                ...state,
                tokenBitz: {
                    ...state.tokenBitz,
                    touched: true,
                    value: bitzValue,
                    valid: state.tokenBitz.limit >= (bitzValue? parseFloat(bitzValue) : 0) 
                },
                tokenPair: {
                    ...state.tokenPair,
                    touched: true,
                    value: pairValue,
                    valid: state.tokenPair.limit >= (pairValue? parseFloat(pairValue) : 0) 
                },
                currentEdit: action.field,
                isValid: isValid
            }
        }
        case 'SET_STAKE_DATA': {
            let bitzValue = ""
            let pairValue = ""
            if (state.currentEdit === 'tokenBitz') {
                bitzValue = state.tokenBitz.value
                pairValue = bitzValue? (Math.floor((parseFloat(bitzValue) / action.ratio) 
                    * Math.pow(10, action.pairDecimals)) / Math.pow(10, action.pairDecimals))
                    .toString() : ""
            } else {
                pairValue = state.tokenPair.value
                bitzValue = pairValue? (Math.floor((parseFloat(pairValue) * action.ratio) 
                    * Math.pow(10, 11)) / Math.pow(10, 11)).toString() : ""
            }
            let isValid = true
            isValid = isValid && !!bitzValue
            isValid = isValid && !!pairValue
            isValid = isValid && action.limitBitz >= (bitzValue? parseFloat(bitzValue) : 0)
            if (action.lpMint !== BITZ_MINT) {
                isValid = isValid && action.limitPair >= (pairValue? parseFloat(pairValue) : 0)
            }
            return {
                ...state,
                tokenBitz: {
                    ...state.tokenBitz,
                    limit: action.limitBitz,
                    valid: action.limitBitz >= (bitzValue? parseFloat(bitzValue) : 0),
                    value: bitzValue
                },
                tokenPair: {
                    ...state.tokenPair,
                    limit: action.limitPair,
                    valid: action.limitPair >= (pairValue? parseFloat(pairValue) : 0),
                    value: pairValue
                },
                stakeData: {
                    ...state.stakeData,
                    ratio: action.ratio,
                    unstake: action.unstake,
                    staked: action.staked,
                    stakedBitz: action.stakedBitz,
                    stakedPair: action.stakedPair,
                    lpBalanceBitz: action.lpBalanceBitz ?? 0,
                    lpBalancePair: action.lpBalancePair ?? 0,
                    shares: action.shares ?? 0,
                    lpMint: action.lpMint
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

export default function DepositStakeScreen({ navigation, route }: DepositStakeNavigationProps) {
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
            const [balanceBitz, stakeBitz] = await Promise.all([
                getBalance(walletAddress, BITZ_MINT).then((res) => res),
                getStakeBitz(BITZ_MINT, boostAddress)
            ])
            onChangeForms({
                type: 'SET_STAKE_DATA',
                limitBitz: parseFloat(balanceBitz.amountUI),
                limitPair: 0,
                unstake: parseFloat(balanceBitz.amountUI),
                staked: (stakeBitz.stake.balance ?? 0) / Math.pow(10, stakeBitz.decimals),
                ratio: 1.0,
                stakedBitz: 0.0,
                stakedPair: 0.0,
                pairDecimals: pairDecimals,
                lpMint: boostData.lpMint
            })
        } catch(error) {
            console.log("error", error)
        }
    }

    async function loadDataPair() {
        try {
            const [balanceBitz, balancePair, unstakeBalance, liquidityPair] = await Promise.all([
                getBalance(walletAddress, BITZ_MINT).then((res) => res),
                getBalance(walletAddress, boostData?.pairMint ?? "").then((res) => res),
                getBalance(walletAddress, boostData?.lpMint ?? "").then((res) => res),
                getLiquidityPair(route?.params?.boost ?? "")
            ])
            onChangeForms({
                type: 'SET_STAKE_DATA',
                limitBitz: parseFloat(balanceBitz.amountUI),
                limitPair: parseFloat(balancePair.amountUI),
                unstake: parseFloat(unstakeBalance.amountUI),
                staked: liquidityPair.stakeBalance,
                ratio: (liquidityPair?.LPBalanceBitz ?? 0) / (liquidityPair?.LPBalancePair ?? 1),
                stakedBitz: liquidityPair.stakeAmountBitz,
                stakedPair: liquidityPair.stakeAmountPair,
                lpBalanceBitz: liquidityPair.LPBalanceBitz,
                lpBalancePair: liquidityPair.LPBalancePair,
                shares: liquidityPair.shares,
                pairDecimals: pairDecimals
            })
        } catch(error) {
            console.log("error", error)
        }
    }

    async function onDeposit() {
        
    }

    async function onStake(amount?: number) {
        try{
            dispatch(uiActions.showLoading(true))
            const walletPublicKey = new PublicKey(walletAddress)
            let instructions = []
            
            instructions.push(ComputeBudgetProgram.setComputeUnitLimit({
                units: COMPUTE_UNIT_LIMIT
            }))

            const depositInstruction = await depositStakeInstruction(boostData?.lpMint, boostAddress, amount)
            instructions.push(depositInstruction)

            const connection = getConnection()
            let latestBlock = await connection.getLatestBlockhash();
            let messageV0 = new TransactionMessage({
                payerKey: walletPublicKey,
                recentBlockhash: latestBlock.blockhash,
                instructions: instructions,
            }).compileToLegacyMessage();
            let trx = new VersionedTransaction(messageV0)

            let fee = 0
            const trxFee = await connection.getFeeForMessage(trx.message, "confirmed")
            fee += trxFee.value ?? 0

            const lpBalance = await getBalance(walletAddress, boostData?.lpMint)
            const tokenTransfers = [{
                id: boostData.name,
                ticker: boostData.name,
                isLp: boostData.pairImage? true : false,
                balance: amount
                    ? Math.round(amount * Math.pow(10, 11)) / Math.pow(10, 11)
                    : Math.round(parseFloat(lpBalance.amountUI) * Math.pow(10, 11)) / Math.pow(10, 11),
                tokenImage: 'BitzToken',
                pairImage: boostData.pairImage,
                isMinus: true
            }]
            const transferInfo = [
                {
                    label: 'Account',
                    value: shortenAddress(walletAddress ?? "")
                },
                {
                    label: 'Network Fee',
                    value: `${toDecimalString(fee / Math.pow(10, 9))} ETH`
                }
            ]

            dispatch(uiActions.showLoading(false))
            onShowModal(tokenTransfers, transferInfo, trx)
        } catch(error: any | SendTransactionError) {
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
                                    field: 'tokenBitz',
                                    value: "",
                                    pairDecimals: pairDecimals
                                })
        
                                onChangeForms({
                                    type: 'SET_FIELD',
                                    field: 'tokenPair',
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
                        Deposit
                    </CustomText>
                    <OptionMenu
                        iconSize={16}
                        menu={[
                            {
                                text: 'Withdraw',
                                onPress: () => navigation.replace('WithdrawStake', {
                                    ...route.params,
                                })
                            }
                        ]}
                    />
                </View>
                <View className="m-2 border border-gray-800 border-solid rounded-2xl">
                    <View className="flex-row justify-between items-center gap-x-2 mx-2 mt-4 mb-2">
                        <View>
                            <CustomText className="font-PlusJakartaSansSemiBold text-sm text-[#707070]">DEPOSIT</CustomText>
                        </View>
                        <View className="flex-row items-center gap-x-2">
                            <CustomText
                                className="font-PlusJakartaSansSemiBold text-sm text-[#707070]"
                            >
                                {Math.floor(forms.tokenBitz.limit * Math.pow(10, 11)) / Math.pow(10, 11)}
                            </CustomText>
                            <Button
                                containerClassName="rounded-lg"
                                className="py-1 px-3 bg-[#1D1C22]"
                                textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                                title="HALF"
                                onPress={() => onChangeForms({
                                    type: 'SET_FIELD',
                                    field: 'tokenBitz',
                                    value: (forms.tokenBitz.limit / 2).toFixed(11),
                                    pairDecimals: pairDecimals
                                })}
                            />
                            <Button
                                containerClassName="rounded-lg"
                                className="py-1 px-3 bg-[#1D1C22]"
                                textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                                title="MAX"
                                onPress={() => onChangeForms({
                                    type: 'SET_FIELD',
                                    field: 'tokenBitz',
                                    value: forms.tokenBitz.limit.toString(),
                                    pairDecimals: pairDecimals
                                })}
                            />
                        </View>
                    </View>
                    <View className="flex-row pl-2 pb-4 items-center mt-2 border-b-[0.5px] border-gray-800 border-solid">
                        <Image
                            className="h-8 w-8 mr-1"
                            source={Images.BitzToken}
                        />
                        <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary">BITZ</CustomText>
                        <Input
                            containerClassName="flex-1 ml-4 border-none"
                            inputContainerClassName="border-none border-0 bg-transparent items-end"
                            className={twMerge("font-LatoBold text-lg py-0 text-primary text-right", forms.tokenBitz.touched && !forms.tokenBitz.valid && "text-red-600")}
                            keyboardType='number-pad'
                            value={forms.tokenBitz.value}
                            onChangeText={(text) => onChangeForms({
                                type: 'SET_FIELD',
                                field: 'tokenBitz',
                                value: text,
                                pairDecimals: pairDecimals
                            })}
                        />
                    </View>

                    {boostData?.pairMint && <View className="w-full self-end flex-row justify-between items-center gap-x-2 px-2 mb-2 pt-2 border-t-[0.5px] border-gray-800 border-solid">
                        <View>
                            <CustomText className="font-PlusJakartaSansSemiBold text-sm text-[#707070]">AND</CustomText>
                        </View>
                        <View className="flex-row items-center gap-x-2">
                            <CustomText
                                className="font-PlusJakartaSansSemiBold text-sm text-[#707070]"
                            >
                                {Math.floor(forms.tokenPair.limit * Math.pow(10, pairDecimals)) / Math.pow(10, pairDecimals)}
                            </CustomText>
                            <Button
                                containerClassName="rounded-lg"
                                className="py-1 px-3 bg-[#1D1C22]"
                                textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                                title="HALF"
                                onPress={() => onChangeForms({
                                    type: 'SET_FIELD',
                                    field: 'tokenPair',
                                    value: (forms.tokenPair.limit / 2).toFixed(pairDecimals),
                                    pairDecimals: pairDecimals
                                })}
                            />
                            <Button
                                containerClassName="rounded-lg"
                                className="py-1 px-3 bg-[#1D1C22]"
                                textClassName="font-PlusJakartaSansBold text-sm text-[#707070]"
                                title="MAX"
                                onPress={() => onChangeForms({
                                    type: 'SET_FIELD',
                                    field: 'tokenPair',
                                    value: forms.tokenPair.limit.toString(),
                                    pairDecimals: pairDecimals
                                })}
                            />
                        </View>
                    </View>}
                    {boostData?.pairMint && <View className="flex-row pl-2 mb-4 items-center">
                        <Image
                            className="h-8 w-8 mr-1"
                            source={Images[boostData.pairImage as keyof typeof Images]}
                        />
                        <CustomText className="font-PlusJakartaSansSemiBold text-lg text-primary">{TOKENLIST[boostData.pairMint?? ""].ticker}</CustomText>
                        <Input
                            containerClassName="flex-1 ml-4 border-none"
                            inputContainerClassName="border-none border-0 bg-transparent items-end"
                            className={twMerge("font-LatoBold text-lg py-0 text-primary text-right", forms.tokenPair.touched && !forms.tokenPair.valid && "text-red-600")}
                            keyboardType='number-pad'
                            value={forms.tokenPair.value}
                            onChangeText={(text) => onChangeForms({
                                type: 'SET_FIELD',
                                field: 'tokenPair',
                                value: text,
                                pairDecimals: pairDecimals
                            })}
                        />
                    </View>}
                </View>
                <View className="flex-row justify-between mx-4 mt-2 mb-4">
                    <CustomText className="text-primary font-PlusJakartaSansBold">Transaction fee</CustomText>
                    <CustomText className="text-primary font-PlusJakartaSansBold">
                        0.00000005 ETH
                    </CustomText>
                </View>
                <Button
                    disabled={!forms.isValid}
                    title={"Deposit"}
                    onPress={() => onStake(Number(forms.tokenBitz.value))}
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
                            title={"Stake Token"}
                            onPress={() => onStake()}
                        />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    )
}

export const screenOptions = createStackOptions<'DepositStake'>(({ navigation }) => {
    return {
        headerTitle: "Deposit Stake",
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
