import { PublicKey } from '@solana/web3.js'
import dayjs from 'dayjs'

import { getMember } from '@services/bitz/pool'
import { getConnection, getPoolById } from '@providers'
import { PROGRAM_ID, PROOF } from '@constants'
import { getProofResult } from '@models'
import Images from '@assets/images'
import { getProof } from '@services/bitz/boost'

export interface PoolInfo {
    id: string
    name: string
    image: keyof typeof Images
    mint?: string
    isSolo: boolean
    api: {
        base?: string
        getMinerData?: (pubkey: string) => Promise<{
            poolId: string
            totalMachine: number
            running: boolean 
            rewards: number
            avgRewards: number
            lastKnownRewards: number
            lifetimeRewards: number
            avgInitiatedAt: number
            lastCheckAt: number
        }>
        getPoolDetail?: (pubkey: string) => Promise<{
            totalMachines: number
            totalMiners: number
            poolRewards: number
            poolAvgRewards: number
            minerRewards: number
            minerAvgRewards: number
            totalHashes: number
            lastClaimAt: string
            lastHashAt: string
            poolRunning: boolean
            running: boolean
        }>
        getBalance?: (pubkey: string) => Promise<{
            rewardsBitz: number
            lastClaimAt?: string | null
            earnedBitz?: number | null
        }>
        getHighScore?: (pubkey?: string) => Promise<{ high: number, avg: number }>
        getHashpower?: (pubkey?: string) => Promise<{ hashpower: number }>
        getActiveMiners?: (pubkey?: string) => Promise<{total: number}>
        getPoolEarned?: () => Promise<{balance: number}>
        getAvgEarned?: () => Promise<{daily: number}>
        getRewards?: (pubkey: string) => Promise<{balance: number}>
        getMachines?: (pubkey: string) => Promise<{ activeCount: number }>
    }
}

export const POOL_LIST: Record<string, PoolInfo> = {
    'pool-official': {
        id: 'pool-official',
        name: 'Official',
        mint: 'CjHzuHzieQJVHjXdev8LNExeYDe9YFeHwJf5zhpXh5nn',
        image: 'BitzToken',
        isSolo: false,
        api: {
            base: 'https://powpow.app',
            getMinerData: async (pubkey: string) => {
                const [poolData, member] = await Promise.all([
                    fetch(`https://mainnet-pool.powpow.app/member/${pubkey}`)
                        .then(res => res.json()),
                    getMember(new PublicKey(pubkey), new PublicKey("CjHzuHzieQJVHjXdev8LNExeYDe9YFeHwJf5zhpXh5nn"))
                        .then((res) => res).then(memberData => memberData.member),
                ])

                let pool = getPoolById('pool-official')
                let rewards = (poolData?.total_balance ?? 0) - (member?.totalBalance ?? 0) + (member?.balance ?? 0)
                let running = pool.running
                let lastKnownRewards = pool.lastKnownRewards
                let avgInitiatedAt = pool.avgInitiatedAt
                let lifetimeRewards = pool.lifetimeRewards
                let lastCheckAt = pool.lastCheckAt
                let avgRewards = pool.avgRewards

                if (lifetimeRewards >= (poolData?.total_balance ?? 0)) {
                    const diffInMinutes = Math.floor(((new Date().getTime()) - lastCheckAt) / 60000)
                    if (diffInMinutes > 2) {
                        running = false
                        avgRewards = 0.0
                    }
                } else {
                    lastCheckAt = new Date().getTime()
                    running = true
                    lifetimeRewards = (poolData?.total_balance ?? 0)
                    if (pool.running) {
                        let devided = (Date.now() - avgInitiatedAt) / 60000
                        avgRewards = (rewards - lastKnownRewards) / (devided === 0? 1 : devided)
                        avgRewards = avgRewards * 60 * 24
                    } else {
                        lastKnownRewards = rewards
                        avgInitiatedAt = new Date().getTime()
                    }
                }

                return {
                    poolId: 'pool-official',
                    totalMachine: running ? 1 : 0,
                    running: running,
                    rewards: rewards,
                    avgRewards: avgRewards,
                    lastKnownRewards: lastKnownRewards,
                    avgInitiatedAt: avgInitiatedAt,
                    lifetimeRewards: lifetimeRewards,
                    lastCheckAt: lastCheckAt
                }
            },
            getBalance: async (pubkey: string) => {
                const [pool, memberData] = await Promise.all([
                    fetch(`https://mainnet-pool.powpow.app/member/${pubkey}`).then(res => res.json()),
                    getMember(new PublicKey(pubkey), new PublicKey("CjHzuHzieQJVHjXdev8LNExeYDe9YFeHwJf5zhpXh5nn")).then((res) => res),
                ])
                const { member } = memberData
                return {
                    rewardsBitz: ((pool?.total_balance ?? 0) - (member?.totalBalance ?? 0) + (member?.balance ?? 0)) / Math.pow(10, 11),
                    earnedBitz: member?.balance,
                    lastClaimAt: dayjs('1900-01-01').toISOString()
                }
            },
        }
    },
    'pool-hatzpool': {
        id: 'pool-hatzpool',
        name: 'HatzPool',
        image: 'HatzPool',
        isSolo: false,
        mint: "GKpHFpcA9xjiaxkJM1UXogSgUrHiDaENzKqqEtj3ae1P",
        api: {
            base: 'https://pool.bitztrack.com',
            getMinerData: async (pubkey: string) => {
                const [totalMachine, rewards] = await Promise.all([
                    fetch(`https://pool.bitztrack.com/active-miners?pubkey=${pubkey}`, {
                        method: 'GET'
                    }).then((res) => res.json()).then((result) => result).catch(() => 0),
                    fetch(`https://pool.bitztrack.com/miner/rewards?pubkey=${pubkey}`, {
                        method: 'GET'
                    }).then(res => res.json()).then(result => result.bitz).catch(() => 0),
                ])                

                let pool = getPoolById('pool-hatzpool')
                let running = false
                let lastKnownRewards = pool.lastKnownRewards
                let avgInitiatedAt = pool.avgInitiatedAt
                let lastCheckAt = pool.lastCheckAt
                let avgRewards = pool.avgRewards

                if (totalMachine < 1) {
                    running = false
                    avgRewards = 0.0
                } else {
                    lastCheckAt = new Date().getTime()
                    running = true
                    if (rewards < lastKnownRewards) {
                        lastKnownRewards = rewards
                        avgInitiatedAt = new Date().getTime()
                    }
                    if (pool.running) {
                        let devided = (Date.now() - avgInitiatedAt) / 60000
                        avgRewards = (rewards - lastKnownRewards) / (devided === 0? 1 : devided)
                        avgRewards = avgRewards * 60 * 24
                    } else {
                        lastKnownRewards = rewards
                        avgInitiatedAt = new Date().getTime()
                    }
                }
                
                return {
                    poolId: 'pool-hatzpool',
                    totalMachine: totalMachine,
                    running: running,
                    rewards: rewards,
                    avgRewards: avgRewards,
                    lastKnownRewards: lastKnownRewards,
                    avgInitiatedAt: avgInitiatedAt,
                    lifetimeRewards: 0,
                    lastCheckAt: lastCheckAt
                }
            },
            getPoolDetail: async (pubkey: string) => {
                const [totalMiners, totalMachines, poolDetail, poolAvg, minerRewards] = await Promise.all([
                    fetch(`https://pool.bitztrack.com/active-miners`, {
                        method: 'GET'
                    }).then((res) => res.json()).then((result) => result).catch(() => 0),
                    fetch(`https://pool.bitztrack.com/active-miners?pubkey=${pubkey}`, {
                        method: 'GET'
                    }).then((res) => res.json()).then((result) => result).catch(() => 0),
                    getProof(new PublicKey("GKpHFpcA9xjiaxkJM1UXogSgUrHiDaENzKqqEtj3ae1P")),
                    fetch(`https://pool.bitztrack.com/pool/daily-earned`, {
                        method: 'GET'
                    }).then((res) => res.json()).then((result) => result.daily_earned).catch(() => 0),
                    fetch(`https://pool.bitztrack.com/miner/rewards?pubkey=${pubkey}`, {
                        method: 'GET'
                    }).then((res) => res.json()).then((result) => result.bitz / Math.pow(10, 11)).catch(() => 0),
                ])

                let pool = getPoolById('pool-hatzpool')
                let rewards = minerRewards
                let running = pool.running
                let lastKnownRewards = pool.lastKnownRewards
                let avgInitiatedAt = pool.avgInitiatedAt
                let lastCheckAt = pool.lastCheckAt
                let avgRewards = pool.avgRewards
                if (totalMachines < 1) {
                    running = false
                    avgRewards = 0.0
                } else {
                    lastCheckAt = new Date().getTime()
                    running = true
                    if (rewards < lastKnownRewards) {
                        lastKnownRewards = rewards
                        avgInitiatedAt = new Date().getTime()
                    }
                    if (pool.running) {
                        let devided = (Date.now() - avgInitiatedAt) / 60000
                        avgRewards = (rewards - lastKnownRewards) / (devided === 0? 1 : devided)
                        avgRewards = avgRewards * 60 * 24
                    } else {
                        lastKnownRewards = rewards
                        avgInitiatedAt = new Date().getTime()
                    }
                }
                return {
                    totalMachines: totalMachines,
                    totalMiners: totalMiners,
                    poolRewards: poolDetail.proof.balance ?? 0,
                    poolAvgRewards: poolAvg,
                    minerRewards: rewards ?? 0,
                    minerAvgRewards: avgRewards,
                    totalHashes: poolDetail.proof.totalHashes ?? 0,
                    lastClaimAt: dayjs.unix(poolDetail.proof.lastClaimAt ?? 0).format("MM/DD/YYYY HH:mm:ss"),
                    lastHashAt:  dayjs.unix(poolDetail.proof.lastHashAt ?? 0).format("MM/DD/YYYY HH:mm:ss"),
                    poolRunning: totalMiners > 0,
                    running: running
                }
            },
            getBalance: async (pubkey: string) => {
                let lastClaimAt = null
                try {
                    const response = await fetch(`https://pool.bitztrack.com/miner/last-claim?pubkey=${pubkey}`, {
                        method: 'GET'
                    })
                    const resData = await response.json()
                    lastClaimAt = resData.created_at
                } catch(error) {
                    lastClaimAt = null
                }
                const response = await fetch(`https://pool.bitztrack.com/miner/rewards?pubkey=${pubkey}`, {
                    method: 'GET'
                })
                const resData = await response.json()
                return {
                    rewardsBitz: resData.bitz / Math.pow(10, 11),
                    earnedBitz: null,
                    lastClaimAt: lastClaimAt
                }
            },
            getRewards: async (pubkey: string) => {
                const response = await fetch(`https://pool.bitztrack.com/miner/rewards?pubkey=${pubkey}`, {
                    method: 'GET'
                })
                const resData = await response.json()
                return {
                    balance: resData.bitz / Math.pow(10, 11),
                }
            },
            getPoolEarned: async () => {
                const connection = getConnection()
                const programAddress = PublicKey.findProgramAddressSync(
                    [...[PROOF], ...[new PublicKey("GKpHFpcA9xjiaxkJM1UXogSgUrHiDaENzKqqEtj3ae1P").toBytes()]],
                    new PublicKey(PROGRAM_ID)
                )?.[0]
                const accountInfo = await connection.getAccountInfo(programAddress)
                const proof = await getProofResult(accountInfo?.data)
                return {
                    balance: ((proof?.balance ?? 0) / Math.pow(10, 11))
                }
            },
            getAvgEarned: async () => {
                let API_URL = "https://pool.bitztrack.com"
                let url = `${API_URL}/pool/daily-earned`
                const response = await fetch(url, {
                    method: 'GET'
                })
                const resData = await response.json()

                return { daily: resData.daily_earned }
            },
            getHighScore: async (pubkey?: string) => {
                let API_URL = "https://pool.bitztrack.com"
                let url = `${API_URL}/high-difficulty`
                if (pubkey) url = `${API_URL}/high-difficulty?pubkey=${pubkey}`
                const response = await fetch(url, {
                    method: 'GET'
                })
                const resData = await response.json()

                return { high: resData.high_difficulty, avg: resData.avg_difficulty }
            },
            getHashpower: async (pubkey?: string) => {
                let url = `https://pool.bitztrack.com/hashpower`
                if (pubkey) url = `https://pool.bitztrack.com/hashpower?pubkey=${pubkey}`
                const response = await fetch(url, {
                    method: 'GET'
                })
                const resData = await response.json()

                return { hashpower: resData.hashpower }
            },
            getActiveMiners: async (pubkey?: string) => {
                let url = `https://pool.bitztrack.com/active-miners`
                if (pubkey) url = `https://pool.bitztrack.com/active-miners?pubkey=${pubkey}`
                const response = await fetch(url, {
                    method: 'GET'
                })
                const total = await response.json()

                return { total: total }
            },
            getMachines: async (pubkey: string) => {
                const day = dayjs()
                const response = await fetch(`https://pool.bitztrack.com/miner/submissions?pubkey=${pubkey}`, {
                    method: 'GET'
                })
                const resData = await response.json()

                let challengeId = resData[0].challenge_id
                let activeCount = 0
                
                if (resData.length > 0)
                    for(let i=0; i<resData.length; i++) {
                        if (challengeId !== resData[i].challenge_id) {
                            break;
                        } else {
                            activeCount++
                        }
                    }
                return { activeCount: activeCount }
            }
        }
    },
    // 'pool-solo': {
    //     id: 'solo',
    //     name: 'Solo Miner',
    //     image: 'BitzToken',
    //     isSolo: true,
    //     api: {
    //         base: 'https://powpow.app',
    //     }
    // },
}