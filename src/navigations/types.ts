import { BottomTabNavigationOptions, BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RouteProp, CompositeNavigationProp, ParamListBase, Theme } from '@react-navigation/native';
import { NativeStackNavigationOptions, NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { Keypair } from '@solana/web3.js';

export type MainStackParamList = {
    Start: {} | undefined
    PrivateKey: {
        importWallet?: boolean,
        words?: string,
        title?: string,
        isSeedPhrase?: boolean,
        onSubmit?: (keypair: Keypair, words?: string ) => Promise<void>
        onNext?: (navigation: NativeStackNavigationProp<MainStackParamList, "PrivateKey">) => void
    } | undefined
    BottomTab: {} | undefined
    Token: { mintAddress?: string } | undefined
    Receive: { walletAddress?: string } | undefined
    Swap: {} | undefined
    ManagePool: {} | undefined
    PoolDetail: { poolId?: string } | undefined
    DepositStake: { boost?: string } | undefined
    WithdrawStake: { boost?: string } | undefined
    RPC: {} | undefined
}

type NavigationTabsParamList = {
    TabWallet: {} | undefined
    TabMonitoring: {} | undefined
    TabMine: {} | undefined
    TabStake: {} | undefined
    TabSetting: {} | undefined
}

export type StartNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'Start'>
    route: RouteProp<MainStackParamList, 'Start'>
}

export type PrivateKeyNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'PrivateKey'>
    route: RouteProp<MainStackParamList, 'PrivateKey'>
}

export type TabNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'BottomTab'>
    route: RouteProp<MainStackParamList, 'BottomTab'>
}

export type TabWalletScreenProps = {
    navigation: CompositeNavigationProp<BottomTabNavigationProp<NavigationTabsParamList, 'TabWallet'>, NativeStackNavigationProp<MainStackParamList, 'BottomTab'>>
    route: RouteProp<NavigationTabsParamList, 'TabWallet'>
}

export type TabMonitoringScreenProps = {
    navigation: CompositeNavigationProp<BottomTabNavigationProp<NavigationTabsParamList, 'TabMonitoring'>, NativeStackNavigationProp<MainStackParamList, 'BottomTab'>>
    route: RouteProp<NavigationTabsParamList, 'TabMonitoring'>
}

export type TabMineScreenProps = {
    navigation: CompositeNavigationProp<BottomTabNavigationProp<NavigationTabsParamList, 'TabMine'>, NativeStackNavigationProp<MainStackParamList, 'BottomTab'>>
    route: RouteProp<NavigationTabsParamList, 'TabMine'>
}

export type TabStakeScreenProps = {
    navigation: CompositeNavigationProp<BottomTabNavigationProp<NavigationTabsParamList, 'TabStake'>, NativeStackNavigationProp<MainStackParamList, 'BottomTab'>>
    route: RouteProp<NavigationTabsParamList, 'TabStake'>
}

export type TabSettingScreenProps = {
    navigation: CompositeNavigationProp<BottomTabNavigationProp<NavigationTabsParamList, 'TabSetting'>, NativeStackNavigationProp<MainStackParamList, 'BottomTab'>>
    route: RouteProp<NavigationTabsParamList, 'TabSetting'>
}

export type TokenNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'Token'>
    route: RouteProp<MainStackParamList, 'Token'>
}

export type ReceiveNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'Receive'>
    route: RouteProp<MainStackParamList, 'Receive'>
}

export type ManagePoolNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'ManagePool'>
    route: RouteProp<MainStackParamList, 'ManagePool'>
}

export type PoolDetailNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'PoolDetail'>
    route: RouteProp<MainStackParamList, 'PoolDetail'>
}

export type DepositStakeNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'DepositStake'>
    route: RouteProp<MainStackParamList, 'DepositStake'>
}

export type WithdrawStakeNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'WithdrawStake'>
    route: RouteProp<MainStackParamList, 'WithdrawStake'>
}

export type RPCNavigationProps = {
    navigation: NativeStackNavigationProp<MainStackParamList, 'RPC'>
    route: RouteProp<MainStackParamList, 'RPC'>
}

export type TabScreenOptionsProps = {
    navigation: BottomTabNavigationProp<ParamListBase, string>;
    route: RouteProp<ParamListBase, string>;
    theme: Theme;
};

export type TabScreenOptionsFn = (
    props: TabScreenOptionsProps
) => BottomTabNavigationOptions;
  
export function createStackOptions<
    RouteName extends keyof MainStackParamList
>(
    fn: (
        props: NativeStackScreenProps<MainStackParamList, RouteName> & { theme: Theme }
    ) => NativeStackNavigationOptions
) {
    return fn as unknown as ({
        route,
        navigation,
        theme,
    }: {
        route: RouteProp<ParamListBase, string>;
        navigation: NativeStackNavigationProp<ParamListBase, string>;
        theme: Theme;
    }) => NativeStackNavigationOptions;
}
