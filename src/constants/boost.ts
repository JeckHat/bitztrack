export interface BoostInfo {
    id: string
    name: string
    pairMint?: string | null
    lpMint: string
    lpId: string
    defi: string
    defiImage?: string | null
    tokenImage: string
    pairImage?: string | null
    lut?: string | null
    pairId?: string | null
    pairTicker?: string | null
    decimals: number
    ataSize: number
}

export const BOOSTLIST: Record<string, BoostInfo> = {
    "5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja": {
        id: 'bitz-2',
        name: 'BITZ',
        lpMint: '64mggk2nXg6vHC1qCdsZdEFzd5QGN4id54Vbho4PswCF',
        lpId: 'default',
        defi: 'default',
        defiImage: null,
        tokenImage: 'BitzToken',
        lut: null,
        pairId: null,
        pairMint: null,
        pairImage: null,
        pairTicker: null,
        decimals: 11,
        ataSize: 165
    },
}