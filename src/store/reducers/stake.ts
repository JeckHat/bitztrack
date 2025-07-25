import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { Stake } from '@models'
import { StakeType } from '@store/types'
import { BN } from '@coral-xyz/anchor'
import { calculateTokensForWithdraw } from '@invariant-labs/sbitz'
import { printBN } from '@helpers'
import { updateStakeThunk } from '@store/thunks'

const initialState: Record<string, StakeType> = {}

const stakeSlice = createSlice({
    name: 'stake',
    initialState: initialState,
    reducers: {
        addStake(state, action: PayloadAction<{address: string, mintAddress: string, stake: Stake}>) {
            const { address, mintAddress, stake } = action.payload
            Object.assign(state, {
                ...state,
                [address]: {
                    ...state[address],
                    address: address,
                    stake: stake,
                    mintAddress: mintAddress
                }
            })
        },
        // updateStake(state, action: PayloadAction<{address: string, stake: Stake}>) {
        //     const { address, stake } = action.payload
        //     let supply = state[address].supply
        //     let newStake = Stake.fromJSON(stake)
        //     const rewards = printBN(calculateTokensForWithdraw(new BN(supply), new BN(newStake.balance), new BN(95699161292)), 11)
        //     Object.assign(state, {
        //         ...state,
        //         [address]: {
        //             ...state[address],
        //             address: address,
        //             stake: stake,
        //             rewards: rewards
        //         }
        //     })
        // },
        resetStakes() {
           return initialState
        }
    },
    extraReducers: (builder) => {
        builder.addCase(updateStakeThunk.fulfilled, (state, action) => {
            const { address, stake, rewards } = action.payload
            state[address] = {
                ...state[address],
                address,
                stake,
                rewards,
            }
        })
    }
})

export const stakeActions = stakeSlice.actions;

export const stakeReducer = stakeSlice.reducer;
