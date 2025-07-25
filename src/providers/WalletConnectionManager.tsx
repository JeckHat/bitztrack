import { POOL_LIST } from "@constants"
import { BoostConfig, Proof } from "@models"
import { Connection } from "@solana/web3.js"

import { store } from "@store/index"
import { BoostState, BoostType, PoolType } from "@store/types"

const initState = store.getState()
let connection: Connection = new Connection(`https://${initState.config!.rpcUrl}`)
let rpcUrl: string | null = initState.config?.rpcUrl ?? ""
let walletAddress: string | null = initState.wallet?.publicKey ?? ""
let useKeypair: boolean = initState.wallet?.usePrivateKey ?? false
let boost: BoostState = initState.boost ?? { boosts: {}, socketAccounts: {}, rewards: 0, avgRewards: 0, netDeposits: 0 }
let pools: Record<string, PoolType> = initState.pools?.byId ?? Object.fromEntries(Object.keys(POOL_LIST)
    .map(item => [item, {
        id: item,
        show: true,
        walletAddress: "",
        running: false,
        rewards: 0.0,
        avgRewards: 0.0,
        lastKnownRewards: 0.0,
        lifetimeRewards: 0.0,
        avgInitiatedAt: new Date().getTime(),
        lastCheckAt: new Date().getTime(),
        totalMachine: 0,
        machines: [],
    }]))

function isBoostEqual(a: BoostType, b: BoostType): boolean {
    return (
        a.boost?.rewardsFactor?.bits === b.boost?.rewardsFactor?.bits &&
        a.boost?.totalDeposits === b.boost?.totalDeposits &&
        a.boostAddress === b.boostAddress &&
        a.stake?.balance === a.stake?.balance &&
        a.stake?.lastClaimAt === a.stake?.lastClaimAt &&
        a.stake?.lastDespositAt === a.stake?.lastDespositAt &&
        a.stake?.lastWithdrawAt === a.stake?.lastWithdrawAt &&
        a.stake?.lastRewardsFactor?.bits === a.stake?.lastRewardsFactor?.bits &&
        a.stake?.rewards === a.stake?.rewards &&
        a.stakeAddress === b.stakeAddress &&
        a.decimals === b.decimals &&
        a.rewards === b.rewards
    );
}

function isBoostConfigEqual(a?: BoostConfig, b?: BoostConfig): boolean {
    if (a === undefined && b === undefined) return false;
    return (
        a?.rewardsFactor?.bits === b?.rewardsFactor?.bits &&
        a?.takeRate === b?.takeRate &&
        a?.len === b?.len &&
        a?.totalWeight === b?.totalWeight
    );
}

function isBoostProofEqual(a?: Proof, b?: Proof): boolean {
    if (a === undefined && b === undefined) return false;
    return (
        a?.balance === b?.balance && 
        a?.lastClaimAt === b?.lastClaimAt && 
        a?.lastHashAt === b?.lastHashAt && 
        a?.totalRewards === b?.totalRewards && 
        a?.totalHashes === b?.totalHashes
    );
}

function isPoolEqual(a?: PoolType, b?: PoolType): boolean {
    if (a === undefined && b === undefined) return false;
    return (
        a?.totalMachine === b?.totalMachine && 
        a?.rewards === b?.rewards && 
        a?.avgRewards === b?.avgRewards && 
        a?.running === b?.running && 
        a?.lastKnownRewards === b?.lastKnownRewards && 
        a?.walletAddress === b?.walletAddress
    );
}

function isBoostRecordEqual(
    recordA: Record<string, BoostType>,
    recordB: Record<string, BoostType>
  ): boolean {
    const keysA = Object.keys(recordA);
    const keysB = Object.keys(recordB);
  
    if (keysA.length !== keysB.length) return false;
  
    for (const key of keysA) {
        if (!recordB.hasOwnProperty(key)) return false;
    
        const a = recordA[key];
        const b = recordB[key];
    
        if (!isBoostEqual(a, b)) return false;
    }
  
    return true;
  }

function createConnection(rpcUrl: string) {
    connection = new Connection(`https://${rpcUrl}`)
}

store.subscribe(() => {
    const state = store.getState()
    const newRpcUrl = state.config?.rpcUrl ?? ""
    const newWalletAddress = state.wallet?.publicKey ?? ""
    const newBoosts = state.boost ?? {
        boosts: {},
        boostConfig: undefined,
        boostProof: undefined,
        boostProofAddress: undefined, boostConfigAddress: undefined,
        socketAccounts: {},
        rewards: 0,
        avgRewards: 0
    }
    const newPools = state.pools?.byId ?? {}
    const newUseKeypair = state.wallet?.usePrivateKey ?? false
    
    if (newRpcUrl !== rpcUrl) {
        createConnection(newRpcUrl)
        rpcUrl = newRpcUrl
    }

    if (newWalletAddress !== walletAddress) {
        walletAddress = newWalletAddress
    }

    if (!isBoostRecordEqual(boost.boosts, newBoosts.boosts)) {
        boost = {
            ...boost,
            boosts: { ...newBoosts.boosts }
        }
    }

    if (newBoosts.boostConfig) {
        if (!isBoostConfigEqual(boost.boostConfig, newBoosts.boostConfig)) {
            boost = {
                ...boost,
                boostConfig: newBoosts.boostConfig
            }
        }
    }

    if (newBoosts.boostProof) {
        if (!isBoostProofEqual(boost.boostProof, newBoosts.boostProof)) {
            boost = {
                ...boost,
                boostProof: newBoosts.boostProof
            }
        }
    }

    if (boost.boostConfigAddress !== newBoosts.boostConfigAddress) {
        boost = {
            ...boost,
            boostConfigAddress: newBoosts.boostConfigAddress
        }
    }

    if (boost.boostProofAddress !== newBoosts.boostProofAddress) {
        boost = {
            ...boost,
            boostProofAddress: newBoosts.boostProofAddress
        }
    }

    if (useKeypair !== newUseKeypair) {
        useKeypair = newUseKeypair
    }

    // Object.keys(POOL_LIST).map(item => {
    //     if(!isPoolEqual(pools[item], newPools[item])) {
    //         pools[item] = newPools[item]
    //     }
    // })

})

export function getConnection() {
    return connection
}

export function getWalletAddress() {
    return walletAddress
}

export function getBoostsRedux() {
    return boost.boosts
}

export function getBoostConfigAddress() {
    return boost.boostConfigAddress
}

export function getBoostProofAddress() {
    return boost.boostProofAddress
}

export function isUseKeypair() {
    return useKeypair
}

export function getPools() {
    return pools
}

export function getPoolById(id: string) {
    const pool = store.getState()?.pools?.byId[id];
    return JSON.parse(JSON.stringify(pool)); 
}
