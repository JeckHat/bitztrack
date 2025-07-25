import { createSlice, PayloadAction } from '@reduxjs/toolkit'

const initialState: Record<string, { id: string, account: string }> = {}

const socketSlice = createSlice({
    name: 'socket',
    initialState: initialState,
    reducers: {
        updateSocketAccount(state, action: PayloadAction<{type: string, address: string}>) {
            const { type, address } = action.payload
            Object.assign(state, {
                ...state,
                [`${type}-${address}`]: {
                    id: `${type}-${address}`,
                    account: address 
                }
            })
        },
        resetSockets() {
            return initialState
        }
    }
})

export const socketActions = socketSlice.actions;

export const socketReducer = socketSlice.reducer;
