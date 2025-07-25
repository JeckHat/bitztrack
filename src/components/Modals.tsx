import { ReactNode, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Animated,
    BackHandler,
    Dimensions,
    FlatList,
    Image,
    Modal,
    NativeEventSubscription,
    ScrollView,
    TouchableHighlight,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
    ViewStyle,
} from "react-native";
import { twMerge } from "tailwind-merge";

import Images from "@assets/images";
import { ChevronRightIcon, ScanQRIcon } from "@assets/icons";
import { Colors } from "@styles";
import { CustomText } from "./Texts"
import { Button } from "./Buttons";
import { Input } from "./Forms";
import { PublicKey } from "@solana/web3.js";
import Clipboard from "@react-native-clipboard/clipboard";
import { shortenAddress } from "@helpers";
import ReactNativeModal from "react-native-modal";
import { TOKENLIST } from "@constants";
import { BottomSheetView } from "@gorhom/bottom-sheet";

export function LoadingModal(props: { show?: boolean }) {
    if (props.show) {
        return (
            <Modal
                animationType="fade"
                transparent
                visible
                hardwareAccelerated
                statusBarTranslucent={true}
                navigationBarTranslucent={true}
            >
                <View className="flex-1 justify-center items-center bg-[#0008]">
                    <View className="bg-primary rounded-lg flex-row items-center justify-center px-6 py-2">
                        <ActivityIndicator size="small" className="text-gold" />
                        <CustomText className="my-4 text-center font-PlusJakartaSansSemiBold text-xl ml-4 text-black">Loading...</CustomText>
                    </View>
                </View>
            </Modal>
        )
    }

    return null
}

interface BottomModalProps {
    cancelable?: boolean
    children: ReactNode | null
    visible: boolean
    hideModal: () => void
    backdropOpacity?: Animated.Value | number
    containerStyle?: ViewStyle
}

export function BottomModal(props: BottomModalProps) {
    const { cancelable = true, children, hideModal, visible, backdropOpacity, containerStyle } = props

    return (
        <ReactNativeModal
            isVisible={visible}
            onBackdropPress={hideModal}
            onBackButtonPress={hideModal}
            onSwipeComplete={hideModal}
            onDismiss={hideModal}
            animationIn={'slideInUp'}
            animationOut={'slideOutDown'}
            swipeDirection={'down'}
            useNativeDriver={false}
            animationInTiming={700}
            animationOutTiming={700}
            hideModalContentWhileAnimating={true}
            backdropTransitionOutTiming={1}
            style={{ margin: 0, justifyContent: 'flex-end' }}
        >
            {children}
        </ReactNativeModal>
    )
}

interface ModalTransactionProps {
    tokenTransfers: {
        id: string,
        isLp: boolean,
        ticker: string,
        balance: string,
        tokenImage: string,
        pairImage?: string | null,
        isMinus?: boolean
    }[],
    transferInfo: { label: string, value: string }[],
    advanced?: [],
    onClose: () => void,
    onConfirm: () => void
}

export function ModalTransaction(props: ModalTransactionProps) {
    const { tokenTransfers, transferInfo, advanced = [], onClose, onConfirm } = props
    return (
        <BottomSheetView className="w-full pb-6 px-4 bg-baseComponent rounded-t-2xl">
            <View className="items-center mb-2">
                <CustomText className="text-primary font-PlusJakartaSansBold text-xl text-center mb-2">Confirm Transaction</CustomText>
                <CustomText className="text-primary font-PlusJakartaSans text-sm w-full mb-4 text-center">Balance changes are estimated. Amounts and assets involved are not guaranteed.</CustomText>
            </View>
            <View className="bg-baseDarkComponent rounded-2xl overflow-hidden mb-2">
                {tokenTransfers.map(tokenTransfer => (
                    <View
                        key={`token-transfer-${tokenTransfer.id}`}
                        className="flex-row h-[58px] items-center justify-between px-3 border-solid border-y-[0.5px] border-baseComponent"
                    >
                        <View className="flex-row items-center py-3">
                            {tokenTransfer.isLp && <View className="w-10 h-8">
                                <Image
                                    className="w-8 h-8 absolute left-3"
                                    source={Images[tokenTransfer.pairImage as keyof typeof Images]}
                                />
                                <Image
                                    className="w-8 h-8 mr-3"
                                    source={Images[tokenTransfer.tokenImage as keyof typeof Images]}
                                />
                            </View>}
                            {!tokenTransfer.isLp && 
                                <Image
                                    className="w-8 h-8"
                                    source={Images[tokenTransfer.tokenImage as keyof typeof Images]}
                                />
                            }
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold mx-2">{tokenTransfer.ticker}</CustomText>
                        </View>
                        <View className="flex-1 justify-center items-end">
                            {!tokenTransfer.isMinus && <CustomText className="text-end font-PlusJakartaSansSemiBold ml-2 text-green-600">
                                + {tokenTransfer.balance} {tokenTransfer.ticker}
                            </CustomText>}
                            {tokenTransfer.isMinus && <CustomText className="text-end font-PlusJakartaSansSemiBold ml-2 text-red-600">
                                - {tokenTransfer.balance} {tokenTransfer.ticker}
                            </CustomText>}
                        </View>
                    </View>
                ))}
            </View>
            <View className="bg-baseDarkComponent rounded-2xl overflow-hidden mb-2">
                {transferInfo.map((info, idx) => (
                    <View
                        key={`transfer-info-${idx}`}
                        className="flex-row h-[58px] items-center justify-between px-3 border-solid border-y-[0.7px] border-baseComponent"
                    >
                        <View className="flex-row items-center py-3">
                            <CustomText className="text-primary font-PlusJakartaSansSemiBold mx-2">{info.label}</CustomText>
                        </View>
                        <View className="flex-1 justify-center items-end">
                            <CustomText className="text-end font-PlusJakartaSansSemiBold ml-2 text-primary">
                                {info.value}
                            </CustomText>
                        </View>
                    </View>
                ))}
            </View>
            {advanced.length > 0 && <View className="bg-baseDarkComponent rounded-2xl overflow-hidden mb-2">
                <View className="flex-row h-[58px] items-center justify-between px-3 border-solid border-y-[0.7px] border-baseComponent">
                    <View className="flex-row items-center">
                        <CustomText className="text-primary font-PlusJakartaSansSemiBold mx-2 mb-1">Advanced</CustomText>
                    </View>
                    <View className="flex-1 justify-center items-end">
                        <ChevronRightIcon
                            width={24} height={24} color={Colors.primary}
                        />
                    </View>
                </View>
            </View>}
            
            <View className="flex-row justify-center gap-2 mt-4">
                <View className="flex-1">
                    <Button
                        containerClassName="w-full rounded-2xl"
                        className="bg-baseDarkComponent items-center py-2"
                        textClassName="text-primary"
                        title="Close"
                        onPress={onClose}
                    />
                </View>
                <View className="flex-1">
                    <Button
                        containerClassName="w-full rounded-2xl"
                        className="bg-green-600 items-center py-2"
                        title="Confirm"
                        onPress={onConfirm}
                    />
                </View>
            </View>
        </BottomSheetView>
    )
}

interface modalButtonListProps {
    buttons: {
        text: string
        onPress: () => void
    }[]
}

export function ModalButtonList(props: modalButtonListProps ) {
    return (
        <BottomSheetView className="w-full bg-baseComponent rounded-t-2xl">
            <View className="w-28 h-1 bg-gray-600 rounded-lg mt-3 mb-4 self-center"/>
            <View className="items-center mb-2">
                <CustomText className="text-primary font-PlusJakartaSansBold text-xl text-center mb-2">Import Options</CustomText>
                <CustomText className="text-primary font-PlusJakartaSans text-md w-full mb-4 text-center">Balance changes are estimated. Amounts and assets involved are not guaranteed.</CustomText>
            </View>
            <View className="my-2 mx-2">
                {props.buttons.map((button, idx) => (
                    <Button
                        key={`modal-button-list-${idx}`}
                        containerClassName="mb-3"
                        title={button.text}
                        onPress={button.onPress}
                    />
                ))}
            </View>
        </BottomSheetView>
    )
}

export function ModalImportAddress(props: { onImport: (text: string) => void} ) {
    const [address, setAddress] = useState({
        value: '',
        valid: false,
        touched: false,
    })

    function onValidationCheck(text: string) {
        if (typeof text !== 'string' || text.length < 32 || text.length > 44) {
            setAddress({
                value: text,
                valid: false,
                touched: true
            })
        } else {
            let validation = PublicKey.isOnCurve(new PublicKey(text))
            setAddress({
                value: text,
                valid: validation,
                touched: true
            })
        }
    }

    async function onPaste() {
        const text = await Clipboard.getString()
        onValidationCheck(text)
    }

    return (
        <BottomSheetView className="w-full bg-baseComponent px-4 rounded-t-2xl">
            <View className="w-28 h-1 bg-gray-600 rounded-lg mt-3 mb-4 self-center"/>
            <View className="items-center mb-2">
                <CustomText className="text-primary font-PlusJakartaSansBold text-xl text-center mb-2">Import Wallet Address</CustomText>
                <CustomText className="text-primary font-PlusJakartaSans text-md w-full mb-3 text-center">Importing with address only gives view access. You can’t send, claim, stake, withdraw, or mine.</CustomText>
            </View>
            <View className="my-2 mx-2">
                <Input
                    inputContainerClassName="flex-row"
                    className="flex-1 text-primary font-PlusJakartaSans"
                    autoCapitalize="none"
                    value={address.value}
                    isError={!address.valid && address.touched}
                    onChangeText={onValidationCheck}
                    messageError="Invalid Address"
                    suffix={(
                        <View className="flex-row items-center">
                            <Button
                                containerClassName='rounded-none overflow-auto mx-2'
                                className="bg-gold py-1 px-3 rounded-full"
                                textClassName='text-sm'
                                title={"Paste"}
                                onPress={onPaste}
                            />
                            <ScanQRIcon width={24} height={24} color={Colors.primary} />
                        </View>
                    )}
                />
                <Button
                    disabled={!address.valid}
                    containerClassName="mb-3 mt-4"
                    title="Import"
                    onPress={() => props.onImport(address.value)}
                />
            </View>
        </BottomSheetView>
    )
}

export function ModalAlert(props: { title: string, message: string, onClose: () => void }) {
    const { title, message, onClose } = props
    return (
        <BottomSheetView
            className="w-full px-4 bg-baseComponent pb-6"
        >
        {/* <View className="w-full my-6 px-4"> */}
            <View className="items-center mb-2">
                <CustomText className="text-primary font-PlusJakartaSansBold text-2xl text-center mb-2">{title}</CustomText>
                <CustomText className="text-primary font-PlusJakartaSansSemiBold text-md w-full mb-4 text-center">{message}</CustomText>
            </View>
            <Button
                containerClassName="self-center rounded-full w-5/6 mb-3 border-2 border-solid border-green-600 mt-1"
                className="py-1 bg-baseBg rounded-full items-center"
                textClassName="text-green-600"
                title="Ok"
                onPress={onClose}
            />
        </BottomSheetView>
    )
}

export function ModalListToken(props: { show: boolean, hideModal: () => void, dataToken: string[] }) {
    return (
        <BottomModal
            visible={props.show}
            hideModal={props.hideModal}
        >
            <View className="h-[90%] bg-red-200 rounded-t-2xl">
                <View className="mt-1 mx-2 flex-row items-center mb-2">
                    <CustomText onPress={props.hideModal} className="text-black bg-blue-800 px-8">
                        X
                    </CustomText>
                    <View className="flex-1 items-center mr-4">
                        <CustomText className="text-black text-xl mb-1 font-PlusJakartaSansBold">
                            Send
                        </CustomText>
                    </View>
                </View>
                <ScrollView>
                    <TouchableOpacity>
                        <TouchableWithoutFeedback>
                            <View>
                                {props.dataToken.map((token, idx) => (
                                    <View className="flex-row items-center px-3" key={`List-token-send-${idx}`}>
                                        <Image
                                            className="w-10 h-10 rounded-full mr-2"
                                            source={Images[TOKENLIST[token].image as keyof typeof Images]}
                                        />
                                        <View className="flex-1 mb-1">
                                            <CustomText className="text-primary font-PlusJakartaSansSemiBold">
                                                {TOKENLIST[token].name}
                                            </CustomText>
                                            <CustomText className="text-primary text-sm font-PlusJakartaSans">
                                                0.123123123 {TOKENLIST[token].ticker}
                                            </CustomText>
                                        </View>
                                        <CustomText className="font-LatoBold text-md text-primary">
                                            $123.23
                                        </CustomText>
                                    </View>
                                ))}
                        </View>
                        </TouchableWithoutFeedback>
                    </TouchableOpacity>
                </ScrollView>
            </View>
        </BottomModal>
    )
}
