import { createAsyncThunk } from "@reduxjs/toolkit";
import { calculateTokensForWithdraw } from "@invariant-labs/sbitz";
import { BN } from "@coral-xyz/anchor";

import { KeypairWallet, Stake } from "@models";
import { BalanceType, MintType, RootState } from "@store/types";
import { printBN } from "@helpers";
import { ETH_MINT, sBITZ_MINT } from "@constants";
import { FetcherRecords, Market, Network, routingEssentials } from "@invariant-labs/sdk-eclipse";
import { Connection, PublicKey } from "@solana/web3.js";
import { getTwoHopSwapData, serializeAccounts } from "@services/eclipse";
import { getKeypair } from "@store/actions";

export const updateStakeThunk = createAsyncThunk(
    'stake/updateStakeThunk',
    async (
        payload: { address: string; stake: Stake, supply?: string, balance?: string },
        { getState }
    ) => {
        const state = getState() as RootState
        const { address, stake, supply, balance } = payload
    
        const mintAddress = state.stake[address]?.mintAddress
        const reduxSupply = supply ?? state.token[mintAddress].mint.supply

        const reduxBalance = balance ?? state.token[sBITZ_MINT]?.balance.amount
    
        if (!reduxSupply) {
            throw new Error('Supply not found for mint: ' + mintAddress)
        }
    
        const newStake = Stake.fromJSON(stake)
        const rewards = printBN(
            calculateTokensForWithdraw(
                new BN(reduxSupply),
                new BN(newStake.balance ?? "0"),
                new BN(parseFloat(reduxBalance).toFixed(0))
            ),
            state.token[mintAddress].mint.decimals
        )
  
        return {
            address,
            stake: stake.toJSON(),
            rewards,
        }
    }
)

export const updateMintSupply = createAsyncThunk(
    'token/updateMintSupply',
    async (payload:
        { mintAddress: string, mintAuthority: string, supply: string, decimals: number, isInitialized: number, freezeAuthority: string },
        thunkAPI
    ) => {
        const state = thunkAPI.getState() as RootState
        const { mintAddress, mintAuthority, supply, decimals, isInitialized, freezeAuthority } = payload
    
        const stakeAddresses = state.token[mintAddress]?.mint.stakeAddresses || []
    
        if (!supply) {
            throw new Error('Supply not found for mint: ' + mintAddress)
        }

        stakeAddresses.forEach(addr => {
            thunkAPI.dispatch(updateStakeThunk({ address: addr, stake: state.stake[addr].stake, supply: supply }))
        })

        const mint: MintType = {
            ...state.token[mintAddress].mint,
            decimals: decimals,
            isInitialized: isInitialized,
            freezeAuthority: freezeAuthority,
            mintAuthority: mintAuthority,
            supply: supply
        }

        return {
            mintAddress,
            mint
        }

    }
)

export const updateBalance = createAsyncThunk(
    'token/updateBalance',
    async (payload:  { mintAddress: string; amount: string; ataAddress: string }, thunkAPI) => {
        const state = thunkAPI.getState() as RootState
        const { mintAddress, amount, ataAddress } = payload

        const mint = state.token[mintAddress].mint

        const stakeAddresses = mint.stakeAddresses || []

        stakeAddresses.forEach(addr => {
            thunkAPI.dispatch(updateStakeThunk({ address: addr, stake: state.stake[addr].stake, balance: amount }))
        })

        const balance: BalanceType = {
            ...state.token[mintAddress].balance,
            amount: amount,
            amountUI: (parseInt(amount) / mint.decimals).toFixed(mint.decimals),
            ataAddress: ataAddress
        }

        return {
            mintAddress: mintAddress, balance: balance
        }

    }
)

export const fetchTwoHopSwapAccounts = createAsyncThunk(
    'swap/fetchTwoHopSwapAccounts',
    async (payload: { tokenFrom: PublicKey; tokenTo: PublicKey }, { getState, rejectWithValue }) => {
        try {
            const state = getState() as RootState
            const { tokenFrom, tokenTo } = payload

            const keypair = await getKeypair()
            const rpcUrl = state.config.rpcUrl
            const market = Market.build(
                Network.MAIN,
                new KeypairWallet(keypair),
                new Connection(`https://${rpcUrl}`),
                new PublicKey("iNvTyprs4TX8m6UeUEkeqDFjAL9zRCRWcexK9Sd4WEU")
            )

            const accounts = await getTwoHopSwapData({ tokenFrom, tokenTo, market })
            if (!accounts) throw new Error('Accounts fetch returned undefined')

            const serialized = serializeAccounts(accounts)
            return serialized
        } catch (err) {
            console.error('❌ fetchTwoHopSwapAccounts error:', err)
            return rejectWithValue('Failed to fetch swap accounts')
        }
    }
)
