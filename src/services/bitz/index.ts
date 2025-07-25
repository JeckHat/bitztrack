import { PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js"
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    createAssociatedTokenAccountInstruction,
    getAssociatedTokenAddressSync,
    MintLayout,
    TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import { Boost, BoostConfig, CustomError, Numeric, Proof, Stake } from "@models"
import { getBoost, getBoostConfig, getBoostDecimals, getBoostProof, getStake, getStakeAuthority } from "./boost"
import {
    BITZ_MINT,
    BOOST_ID,
    BOOSTLIST,
    CONFIG,
    PROGRAM_ID,
    PROOF,
    ETH_MINT,
    STAKE,
    TREASURY,
    sBITZ_MINT
} from "@constants";
import { getBalance } from "@services/eclipse";
import { getConnection, getWalletAddress } from "@providers";
import { bigIntToNumber } from "@helpers";
import { store } from "@store/index";
import { boostActions, socketActions, stakeActions, tokenActions, updateStakeThunk } from "@store/actions";

export function calculateClaimableYield(boost: Boost, boostProof: Proof, stake: Stake, boostConfig: BoostConfig) {
    let rewards = BigInt(stake.rewards ?? 0);
    let configRewardsFactor = boostConfig.rewardsFactor
    let boostRewardsFactor = boost.rewardsFactor

    if (!configRewardsFactor) {
        configRewardsFactor = new Numeric(BigInt(0))
    }

    if (!boostRewardsFactor) {
        boostRewardsFactor = new Numeric(BigInt(0))
    }

    if (!boost.totalDeposits) {
        return rewards
    }

    if (!boost.lastRewardsFactor) {
        return rewards
    }

    if (!stake.lastRewardsFactor) {
        return rewards
    }

    if (boostProof.balance && boostProof.balance > 0 && boostConfig.totalWeight) {
        const extraFactor = Numeric.fromFraction(boostProof.balance, boostConfig.totalWeight)
        configRewardsFactor = configRewardsFactor.add(extraFactor)
    }

    if(configRewardsFactor.gt(boost.lastRewardsFactor)) {
        const accumulatedRewards = configRewardsFactor.sub(boost.lastRewardsFactor)
        const boostRewards = accumulatedRewards.mul(Numeric.fromU64(boost.weight ?? 0))
        const delta = boostRewards.div(Numeric.fromU64(boost.totalDeposits ?? 1))
        boostRewardsFactor = boostRewardsFactor.add(delta)
    }

    if(boostRewardsFactor.gt(stake.lastRewardsFactor)) {
        let accumulatedRewards = boostRewardsFactor.sub(stake.lastRewardsFactor)
        let personalRewards = accumulatedRewards.mul(Numeric.fromU64(stake?.balance ?? 0))
        rewards = rewards + personalRewards.toU64()
    }

    return rewards;
}

export async function getStakeBitz(mintAddress: string, boostAddress?: string) {
    const walletAddress = getWalletAddress()

    if (!walletAddress) {
        throw new CustomError("Wallet Address is undefined", 500)
    }

    const stakerPublicKey = new PublicKey(walletAddress)
    const mintPublicKey = new PublicKey(mintAddress)

    const { boost, boostPublicKey } = await getBoost(mintPublicKey, boostAddress)
    const { stake, stakePublicKey } = await getStake(stakerPublicKey, boostPublicKey)
    const decimals = await getBoostDecimals(mintPublicKey, boostPublicKey)
    const { boostConfig, boostConfigPublicKey } = await getBoostConfig()
    const { boostProof, boostProofPublicKey } = await getBoostProof(boostConfigPublicKey)

    store.dispatch(boostActions.updateBoost({
        boost: boost.toJSON(),
        boostAddress: boostPublicKey.toBase58(),
        stake: stake.toJSON(),
        stakeAddress: stakePublicKey.toBase58(),
        boostConfig: boostConfig.toJSON(),
        boostConfigAddress: boostConfigPublicKey.toBase58(),
        boostProof: boostProof.toJSON(),
        boostProofAddress: boostProofPublicKey.toBase58(),
        decimals: decimals
    }))

    store.dispatch(socketActions.updateSocketAccount({ type: 'boost', address: boostPublicKey.toBase58() }))
    store.dispatch(socketActions.updateSocketAccount({ type: 'boostStake', address: stakePublicKey.toBase58() }))
    store.dispatch(socketActions.updateSocketAccount({ type: 'boostConfig', address: boostConfigPublicKey.toBase58() }))
    store.dispatch(socketActions.updateSocketAccount({ type: 'boostProof', address: boostProofPublicKey.toBase58() }))

    const rewards = calculateClaimableYield(boost, boostProof, stake, boostConfig)

    return {
        mintPublicKey: mintPublicKey,
        decimals: decimals,
        boost: boost,
        boostPublicKey: boostPublicKey,
        stake: stake,
        stakePublicKey: stakePublicKey,
        boostProof: boostProof,
        boostProofPublicKey: boostProofPublicKey,
        boostConfig: boostConfig,
        boostConfigPublicKey: boostConfigPublicKey,
        rewards: bigIntToNumber(rewards),
    }
}

export async function getLiquidityPair(boostAddress: string, updatedRedux = false) {
    const walletAddress = getWalletAddress()

    if (!walletAddress) {
        throw new CustomError("Wallet Address is undefined", 500)
    }

    const mintAddress = BOOSTLIST[boostAddress].lpMint    

    const { boost } = await getBoost(new PublicKey(mintAddress), new PublicKey(boostAddress))
    const { stake } = await getStake(new PublicKey(walletAddress), new PublicKey(boostAddress))
    if (updatedRedux) {
        store.dispatch(boostActions.updateLiquidityPair({
            boostAddress: boostAddress,
            liquidityPair: {
                depositsBitz: (stake.balance ?? 0),
                depositsPair: 0,
                totalValueUsd: 0,
                shares: 0
            }
        }))
    }
    return {
        stakeBalance: (stake.balance ?? 0) / Math.pow(10, 11),
        stakeAmountBitz: (stake.balance ?? 0) / Math.pow(10, 11),
        stakeAmountPair: 0,
        LPBalanceBitz: boost?.totalDeposits ?? 0,
        LPBalancePair: 0,
        totalValueUsd: 0,
        shares: 0,
    }
}

export async function claimStakeBitzInstruction(mintAddress: string, boostAddress: string) {
    const connection = getConnection()
    const walletAddress = getWalletAddress()

    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }

    if (!walletAddress) {
        throw new CustomError("Wallet Address is undefined", 500)
    }

    const staker = new PublicKey(walletAddress)

    const transaction = new Transaction();
    const accountBitz = getAssociatedTokenAddressSync(
        new PublicKey(BITZ_MINT),
        staker
    );
    const account = await connection.getAccountInfo(accountBitz)

    if (!account) {
        const createTokenAccountIx = createAssociatedTokenAccountInstruction(
            staker,
            accountBitz,
            staker,
            new PublicKey(BITZ_MINT),
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
        );
        transaction.add(createTokenAccountIx)
    }

    const {
        boost,
        stake,
        boostProof,
        boostPublicKey,
        stakePublicKey,
        boostProofPublicKey,
        boostConfig,
        boostConfigPublicKey
    } = await getStakeBitz(mintAddress, boostAddress)

    const rewards = calculateClaimableYield(boost, boostProof, stake, boostConfig)
    const amountBuffer = Buffer.alloc(8)
    amountBuffer.writeBigUInt64LE(rewards)
    
    const beneficiaryPublicKey = getAssociatedTokenAddressSync(
        new PublicKey(BITZ_MINT),
        staker
    );

    const boostRewardsPublicKey = getAssociatedTokenAddressSync(
        new PublicKey(BITZ_MINT),
        boostConfigPublicKey,
        true
    );

    const treasuryAddress = PublicKey.findProgramAddressSync(
        [...[TREASURY]],
        new PublicKey(PROGRAM_ID)
    )?.[0]

    const treasuryTokenAddress = PublicKey.findProgramAddressSync(
        [
            ...[treasuryAddress.toBytes()],
            ...[new PublicKey(TOKEN_PROGRAM_ID).toBytes()],
            ...[new PublicKey(BITZ_MINT).toBytes()]
        ],
        new PublicKey(ASSOCIATED_TOKEN_PROGRAM_ID)
    )?.[0]

    const instruction = new TransactionInstruction({
        programId: new PublicKey(BOOST_ID),
        keys: [
            { pubkey: staker, isSigner: true, isWritable: true },
            { pubkey: beneficiaryPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostConfigPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostProofPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostRewardsPublicKey, isSigner: false, isWritable: true },
            { pubkey: stakePublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryAddress, isSigner: false, isWritable: false },
            { pubkey: treasuryTokenAddress, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(PROGRAM_ID), isSigner: false, isWritable: false },
            { pubkey: new PublicKey(TOKEN_PROGRAM_ID), isSigner: false, isWritable: false }
        ],
        data: Buffer.concat([Buffer.from([0]), amountBuffer])
    })

    transaction.add(instruction)

    const { blockhash } = await connection.getLatestBlockhash()
    transaction.recentBlockhash = blockhash
    transaction.feePayer = staker
    const feeCalculator = await connection.getFeeForMessage(transaction.compileMessage())
    if (!feeCalculator.value) {
        throw new CustomError("Fee is empty", 500)
    }
    const estimatedFee = feeCalculator.value

    const balaceEth = await getBalance(walletAddress, ETH_MINT)

    if (balaceEth.amount < estimatedFee) {
        throw new CustomError(
            `Insufficient balance! Minimum of ${estimatedFee.toFixed(9)} ETH is required, while the current balance is only ${balaceEth} ETH.`,
            500
        );
    } 

    return { transaction, rewards: bigIntToNumber(rewards), estimatedFee, connection };
}

export async function depositStakeInstruction(mintAddress: string, boostAddress: string, amountStake?: number) {
    const walletAddress = getWalletAddress()
    if (!walletAddress) {
        throw new CustomError("Wallet Address is undefined", 500)
    }

    const amount = amountStake? BigInt(amountStake * Math.pow(10, 11)) : BigInt("0xFFFFFFFFFFFFFFFF")
    const depositData = Buffer.alloc(8)
    depositData.writeBigUInt64LE(amount, 0)

    const walletPublicKey = new PublicKey(walletAddress)
    const mintPublicKey = new PublicKey(mintAddress)
    const boostPublicKey = new PublicKey(boostAddress)
    const boostConfigPublicKey = PublicKey.findProgramAddressSync(
        [...[CONFIG]],
        new PublicKey(BOOST_ID)
    )?.[0]
    
    const boostProofPublicKey = PublicKey.findProgramAddressSync(
        [...[PROOF], ...[boostConfigPublicKey.toBytes()]],
        new PublicKey(PROGRAM_ID)
    )?.[0]
    
    const boostDepositPublicKey = getAssociatedTokenAddressSync(
        mintPublicKey, boostPublicKey, true
    )

    const boostRewardsPublicKey = getAssociatedTokenAddressSync(
        new PublicKey(BITZ_MINT),
        boostConfigPublicKey,
        true
    );
    
    const senderPublicKey = getAssociatedTokenAddressSync(mintPublicKey, walletPublicKey, true)
    
    const stakePublicKey = PublicKey.findProgramAddressSync(
        [...[STAKE], ...[walletPublicKey.toBytes()], ...[boostPublicKey.toBytes()]],
        new PublicKey(BOOST_ID)
    )?.[0]

    const treasuryAddress = PublicKey.findProgramAddressSync(
        [...[TREASURY]],
        new PublicKey(PROGRAM_ID)
    )?.[0]

    const treasuryTokenAddress = PublicKey.findProgramAddressSync(
        [
            ...[treasuryAddress.toBytes()],
            ...[new PublicKey(TOKEN_PROGRAM_ID).toBytes()],
            ...[new PublicKey(BITZ_MINT).toBytes()]
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )?.[0]

    const bufferMax = Buffer.alloc(8);
    bufferMax.writeBigUInt64LE(18446744073709551615n);

    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(amount);

    const depositInstruction = new TransactionInstruction({
        programId: new PublicKey(BOOST_ID),
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },
            { pubkey: boostPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostConfigPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostDepositPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: boostProofPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostRewardsPublicKey, isSigner: false, isWritable: true },
            { pubkey: senderPublicKey, isSigner: false, isWritable: true },
            { pubkey: stakePublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryAddress, isSigner: false, isWritable: false },
            { pubkey: treasuryTokenAddress, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(PROGRAM_ID), isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([2]), amountBuffer])
    })

    return depositInstruction
}

export async function withdrawStakeInstruction(mintAddress: string, boostAddress: string, amountStake: number) {
    const walletAddress = getWalletAddress()
    if (!walletAddress) {
        throw new CustomError("Wallet Address is undefined", 500)
    }

    const amount = BigInt(Math.floor(amountStake * Math.pow(10, BOOSTLIST[boostAddress].decimals)))
    const withdrawData = Buffer.alloc(8)
    withdrawData.writeBigUInt64LE(amount, 0)

    const walletPublicKey = new PublicKey(walletAddress)
    const mintPublicKey = new PublicKey(mintAddress)

    const beneficiaryPublicKey = getAssociatedTokenAddressSync(mintPublicKey, walletPublicKey)


    const boostPublicKey = new PublicKey(boostAddress)
    const boostConfigPublicKey = PublicKey.findProgramAddressSync(
        [...[CONFIG]],
        new PublicKey(BOOST_ID)
    )?.[0]
    
    const boostProofPublicKey = PublicKey.findProgramAddressSync(
        [...[PROOF], ...[boostConfigPublicKey.toBytes()]],
        new PublicKey(PROGRAM_ID)
    )?.[0]
    
    const boostDepositPublicKey = getAssociatedTokenAddressSync(
        mintPublicKey, boostPublicKey, true
    )

    const boostRewardsPublicKey = getAssociatedTokenAddressSync(
        new PublicKey(BITZ_MINT),
        boostConfigPublicKey,
        true
    );
  
    const stakePublicKey = PublicKey.findProgramAddressSync(
        [...[STAKE], ...[walletPublicKey.toBytes()], ...[boostPublicKey.toBytes()]],
        new PublicKey(BOOST_ID)
    )?.[0]

    const treasuryAddress = PublicKey.findProgramAddressSync(
        [...[TREASURY]],
        new PublicKey(PROGRAM_ID)
    )?.[0]

    const treasuryTokenAddress = PublicKey.findProgramAddressSync(
        [
            ...[treasuryAddress.toBytes()],
            ...[new PublicKey(TOKEN_PROGRAM_ID).toBytes()],
            ...[new PublicKey(BITZ_MINT).toBytes()]
        ],
        ASSOCIATED_TOKEN_PROGRAM_ID
    )?.[0]

    const amountBuffer = Buffer.alloc(8);
    amountBuffer.writeBigUInt64LE(amount);

    const wuthdrawInstruction = new TransactionInstruction({
        programId: new PublicKey(BOOST_ID),
        keys: [
            { pubkey: walletPublicKey, isSigner: true, isWritable: true },
            { pubkey: beneficiaryPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostConfigPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostDepositPublicKey, isSigner: false, isWritable: true },
            { pubkey: mintPublicKey, isSigner: false, isWritable: false },
            { pubkey: boostProofPublicKey, isSigner: false, isWritable: true },
            { pubkey: boostRewardsPublicKey, isSigner: false, isWritable: true },
            { pubkey: stakePublicKey, isSigner: false, isWritable: true },
            { pubkey: treasuryAddress, isSigner: false, isWritable: false },
            { pubkey: treasuryTokenAddress, isSigner: false, isWritable: true },
            { pubkey: new PublicKey(PROGRAM_ID), isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        data: Buffer.concat([Buffer.from([5]), amountBuffer])
    })

    return wuthdrawInstruction
}

export async function getStakeSBitz() {
    const connection = getConnection()
    const stakeAccount = await getStakeAuthority(
        new PublicKey("BiTZjpfDvVfBi6H6jP1wXT7jV9Qx22LBRyJHR3wprsb1"),
        new PublicKey("5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja")
    )
    const mintAccount = await connection.getAccountInfo(new PublicKey(sBITZ_MINT))

    console.log("stakeAccount", stakeAccount.stake)

    const rawMint = MintLayout.decode(mintAccount?.data!!)
    store.dispatch(stakeActions.addStake({ stake: stakeAccount.stake.toJSON(), mintAddress: sBITZ_MINT, address: stakeAccount.stakePublicKey.toBase58() }))
    store.dispatch(tokenActions.addMint({
        mintAddress: sBITZ_MINT,
        mint: {
            mintAuthority: rawMint.mintAuthority.toBase58(),
            supply: rawMint.supply.toString(),
            decimals: rawMint.decimals,
            isInitialized: rawMint.isInitialized? 1 : 0,
            freezeAuthority: rawMint.freezeAuthority.toBase58(),
            stakeAddresses: [stakeAccount.stakePublicKey.toBase58()]
        }
    }))

    store.dispatch(socketActions.updateSocketAccount({ type: 'stake', address: stakeAccount.stakePublicKey.toBase58() }))
    store.dispatch(socketActions.updateSocketAccount({ type: `mint`, address: sBITZ_MINT }))

    store.dispatch(updateStakeThunk({
        address: stakeAccount.stakePublicKey.toBase58(),
        stake: stakeAccount.stake
    }))
}
