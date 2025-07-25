import { ReactElement } from 'react'

import { Boost, BoostConfig, Proof, Stake } from '@models'
import { FetcherRecords } from '@invariant-labs/sdk-eclipse'
import { serializeAccounts } from '@services/eclipse'

export interface RootState {
    ui: UiState
    wallet: WalletState
    config: ConfigState
    token: Record<string, TokenType>
    // balance: Record<string, BalanceType>
    // mint: Record<string, MintType>
    boost: BoostState
    pools: PoolState
    socket: Record<string, { id: string, account: string }>
    stake: Record<string, StakeType>
    swap: SwapState
}

export interface UiState {
    classNameGlobal: string
    loading: boolean
    bottomModal: {
        visible: boolean
        children?: ReactElement | null
        cancelable?: boolean
    }
}

export interface WalletState {
    publicKey?: string | null
    useMnemonic: boolean
    usePrivateKey: boolean
    allowTrx: boolean
}

export interface ConfigState {
    rpcUrl?: string | null
}

export interface BoostType {
    boost?: Boost
    boostAddress?: string
    stake?: Stake
    stakeAddress?: string
    decimals?: number
    rewards: number
    avgRewards: number
    liquidityPair?: liqudityPairType
}

export interface liqudityPairType {
    depositsBitz: number
    depositsPair: number
    totalValueUsd: number
    shares: number
}

export interface BoostState {
    boosts: Record<string, BoostType>
    boostConfig?: BoostConfig
    boostConfigAddress?: string
    boostProof?: Proof
    boostProofAddress?: string
    socketAccounts: Record<string, { id: string, account: string }>
    rewards: number
    avgRewards: number
    netDeposits: number
}

export interface PoolType {
    id: string
    show: boolean
    walletAddress: string
    running: boolean
    rewards: number
    avgRewards: number
    lastKnownRewards: number
    lifetimeRewards: number
    lastCheckAt: number
    avgInitiatedAt: number
    totalMachine: number
    machines: MachineType[]
}

export interface MachineType {
    name: string
    run: boolean
}

export interface PoolState {
    byId: Record<string, PoolType>
    order: string[]
}

export interface BalanceType {
    mintAddress: string
    amountUI: string
    amount: string
    price: number
    ataAddress: string
}

export interface StakeType {
    address: string
    stake: Stake
    mintAddress: string
    rewards: string
}

export interface MintType {
    mintAuthority: string
    supply: string
    decimals: number
    isInitialized: number
    freezeAuthority: string
    stakeAddresses: string[]
}

export interface TokenType {
    balance: BalanceType
    mint: MintType
}

interface SerializedTick {
    pool: string
    index: number
    sign: boolean
    liquidityChange: string
    liquidityGross: string
    sqrtPrice: string
    feeGrowthOutsideX: string
    feeGrowthOutsideY: string
    secondsPerLiquidityOutside: string
    bump: number
}

interface SerializedPoolStructure {
    tokenX: string
    tokenY: string
    tokenXReserve: string
    tokenYReserve: string
    positionIterator: string
    tickSpacing: number
    fee: string
    protocolFee: string
    liquidity: string
    sqrtPrice: string
    currentTickIndex: number
    tickmap: string
    feeGrowthGlobalX: string
    feeGrowthGlobalY: string
    feeProtocolTokenX: string
    feeProtocolTokenY: string
    secondsPerLiquidityGlobal: string
    startTimestamp: string
    lastTimestamp: string
    feeReceiver: string
    oracleAddress: string
    oracleInitialized: boolean
    bump: number
}

export interface SerializableFetcherRecords {
    pools: Record<string, SerializedPoolStructure>
    tickmaps: Record<string, number[]>
    ticks: Record<string, SerializedTick>
}

export interface SwapState {
    accounts: SerializableFetcherRecords | null
    loading: boolean
    error: string | null
}