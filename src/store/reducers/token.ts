import { createSlice, PayloadAction } from '@reduxjs/toolkit'

import { BalanceType, MintType, TokenType } from '@store/types'
import { updateBalance, updateMintSupply } from '@store/thunks'

const initialState: Record<string, TokenType> = {}

const tokenSlice = createSlice({
    name: 'token',
    initialState: initialState,
    reducers: {
        addToken(state, action: PayloadAction<{ mintAddress: string, token: TokenType}>) {
            const { mintAddress, token } = action.payload
            Object.assign(state, {
                ...state,
                [mintAddress]: {
                    ...state[mintAddress],
                    mint: token.mint,
                    balance: token.balance
                }
            })
        },
        addMint(state, action: PayloadAction<{mintAddress: string, mint: MintType}>) {
            const { mintAddress, mint } = action.payload
            if (state[mintAddress]) {
                let isExists = state[mintAddress].mint.stakeAddresses.includes(mint.stakeAddresses[0])
                if (!isExists) {
                    let newStakeAddresses = state[mintAddress].mint.stakeAddresses
                    newStakeAddresses.push(mint.stakeAddresses[0])
                    Object.assign(state, {
                        ...state,
                        [mintAddress]: {
                            ...state[mintAddress],
                            mint: {
                                ...mint,
                                stakeAddresses: newStakeAddresses
                            }
                        }
                    })
                }
            } else {
                Object.assign(state, {
                    ...state,
                    [mintAddress]: {
                        balance: {
                            mintAddress: mintAddress,
                            amount: "0",
                            amountUI: "0.0",
                            price: 0.0,
                            ataAddress: mintAddress
                            // address: address,
                            // amountUI: "0",
                            // amount: 0,
                            // price: 0.0,
                            // mintAddress: address
                        },
                        mint: mint
                    }
                })
            }
        },
        addBalance(state, action: PayloadAction<BalanceType>) {
            const { mintAddress, amountUI, amount, price, ataAddress } = action.payload
            Object.assign(state, {
                ...state,
                [mintAddress]: {
                    ...state[mintAddress],
                    balance: {
                        mintAddress: mintAddress,
                        amountUI: amountUI,
                        amount: amount,
                        price: price,
                        ataAddress: ataAddress
                    },
                }
            })
        },
        updateBalance(state, action: PayloadAction<{ mintAddress: string, amountUI: string, amount: string, price: number }>) {
            const { mintAddress, amountUI, amount, price } = action.payload
            Object.assign(state, {
                ...state,
                [mintAddress]: {
                    ...state[mintAddress],
                    balance: {
                        ...state[mintAddress].balance,
                        mintAddress: mintAddress,
                        amountUI: amountUI,
                        amount: amount,
                        price: price,
                    },
                }
            })
        },
        updatePrice(state, action: PayloadAction<{ mintAddress: string, price: number }>) {
            const { mintAddress, price } = action.payload
            Object.assign(state, {
                ...state,
                [mintAddress]: {
                    ...state[mintAddress],
                    balance: {
                        ...state[mintAddress].balance,
                        mintAddress: mintAddress,
                        price: price,
                    },
                }
            })
        },
        resetTokens() {
           return initialState
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(updateMintSupply.fulfilled, (state, action) => {
                const { mintAddress, mint } = action.payload
                Object.assign(state, {
                    ...state,
                    [mintAddress]: {
                        ...state[mintAddress],
                        mint: mint
                    }
                })
            })
            .addCase(updateBalance.fulfilled, (state, action) => {
                const { mintAddress, balance } = action.payload
                Object.assign(state, {
                    ...state,
                    [mintAddress]: {
                        ...state[mintAddress],
                        balance: balance
                    }
                })
            })
    }
})

export const tokenActions = tokenSlice.actions;

export const tokenReducer = tokenSlice.reducer;
