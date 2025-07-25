import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { POOL_LIST } from '@constants'
import { PoolState } from '@store/types'

const initialState: PoolState = {
    byId: Object.fromEntries(Object.keys(POOL_LIST).map(item => [item, {
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
    }])),
    order: Object.keys(POOL_LIST),
}

const poolSlice = createSlice({
    name: 'pools',
    initialState: initialState,
    reducers: {
        addPool: (state, action: PayloadAction<{ id: string, walletAddress: string }>) => {
            const { id, walletAddress } = action.payload
            state.byId[id] = {
                ...state.byId[id],
                id: id,
                show: true,
                walletAddress: walletAddress,
                running: false,
                rewards: 0.0,
                avgRewards: 0.0,
                lastKnownRewards: 0.0,
                lifetimeRewards: 0.0,
                avgInitiatedAt: new Date().getTime(),
                lastCheckAt: new Date().getTime(),
                totalMachine: 0,
                machines: [],
            }
            state.order = [...Object.keys(POOL_LIST)]
        },
        visiblePools: (state, action: PayloadAction<{ id: string, show: boolean }>) => {
            const { id, show } = action.payload
            state.byId[id] = {
                ...state.byId[id],
                show: show
            }
        },
        joinMinerToPool(state, action: PayloadAction<{ poolId: string, walletAddress: string }>) {
            const { poolId, walletAddress } = action.payload
            state.byId[poolId] = {
                ...state.byId[poolId],
                walletAddress: walletAddress
            }
        },
        updateBalance(state, action: PayloadAction<{
            poolId: string
            totalMachine: number
            running: boolean 
            rewards: number
            avgRewards: number
            lastKnownRewards: number
            lifetimeRewards: number
            avgInitiatedAt: number
            lastCheckAt: number
        }>) {
            const {
                poolId, totalMachine, rewards, running, avgRewards, avgInitiatedAt,
                lifetimeRewards, lastKnownRewards, lastCheckAt
            } = action.payload
            state.byId = {
                ...state.byId,
                [poolId]: {
                    ...state.byId[poolId],
                    running: running,
                    totalMachine: totalMachine,
                    rewards: rewards,
                    avgRewards: avgRewards,
                    avgInitiatedAt: avgInitiatedAt,
                    lastKnownRewards: lastKnownRewards,
                    lifetimeRewards: lifetimeRewards,
                    lastCheckAt: lastCheckAt
                }
            }
        },
        // updateBalance(state, action: PayloadAction<{
        //     poolId: string, running: boolean, avgRewards: number, rewardsBitz: number,
        // }>) {
        //     const { poolId, totalRunning, avgBitz, rewardsBitz } = action.payload
        //     state.byId[poolId] = {
        //         ...state.byId[poolId],
        //         running: 
        //         totalRunning: totalRunning,
        //         avgBitz: avgBitz,
        //         rewardsBitz: rewardsBitz,
        //     }
        // },
        // updateMachine(state, action: PayloadAction<{
        //     poolId: string, machine: number
        // }>) {
        //     const { poolId, machine } = action.payload
        //     state.byId[poolId] = {
        //         ...state.byId[poolId],
        //         machine: machine
        //     }
        // },
        reorderPools: (state, action: PayloadAction<string[]>) => {
            state.order = action.payload;
        },
        resetPool(state) {
            Object.assign(state, initialState)
        }
    }
})

export const poolActions = poolSlice.actions
export const poolReducer = poolSlice.reducer
