import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { useSelector } from "react-redux"

import { Colors, Fonts } from "@styles"
import { RootState } from "@store/types"

import StartScreen from "@screens/startup/StartScreen"
import TabNavigation from "./BottomTabNavigation"
// wallet
import ReceiveScreen from "@screens/wallet/ReceiveScreen"
// stake
import DepositStakeScreen, { screenOptions as depositStakeOptions } from "@screens/stake/DepositStakeScreen"
import WithdrawStakeScreen, { screenOptions as withdrawStakeOptions } from "@screens/stake/WithdrawStakeScreen"
// settings
import RPCScreen from "@screens/settings/RPCScreen"
import PrivateKeyScreen from "@screens/settings/PrivateKeyScreen"
import TokenScreen, { screenOptions as tokenOptions } from "@screens/wallet/TokenScreen"
import ManagePoolScreen, { screenOptions as managePoolOptions } from "@screens/monitoring/ManagePoolScreen"
import PoolDetailScreen, { screenOptions as poolDetailOptions } from "@screens/monitoring/PoolDetailScreen"
import SwapScreen, { screenOptions as swapOptions } from "@screens/wallet/SwapScreen"
import SendScreen from "@screens/wallet/SendScreen"

const NativeStack = createNativeStackNavigator()

export default function MainNavigation() {
    const publicKey = useSelector((state: RootState) => state.wallet.publicKey)

    return (
        <NativeStack.Navigator initialRouteName={publicKey? "BottomTab" : "Start"}>
            {!publicKey && <NativeStack.Screen
                name="Start"
                component={StartScreen}
                options={{ headerShown: false }}
            />}
            <NativeStack.Screen
                name="PrivateKey"
                component={PrivateKeyScreen}
                options={{ headerShown: false }}
            />
            <NativeStack.Screen
                name="BottomTab"
                component={TabNavigation}
                options={{ headerShown: false}}
            />
            <NativeStack.Screen
                name="ManagePool"
                component={ManagePoolScreen}
                options={managePoolOptions}
            />
            <NativeStack.Screen
                name="PoolDetail"
                component={PoolDetailScreen}
                options={poolDetailOptions}
            />
            <NativeStack.Screen
                name="DepositStake"
                component={DepositStakeScreen}
                options={depositStakeOptions}
            />
            <NativeStack.Screen
                name="WithdrawStake"
                component={WithdrawStakeScreen}
                options={withdrawStakeOptions}
            />
            <NativeStack.Screen
                name="Receive"
                component={ReceiveScreen}
                options={{
                    headerTintColor: Colors.primary,
                    headerTitleStyle: {
                        fontFamily: Fonts.PlusJakartaSansSemiBold,
                        color: Colors.primary,
                    },
                    // headerTitleAlign: 'center',
                    // headerTitleAlign: 'center',
                    headerStyle: { backgroundColor: Colors.baseBg }
                }}
            />
            <NativeStack.Screen
                name="Send"
                component={SendScreen}
            />
            <NativeStack.Screen
                name="Swap"
                component={SwapScreen}
                options={swapOptions}
            />
            <NativeStack.Screen
                name="Token"
                component={TokenScreen}
                options={tokenOptions}
            />
            <NativeStack.Screen
                name="RPC"
                component={RPCScreen}
                options={{ headerShown: false }}
            />
        </NativeStack.Navigator>
    )
}