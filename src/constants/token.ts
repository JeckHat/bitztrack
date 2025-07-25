export interface TokenInfo {
    id: string
    name: string
    ticker: string
    image: string
    pairImage?: string | null
    decimals: number
    isLP: boolean
    boostAddress?: string
    isAlways: boolean
    geckoPriceAddress?: string
    eclipseScan?: string,
    tokenProgram: string
}

export const TOKENLIST: Record<string, TokenInfo> = {
    "So11111111111111111111111111111111111111112": {
        id: 'ethereum',
        name: 'Ethereum',
        ticker: 'ETH',
        image: 'EthToken',
        pairImage: null,
        decimals: 9,
        isLP: false,
        boostAddress: undefined,
        isAlways: true,
        geckoPriceAddress: "ethereum",
        tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
    },
    "BeRUj3h7BqkbdfFU7FBNYbodgf8GCHodzKvF9aVjNNfL": {
        id: 'solana',
        name: 'Solana',
        ticker: 'SOL',
        image: 'SolanaToken',
        pairImage: null,
        decimals: 9,
        isLP: false,
        boostAddress: undefined,
        isAlways: false,
        geckoPriceAddress: "E6AFbRkMwidQyBQ872e9kbVT2ZqybmM6dJ2Zaa6sVxJq",
        tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    },
    "64mggk2nXg6vHC1qCdsZdEFzd5QGN4id54Vbho4PswCF": {
        id: 'bitz-2',
        name: 'BITZ',
        ticker: 'BITZ',
        image: 'BitzToken',
        pairImage: null,
        decimals: 11,
        isLP: false,
        boostAddress: "5FgZ9W81khmNXG8i96HSsG7oJiwwpKnVzmHgn9ZnqQja",
        isAlways: true,
        geckoPriceAddress: "CUzwQT8ZThYuKCerH3SpNu12eyxB4tAU3d19snjhELWU",
        tokenProgram: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
    },
    "sBTZcSwRZhRq3JcjFh1xwxgCxmsN7MreyU3Zx8dA8uF": {
        id: 'sbitz',
        name: 'Staked BITZ',
        ticker: 'sBITZ',
        image: 'sBitzToken',
        pairImage: null,
        decimals: 11,
        isLP: false,
        boostAddress: undefined,
        isAlways: true,
        geckoPriceAddress: undefined,
        eclipseScan: "https://api.eclipsescan.xyz/v1/account?address=sBTZcSwRZhRq3JcjFh1xwxgCxmsN7MreyU3Zx8dA8uF",
        tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
        
    },
    "27Kkn8PWJbKJsRZrxbsYDdedpUQKnJ5vNfserCxNEJ3R": {
        id: 'tusd',
        name: 'tUSD',
        ticker: 'tUSD',
        image: 'tusdToken',
        pairImage: null,
        decimals: 6,
        isLP: false,
        boostAddress: undefined,
        isAlways: false,
        geckoPriceAddress: "44w4HrojzxKwxEb3bmjRNcJ4irFhUGBUjrCYecYhPvqq",
        tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    },
    "AKEWE7Bgh87GPp171b4cJPSSZfmZwQ3KaqYqXoKLNAEE": {
        id: 'usdc',
        name: 'USDC',
        ticker: 'USDC',
        image: 'UsdcToken',
        pairImage: null,
        decimals: 6,
        isLP: false,
        boostAddress: undefined,
        isAlways: false,
        geckoPriceAddress: "44w4HrojzxKwxEb3bmjRNcJ4irFhUGBUjrCYecYhPvqq",
        tokenProgram: "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"
    },
}