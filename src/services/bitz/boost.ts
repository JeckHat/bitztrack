import { PublicKey } from "@solana/web3.js"
import { MintLayout } from "@solana/spl-token"

import { AUTHORITY, BOOST, BOOST_ID, BOOSTLIST, CONFIG, PROGRAM_ID, PROOF, STAKE } from "@constants"
import { CustomError, getBoostConfigResult, getBoostResult, getProofResult, getStakeResult } from "@models"
import { getConnection, getBoostProofAddress } from "@providers"

export async function getBoost(mintPublicKey: PublicKey, boostAddress?: string | PublicKey | null) {
    const connection = getConnection()

    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }

    let boostPublicKey: PublicKey
    if (!boostAddress) {
        boostPublicKey = PublicKey.findProgramAddressSync(
            [...[BOOST], ...[mintPublicKey.toBytes()]],
            new PublicKey(BOOST_ID)
        )?.[0]
    } else if (typeof boostAddress === 'string') {
        boostPublicKey = new PublicKey(boostAddress)
    } else {
        boostPublicKey = PublicKey.findProgramAddressSync(
            [...[BOOST], ...[mintPublicKey.toBytes()]],
            new PublicKey(BOOST_ID)
        )?.[0]
    }
    const boostAccountInfo = await connection.getAccountInfo(boostPublicKey)
    const boost = await getBoostResult(boostAccountInfo?.data)
    
    return { boost, boostPublicKey }
}

export async function getStake(walletPublicKey: PublicKey, boostPublicKey: PublicKey) {
    const connection = getConnection()
    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }
    const stakePublicKey = PublicKey.findProgramAddressSync(
        [...[STAKE], ...[walletPublicKey.toBytes()], ...[boostPublicKey.toBytes()]],
        new PublicKey(BOOST_ID)
    )?.[0]

    const stakeAccountInfo = await connection.getAccountInfo(stakePublicKey)
    const stake = await getStakeResult(stakeAccountInfo?.data)
    
    return { stake, stakePublicKey }
}

export async function getBoostDecimals(mintPublicKey: PublicKey, boostPublicKey: PublicKey) {
    const connection = getConnection()
    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }

    let decimals = BOOSTLIST[boostPublicKey.toBase58()].decimals
    if (typeof BOOSTLIST[boostPublicKey.toBase58()].decimals !== 'number') {
        const mint = await connection.getAccountInfo(mintPublicKey)
        if (!mint) {
            throw new CustomError("Mint Address is not found", 500)
        }
        const mintData = MintLayout.decode(mint.data)
        decimals = mintData.decimals
    }
    
    return decimals
}

export async function getBoostProof(boostPublicKey: PublicKey) {
    const connection = getConnection()
    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }
    const boostProofAddress = getBoostProofAddress()

    let boostProofPublicKey: PublicKey
    if (boostProofAddress) {
        boostProofPublicKey = new PublicKey(boostProofAddress)
    } else {
        boostProofPublicKey = PublicKey.findProgramAddressSync(
            [...[PROOF], ...[boostPublicKey.toBytes()]],
            new PublicKey(PROGRAM_ID)
        )?.[0]
    }

    const proofAccountInfo = await connection.getAccountInfo(boostProofPublicKey)
    const boostProof = await getProofResult(proofAccountInfo?.data)
    
    return { boostProof, boostProofPublicKey }
}

export async function getBoostConfig() {
    const connection = getConnection()
    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }

    const boostConfigPublicKey = PublicKey.findProgramAddressSync(
        [...[CONFIG]],
        new PublicKey(BOOST_ID)
    )?.[0]

    const configAccountInfo = await connection.getAccountInfo(boostConfigPublicKey)
    const boostConfig = await getBoostConfigResult(configAccountInfo?.data)
    
    return { boostConfig, boostConfigPublicKey }
}

export async function getProof(walletPublicKey: PublicKey) {
    const connection = getConnection()
    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }
    let proofPublicKey = PublicKey.findProgramAddressSync(
        [...[PROOF], ...[walletPublicKey.toBytes()]],
        new PublicKey(PROGRAM_ID)
    )?.[0]

    const proofAccountInfo = await connection.getAccountInfo(proofPublicKey)
    const proof = await getProofResult(proofAccountInfo?.data)
    
    return { proof, proofPublicKey }
}

export async function getStakeAuthority(mintPublicKey: PublicKey, boostPublicKey: PublicKey) {
    const connection = getConnection()
    if (!connection) {
        throw new CustomError("Rpc Connection is undefined", 500)
    }
    const authorityPublicKey = PublicKey.findProgramAddressSync(
        [AUTHORITY],
        mintPublicKey
    )?.[0]

    const authority = await getStake(authorityPublicKey, boostPublicKey)

    return { ...authority }
}
