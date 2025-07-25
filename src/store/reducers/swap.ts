import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { SerializableFetcherRecords, SwapState } from '@store/types'
import { fetchTwoHopSwapAccounts } from '@store/thunks'

const initialState: SwapState = {
    accounts: null,
    loading: false,
    error: null
}

const swapSlice = createSlice({
    name: 'swap',
    initialState,
    reducers: {
        clearSwapState: state => {
            state.accounts = null
            state.loading = false
            state.error = null
        }
    },
    extraReducers: builder => {
        builder
            .addCase(fetchTwoHopSwapAccounts.pending, state => {
                state.loading = true
                state.error = null
            })
            .addCase(fetchTwoHopSwapAccounts.fulfilled, (state, action: PayloadAction<SerializableFetcherRecords>) => {
                state.loading = false
                state.accounts = action.payload
            })
            .addCase(fetchTwoHopSwapAccounts.rejected, (state, action) => {
                state.loading = false
                state.error = action.payload as string
            })
    }
})

export const swapActions = swapSlice.actions;
export const swapReducer = swapSlice.reducer;