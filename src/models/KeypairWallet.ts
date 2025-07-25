import {
    Keypair,
    Transaction,
    VersionedTransaction,
    PublicKey,
} from '@solana/web3.js'
import { IWallet } from '@invariant-labs/sdk-eclipse'
  
export class KeypairWallet implements IWallet {
    public readonly publicKey: PublicKey
    private readonly keypair: Keypair

    constructor(keypair: Keypair) {
        this.keypair = keypair
        this.publicKey = keypair.publicKey
    }
  
    async signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T> {
        if (tx instanceof VersionedTransaction) {
            tx.sign([this.keypair])
        } else {
            tx.partialSign(this.keypair)
        }
        return tx
    }
  
    async signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> {
        return Promise.all(txs.map(tx => this.signTransaction(tx)))
    }
}