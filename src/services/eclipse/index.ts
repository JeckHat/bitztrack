import {
    PublicKey,
    TransactionInstruction,
} from "@solana/web3.js"
import { AccountLayout, ASSOCIATED_TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddress, MintLayout, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token"
import { BN } from '@coral-xyz/anchor'
import { FetcherRecords, Market, Pair, routingEssentials } from "@invariant-labs/sdk-eclipse"
import { POOLS_WITH_LUTS, simulateSwap, SimulationStatus } from "@invariant-labs/sdk-eclipse/lib/utils"
import { parsePool, PoolStructure, RawPoolStructure, RawTick, Tick, Tickmap } from "@invariant-labs/sdk-eclipse/lib/market"

import { COINGECKO_API, ETH_MINT, GECKO_TERMINAL_PRICE, TOKENLIST } from "@constants"
import { getConnection } from "@providers"
import { SerializableFetcherRecords } from "@store/types"
import { printBN } from "@helpers"

type balanceType = {
    address: string
    amount: number
    amountUI: string
    decimals: number
}

export async function getBalance(walletAddress: string, mintAddress: string): Promise<balanceType> {
    const connection = getConnection()
    const tokenData = TOKENLIST[mintAddress]

    const walletPubKey = new PublicKey(walletAddress)
    const mintPubKey = new PublicKey(mintAddress)
    const tokenProgramPubkey = new PublicKey(tokenData.tokenProgram)

    let accountInfoPubkey = new PublicKey(walletAddress)

    if (mintAddress !== ETH_MINT) {
        accountInfoPubkey = PublicKey.findProgramAddressSync(
            [...[walletPubKey.toBytes()], ...[tokenProgramPubkey.toBytes()],...[mintPubKey.toBytes()]],
            ASSOCIATED_TOKEN_PROGRAM_ID
        )?.[0]
        const accountInfo = await connection.getAccountInfo(accountInfoPubkey)

        if (accountInfo?.data) {
            const accountBalance = AccountLayout.decode(accountInfo.data)
            return {
                address: accountInfoPubkey.toBase58(),
                amount: Number(accountBalance.amount),
                amountUI: (Number(accountBalance.amount) / Math.pow(10, tokenData.decimals)).toFixed(tokenData.decimals),
                decimals: tokenData.decimals
            }
        } else {
            return {
                address: accountInfoPubkey.toBase58(),
                amount: 0,
                amountUI: "0.0",
                decimals: tokenData.decimals
            }
        }
    } else {
        const accountInfo = await connection.getAccountInfo(accountInfoPubkey)

        if (accountInfo) {
            const accountBalance = accountInfo
            return {
                address: accountInfoPubkey.toBase58(),
                amount: accountBalance.lamports,
                amountUI: (accountBalance.lamports / Math.pow(10, tokenData.decimals)).toFixed(tokenData.decimals),
                decimals: tokenData.decimals
            }
        } else {
            return {
                address: accountInfoPubkey.toBase58(),
                amount: 0,
                amountUI: "0.0",
                decimals: tokenData.decimals
            }
        }
    }

    // if (!connection) {
    //     throw new CustomError("Rpc Connection is undefined", 500)
    // }

    // const walletPubkey = new PublicKey(walletAddress)

    // if (mintAddress === ETH_MINT) {
    //     const balance = await connection.getBalance(walletPubkey)
    //     return balance / LAMPORTS_PER_SOL
    // }

    // const account = await connection.getTokenAccountsByOwner(walletPubkey, { mint: new PublicKey(mintAddress) })
    // let tokenAmount
    // if (account?.value?.[0]) {
    //     tokenAmount = await connection.getTokenAccountBalance(account.value[0].pubkey)
    // }
    
    // return tokenAmount?.value?.uiAmount ?? 0
}

export async function getTokenBalance(tokenAddress: string): Promise<number> {
    const connection = getConnection()
    const tokenAmount = await connection.getTokenAccountBalance(new PublicKey(tokenAddress))
    return tokenAmount?.value?.uiAmount ?? 0
}

export async function ensureAtaExists(owner: PublicKey, mint: PublicKey): Promise<TransactionInstruction | null> {
    const connection = getConnection()
    const ata = await getAssociatedTokenAddress(mint, owner);
  
    const accountInfo = await connection.getAccountInfo(ata);
    if (accountInfo === null) {
        return createAssociatedTokenAccountInstruction(
            owner,
            ata,
            owner,
            mint
        );
    }
  
    return null;
}

export async function getTokenPrice(token: string) {
    const { geckoPriceAddress } = TOKENLIST[token]
    return await (geckoPriceAddress?
        geckoPriceAddress === 'ethereum'?
            fetch(`${COINGECKO_API}?vs_currency=usd&ids=${geckoPriceAddress}`, {
                method: 'GET',
                headers: {
                    "x_cg_pro_api_key": "CG-tmwHhmSrX9Jvh3SmE17MeGLb"
                }
            }).then((res) => res.json().then((json) => {
                return parseFloat(json?.[0]?.current_price ?? 60.0)
            }).catch(() => 0))
        :
        
            fetch(`${GECKO_TERMINAL_PRICE}/${geckoPriceAddress}`, {
                method: 'GET',
            }).then((res) => res.json().then((json) => {
                return parseFloat(json?.data?.attributes?.price_in_usd ?? 60.0)
            }).catch(() => 0))
    :
        fetch(TOKENLIST[token].eclipseScan ?? "").then((res) => res.json().then((json) => {
            return parseFloat(json?.metadata?.tokens?.[token]?.price_usdt ?? 0.0)
        }).catch(() => 0)))
}

export interface PoolWithAddress extends PoolStructure {
    address: PublicKey
}

export const findPairs = (tokenFrom: PublicKey, tokenTo: PublicKey, pairs: PoolWithAddress[]) => {
    return pairs.filter(
        pool =>
            (tokenFrom.equals(pool.tokenX) && tokenTo.equals(pool.tokenY)) ||
            (tokenFrom.equals(pool.tokenY) && tokenTo.equals(pool.tokenX))
    )
}

export const hasLuts = (pool: PublicKey) => POOLS_WITH_LUTS.some(p => p.equals(pool))

export const getPoolsFromAddresses = async (
    addresses: PublicKey[],
    marketProgram: Market
): Promise<PoolWithAddress[]> => {
    try {
        const pools = (await marketProgram.program.account.pool.fetchMultiple(
            addresses
        )) as Array<RawPoolStructure | null>
  
        const parsedPools: Array<PoolWithAddress> = []
  
        pools.map((pool, index) => {
            if (pool) {
                parsedPools.push({
                    ...parsePool(pool),
                    address: addresses[index]
                })
            }
        })
  
        return parsedPools
    } catch (e: unknown) {
      const error = ensureError(e)
      console.log(error)
  
      return []
    }
}

export const getPools = async (
    pairs: Pair[],
    marketProgram: Market
): Promise<PoolWithAddress[]> => {
    try {
        const addresses: PublicKey[] = await Promise.all(
            pairs.map(pair => pair.getAddress(marketProgram.program.programId))
        )
  
        return await getPoolsFromAddresses(addresses, marketProgram)
    } catch (e: unknown) {
        const error = ensureError(e)
        console.log(error)
        return []
    }
}

export const findPoolIndex = (address: PublicKey, pools: PoolWithAddress[]) => {
    return pools.findIndex(pool => pool.address.equals(address))
}

export const ensureError = (value: unknown): Error => {
    if (value instanceof Error) return value
  
    let stringified = '[Unable to stringify the thrown value]'
  
    stringified = JSON.stringify(value)
  
    const error = new Error(stringified)
    return error
}

export const getTickmapsFromPools = async (
    pools: PoolWithAddress[],
    marketProgram: Market
): Promise<Record<string, Tickmap>> => {
    try {
        const addresses = pools.map(pool => pool.tickmap)
        const tickmaps = (await marketProgram.program.account.tickmap.fetchMultiple(
            addresses
        )) as Array<Tickmap>

        return tickmaps.reduce((acc, cur, idx) => {
            if (cur) {
                acc[addresses[idx].toBase58()] = cur
            }
            return acc
        }, {} as Record<string, Tickmap>)
    } catch (e: unknown) {
        const error = ensureError(e)
        console.log(error)

        return {}
    }
}

export const getTicksFromAddresses = async (market: Market, addresses: PublicKey[]) => {
    try {
        return (await market.program.account.tick.fetchMultiple(addresses)) as Array<RawTick | null>
    } catch (e: unknown) {
        const error = ensureError(e)
        console.log(error)
  
        return []
    }
}

export const handleSimulate = async (
    // market: Market,
    pools: PoolWithAddress[],
    poolTicks: { [key in string]: Tick[] },
    tickmaps: { [key in string]: Tickmap },
    slippage: BN,
    fromToken: PublicKey,
    toToken: PublicKey,
    amount: BN,
    byAmountIn: boolean
  ): Promise<{
    amountOut: BN
    poolIndex: number
    AmountOutWithFee: BN
    estimatedPriceAfterSwap: BN
    minimumReceived: BN
    priceImpact: BN
    error: string[]
}> => {
    const MAX_U64 = new BN('18446744073709551615')
    const filteredPools = findPairs(fromToken, toToken, pools)
    const errorMessage: string[] = []
    let isXtoY = false
    let result
    let okChanges = 0
    let failChanges = 0
    const initAmountOut = byAmountIn ? new BN(-1) : MAX_U64
  
    let successData = {
        amountOut: initAmountOut,
        poolIndex: 0,
        AmountOutWithFee: new BN(0),
        estimatedPriceAfterSwap: new BN(0),
        minimumReceived: new BN(0),
        priceImpact: new BN(0)
    }
  
    let allFailedData = {
        amountOut: initAmountOut,
        poolIndex: 0,
        AmountOutWithFee: new BN(0),
        estimatedPriceAfterSwap: new BN(0),
        minimumReceived: new BN(0),
        priceImpact: new BN(0)
    }
  
    if (amount.eq(new BN(0))) {
        return {
            amountOut: new BN(0),
            poolIndex: 0,
            AmountOutWithFee: new BN(0),
            estimatedPriceAfterSwap: new BN(0),
            minimumReceived: new BN(0),
            priceImpact: new BN(0),
            error: errorMessage
        }
    }
  
    for (const pool of filteredPools) {
        isXtoY = fromToken.equals(pool.tokenX)
    
        const ticks: Map<number, Tick> = new Map<number, Tick>()
        const poolTicksForAddress = poolTicks[pool.address.toString()]
        if (Array.isArray(poolTicksForAddress)) {
            for (const tick of poolTicksForAddress) {
            ticks.set(tick.index, tick)
            }
        } else {
            errorMessage.push(`Ticks not available for pool ${pool.address.toString()}`)
            continue
        }
  
        const maxCrosses = hasLuts(pool.address)
            ? 34
            : pool.tokenX.toString() === ETH_MINT ||
                pool.tokenY.toString() === ETH_MINT
            ? 10
            : 16
  
        try {
            const swapSimulateResult = simulateSwap({
                xToY: isXtoY,
                byAmountIn: byAmountIn,
                swapAmount: amount,
                slippage: slippage,
                pool: pool,
                ticks: ticks,
                tickmap: tickmaps[pool.tickmap.toString()],
                maxCrosses,
                maxVirtualCrosses: 10
            })
  
            if (!byAmountIn) {
                result = swapSimulateResult.accumulatedAmountIn.add(swapSimulateResult.accumulatedFee)
            } else {
                result = swapSimulateResult.accumulatedAmountOut
            }
            if (
                (byAmountIn ? successData.amountOut.lt(result) : successData.amountOut.gt(result)) &&
                swapSimulateResult.status === SimulationStatus.Ok &&
                swapSimulateResult.amountPerTick.length <= 16
            ) {
                successData = {
                    amountOut: result,
                    poolIndex: findPoolIndex(pool.address, pools),
                    AmountOutWithFee: result.add(swapSimulateResult.accumulatedFee),
                    estimatedPriceAfterSwap: swapSimulateResult.priceAfterSwap,
                    minimumReceived: swapSimulateResult.minReceived,
                    priceImpact: swapSimulateResult.priceImpact
                }
    
                okChanges += 1
            } else if (
                byAmountIn
                    ? allFailedData.amountOut.lt(result)
                    : allFailedData.amountOut.eq(MAX_U64)
                    ? result
                    : allFailedData.amountOut.lt(result)
            ) {
                allFailedData = {
                    amountOut: result,
                    poolIndex: findPoolIndex(pool.address, pools),
                    AmountOutWithFee: result.add(swapSimulateResult.accumulatedFee),
                    estimatedPriceAfterSwap: swapSimulateResult.priceAfterSwap,
                    minimumReceived: swapSimulateResult.minReceived,
                    priceImpact: swapSimulateResult.priceImpact
                }
  
                failChanges += 1
            }
  
            if (swapSimulateResult.status !== SimulationStatus.Ok) {
                errorMessage.push(swapSimulateResult.status)
            }
        } catch (e: unknown) {
            const error = ensureError(e)
            console.log(error)
    
            errorMessage.push(error.message.toString())
        }
    }
    if (okChanges === 0 && failChanges === 0) {
        return {
            amountOut: new BN(0),
            poolIndex: 0,
            AmountOutWithFee: new BN(0),
            estimatedPriceAfterSwap: new BN(0),
            minimumReceived: new BN(0),
            priceImpact: new BN(0),
            error: errorMessage
        }
    }
  
    if (okChanges === 0) {
        return {
            ...allFailedData,
            error: errorMessage
        }
    }
  
    return {
        ...successData,
        error: []
    }
}

export const handleSimulateWithHop = async (
    market: Market,
    tokenIn: PublicKey,
    tokenOut: PublicKey,
    amount: BN,
    byAmountIn: boolean,
    accounts: FetcherRecords
) => {
    const { routeCandidates } = routingEssentials(
        tokenIn,
        tokenOut,
        market.program.programId,
        market.network
    )
    
    for (let i = routeCandidates.length - 1; i >= 0; i--) {
        const [pairIn, pairOut] = routeCandidates[i]
    
        if (
            !accounts.pools[pairIn.getAddress(market.program.programId).toBase58()] ||
            !accounts.pools[pairOut.getAddress(market.program.programId).toBase58()]
        ) {
            const lastCandidate = routeCandidates.pop()!
            if (i !== routeCandidates.length) {
                routeCandidates[i] = lastCandidate
            }
        }
    }

    if (routeCandidates.length === 0) {
        return { simulation: null, route: null, error: true }
    }
    
    const simulations = await market.routeTwoHop(
        tokenIn,
        tokenOut,
        amount,
        byAmountIn,
        routeCandidates,
        accounts
    )
    
    if (simulations.length === 0) {
        return { simulation: null, route: null, error: true }
    }
    
    let best = 0
    let bestFailed = 0
    for (let n = 0; n < simulations.length; ++n) {
        const [, simulation] = simulations[n]
        const [, simulationBest] = simulations[best]
        const [, simulationBestFailed] = simulations[bestFailed]
        const isSwapSuccess =
            simulation.swapHopOne.status === SimulationStatus.Ok &&
            simulation.swapHopTwo.status === SimulationStatus.Ok
    
        const isBestSwapFailed =
            simulationBest.swapHopOne.status !== SimulationStatus.Ok ||
            simulationBest.swapHopTwo.status !== SimulationStatus.Ok
    
        if (byAmountIn) {
            if (
                (simulation.totalAmountOut.gt(simulationBest.totalAmountOut) && isSwapSuccess) ||
                (isSwapSuccess && isBestSwapFailed)
            ) {
                best = n
            }
    
            if (
                !simulation.totalAmountOut.eq(new BN(0)) &&
                simulation.totalAmountOut.gt(simulationBestFailed.totalAmountOut)
            ) {
            bestFailed = n
            }
        } else {
            if (
                (simulation.totalAmountOut.eq(amount) &&
                    simulation.totalAmountIn
                    .add(simulation.swapHopOne.accumulatedFee)
                    .lt(simulationBest.totalAmountIn.add(simulationBest.swapHopOne.accumulatedFee)) &&
                    isSwapSuccess) ||
                (isSwapSuccess && isBestSwapFailed)
            ) {
                best = n
            }
    
            if (
                !simulation.totalAmountOut.eq(new BN(0)) &&
                simulation.totalAmountIn
                    .add(simulation.swapHopOne.accumulatedFee)
                    .lt(
                    simulationBestFailed.totalAmountIn.add(simulationBestFailed.swapHopOne.accumulatedFee)
                    )
            ) {
                bestFailed = n
            }
        }
    }
  
    if (
        simulations[best][1].swapHopOne.status === SimulationStatus.Ok &&
        simulations[best][1].swapHopTwo.status === SimulationStatus.Ok
    ) {

        return {
            simulation: simulations[best][1],
            route: routeCandidates[simulations[best][0]],
            error: false
        }
    } else {
        return {
            simulation: simulations[bestFailed][1],
            route: routeCandidates[simulations[bestFailed][0]],
            error: true
        }
    }
}

export async function getTwoHopSwapData({
    tokenFrom,
    tokenTo,
    market,
}: {
    tokenFrom: PublicKey
    tokenTo: PublicKey
    market: Market
}) {
    try {  
        const {
            whitelistTickmaps,
            poolSet,
            routeCandidates
        } = routingEssentials(tokenFrom, tokenTo, market.program.programId, market.network)
    
        const pools = Array.from(poolSet).map(p => new PublicKey(p))
    
        let accounts = await market.fetchAccounts({ pools, tickmaps: whitelistTickmaps })
    
        for (const pool of poolSet) {
            if (!accounts.pools[pool]) {
                poolSet.delete(pool)
            }
        }
    
        for (let i = routeCandidates.length - 1; i >= 0; i--) {
            const [pairIn, pairOut] = routeCandidates[i]
            if (
            !accounts.pools[pairIn.getAddress(market.program.programId).toBase58()] ||
            !accounts.pools[pairOut.getAddress(market.program.programId).toBase58()]
            ) {
            const last = routeCandidates.pop()
            if (i !== routeCandidates.length) {
                routeCandidates[i] = last!
            }
            }
        }
    
        const missingTickmaps = Array.from(poolSet)
            .filter(pool => !accounts.tickmaps[pool])
            .map(pool => accounts.pools[pool].tickmap)
    
        if (missingTickmaps.length > 0) {
            const newTickmaps = await market.fetchAccounts({ tickmaps: missingTickmaps })
            accounts.tickmaps = { ...accounts.tickmaps, ...newTickmaps.tickmaps }
        }
    
        const crossLimit =
            tokenFrom.toBase58() === ETH_MINT || tokenTo.toBase58() === ETH_MINT
            ? 10
            : 16
    
        const tickAddresses = market.gatherTwoHopTickAddresses(
            poolSet,
            tokenFrom,
            tokenTo,
            accounts,
            crossLimit
        )
    
        if (tickAddresses.length > 0) {
            const tickAccounts = await market.fetchAccounts({ ticks: tickAddresses })
            accounts.ticks = { ...accounts.ticks, ...tickAccounts.ticks }
        }

        return accounts
    } catch (e) {
        console.error('🚨 Error getTwoHopSwapData:', e)
    }
}

export function serializeAccounts(accounts: FetcherRecords): SerializableFetcherRecords {
    return {
        pools: Object.fromEntries(
            Object.entries(accounts.pools).map(([key, pool]) => [
                key,
                {
                    tokenX: pool.tokenX.toBase58(),
                    tokenY: pool.tokenY.toBase58(),
                    tokenXReserve: pool.tokenXReserve.toBase58(),
                    tokenYReserve: pool.tokenYReserve.toBase58(),
                    positionIterator: printBN(pool.positionIterator, 0),
                    tickSpacing: pool.tickSpacing,
                    fee: printBN(pool.fee, 0),
                    protocolFee: printBN(pool.protocolFee, 0),
                    liquidity: printBN(pool.liquidity, 0),
                    sqrtPrice: printBN(pool.sqrtPrice, 0),
                    currentTickIndex: pool.currentTickIndex,
                    tickmap: pool.tickmap.toBase58(),
                    feeGrowthGlobalX: printBN(pool.feeGrowthGlobalX, 0),
                    feeGrowthGlobalY: printBN(pool.feeGrowthGlobalY, 0),
                    feeProtocolTokenX: printBN(pool.feeProtocolTokenX, 0),
                    feeProtocolTokenY: printBN(pool.feeProtocolTokenY, 0),
                    secondsPerLiquidityGlobal: printBN(pool.secondsPerLiquidityGlobal, 0),
                    startTimestamp: printBN(pool.startTimestamp, 0),
                    lastTimestamp: printBN(pool.lastTimestamp, 0),
                    feeReceiver: pool.feeReceiver.toBase58(),
                    oracleAddress: pool.oracleAddress.toBase58(),
                    oracleInitialized: pool.oracleInitialized,
                    bump: pool.bump
                }
            ])
        ),
        tickmaps: Object.fromEntries(
            Object.entries(accounts.tickmaps).map(([key, map]) => [
                key,
                Array.from(map.bitmap)
            ])
        ),
        ticks: Object.fromEntries(
            Object.entries(accounts.ticks).map(([key, tick]) => [
                key,
                {
                    pool: tick.pool.toBase58(),
                    index: tick.index,
                    sign: tick.sign,
                    liquidityChange: tick.liquidityChange.toString(),
                    liquidityGross: tick.liquidityGross.toString(),
                    sqrtPrice: tick.sqrtPrice.toString(),
                    feeGrowthOutsideX: printBN(tick.feeGrowthOutsideX, 0),
                    feeGrowthOutsideY: printBN(tick.feeGrowthOutsideY, 0),
                    secondsPerLiquidityOutside: printBN(tick.secondsPerLiquidityOutside, 0),
                    bump: tick.bump
                }
            ])
        )
    }
}

export function deserializeAccounts(serialized: SerializableFetcherRecords): FetcherRecords {
    const pools = Object.fromEntries(
        Object.entries(serialized.pools).map(([key, pool]) => [
            key,
            {
                tokenX: new PublicKey(pool.tokenX),
                tokenY: new PublicKey(pool.tokenY),
                tokenXReserve: new PublicKey(pool.tokenXReserve),
                tokenYReserve: new PublicKey(pool.tokenYReserve),
                positionIterator: new BN(pool.positionIterator),
                tickSpacing: pool.tickSpacing,
                fee: new BN(pool.fee),
                protocolFee: new BN(pool.protocolFee),
                liquidity: new BN(pool.liquidity),
                sqrtPrice: new BN(pool.sqrtPrice),
                currentTickIndex: pool.currentTickIndex,
                tickmap: new PublicKey(pool.tickmap),
                feeGrowthGlobalX: new BN(pool.feeGrowthGlobalX),
                feeGrowthGlobalY: new BN(pool.feeGrowthGlobalY),
                feeProtocolTokenX: new BN(pool.feeProtocolTokenX),
                feeProtocolTokenY: new BN(pool.feeProtocolTokenY),
                secondsPerLiquidityGlobal: new BN(pool.secondsPerLiquidityGlobal),
                startTimestamp: new BN(pool.startTimestamp),
                lastTimestamp: new BN(pool.lastTimestamp),
                feeReceiver: new PublicKey(pool.feeReceiver),
                oracleAddress: new PublicKey(pool.oracleAddress),
                oracleInitialized: pool.oracleInitialized,
                bump: pool.bump
            }
        ])
    )

    const ticks = Object.fromEntries(
        Object.entries(serialized.ticks).map(([key, t]) => [
            key,
            {
                pool: new PublicKey(t.pool),
                index: t.index,
                sign: t.sign,
                liquidityChange: new BN(t.liquidityChange),
                liquidityGross: new BN(t.liquidityGross),
                sqrtPrice: new BN(t.sqrtPrice),
                feeGrowthOutsideX: new BN(t.feeGrowthOutsideX),
                feeGrowthOutsideY: new BN(t.feeGrowthOutsideY),
                secondsPerLiquidityOutside: new BN(t.secondsPerLiquidityOutside),
                bump: t.bump
            }
        ])
    )

    const tickmaps: Record<string, Tickmap> = Object.fromEntries(
        Object.entries(serialized.tickmaps).map(([key, arr]) => [
            key,
            {
                bitmap: Uint8Array.from(arr) as unknown as Tickmap['bitmap']
            }
        ])
      )

    return {
        pools: pools,
        tickmaps: tickmaps,
        ticks: ticks

    }
}
