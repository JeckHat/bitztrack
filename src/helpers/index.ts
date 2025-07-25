import crypto from 'react-native-quick-crypto'
import { derivePath } from 'ed25519-hd-key'
import { Platform } from 'react-native'
import { BN } from '@coral-xyz/anchor'
import { Connection, GetAccountInfoConfig, GetProgramAccountsConfig, PublicKey } from '@solana/web3.js';

export async function mnemonicToSeedFast(mnemonic: string): Promise<Buffer> {
    const salt = "mnemonic";
    const iterations = 2048;
    const keyLen = 64;
    const digest = "sha512";
  
    return new Promise<Buffer>((resolve, reject) => {
        crypto.pbkdf2(mnemonic, salt, iterations, keyLen, digest, (err, derivedKey) => {
            if (err) reject(err)
            else if (!derivedKey) reject("Empty Buffer")
            else {
                const path44Change = `m/44'/501'/0'/0'`
                const derivedSeed = derivePath(path44Change, derivedKey?.toString("hex")).key;
                resolve(derivedSeed)
            }
        });
    });
}

export function delimiterFormat(number: number | string, separator = ',') {
    let newNumber = number.toString();
    let isMinus = newNumber[0] === '-';
    let numberString = isMinus ? newNumber.substring(1, newNumber.length - 1) : newNumber;
    numberString = numberString.split('.')[0];
    let decimal = newNumber.split('.')[1];
    let modulus = numberString.length % 3;
    let currency = numberString.substring(0, modulus);
    let thousand = numberString.substring(modulus).match(/\d{3}/g);
  
    if (thousand) {
      let separate = modulus ? separator : '';
      currency += separate + thousand.join(separator);
    }

    if(decimal)
        return `${isMinus ? '- ' : ''}${currency}.${decimal}`;
    else
        return `${isMinus ? '- ' : ''}${currency}`;
}

export function shortenAddress(address: string, chars: number = 4) {
    return `${address.slice(0, chars)}...${address.slice(-chars)}`;
}

export function bigIntToNumber(bn: bigint): number {
    const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
    if (bn > MAX_SAFE) {
        throw new Error(`BigInt value ${bn} is too large to convert safely to a number.`);
    }
    return Number(bn);
}

export function toDecimalString(num: number) {
    if (Math.abs(num) < 1.0) {
        let e = parseInt(num.toString().split('e-')[1]);
        if (e) {
            num *= Math.pow(10, e - 1);
            return '0.' + '0'.repeat(e - 1) + num.toString().replace('.', '');
        }
    }
    return num.toString();
}

export function getAPILevel() {
    if (Platform.OS === 'android') {
        if (typeof Platform.Version === 'number') {
            return Platform.Version
        } else {
            return parseInt(Platform.Version, 10)
        }
    } else {
        return 0
    }
    // return 0
}

export function printBN(amount: BN, decimals: number): string {
    if (!amount) {
        return '0'
    }
    const amountString = amount.toString()
    const isNegative = amountString.length > 0 && amountString[0] === '-'
    
    const balanceString = isNegative ? amountString.slice(1) : amountString
    
    if (balanceString.length <= decimals) {
        return (
        (isNegative ? '-' : '') + '0.' + '0'.repeat(decimals - balanceString.length) + balanceString
        )
    } else {
        return (
        (isNegative ? '-' : '') +
            trimZeros(
                balanceString.substring(0, balanceString.length - decimals) +
                '.' +
                balanceString.substring(balanceString.length - decimals)
            )
        )
    }
}

function trimZeros(numStr: string): string {
    if (!numStr) {
        return ''
    }
    return numStr
        .replace(/(\.\d*?)0+$/, '$1')
        .replace(/^0+(\d)|(\d)0+$/gm, '$1$2')
        .replace(/\.$/, '')
}

export const subNumbers = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉']

export const printSubNumber = (amount: number): string => {
    return Array.from(String(amount))
        .map(char => subNumbers[+char])
        .join('')
}

export const numberToString = (number: number | bigint | string): string => {
    if (typeof number === 'bigint') {
        return number.toString()
    }
  
    const numStr = String(number)
  
    if (numStr.includes('e')) {
        const [base, exp] = numStr.split('e')
        const exponent = parseInt(exp, 10)
    
        if (exponent < 0) {
            const decimalPlaces = Math.abs(exponent) + base.replace('.', '').length - 1
            return Number(number).toFixed(decimalPlaces)
        }
    
        return Number(number).toString()
    }
  
    return numStr
}

export const countLeadingZeros = (str: string): number => {
    return (str.match(/^0+/) || [''])[0].length
}

function trimEndingZeros(num: string) {
    return num.toString().replace(/0+$/, '')
}

interface FormatNumberWithSuffixConfig {
    noDecimals?: boolean
    decimalsAfterDot?: number
    alternativeConfig?: boolean
    noSubNumbers?: boolean
}

export const FormatConfig = {
    B: 1000000000,
    M: 1000000,
    K: 1000,
    BDecimals: 9,
    MDecimals: 6,
    KDecimals: 3,
    DecimalsAfterDot: 2
}

export const AlternativeFormatConfig = {
    B: 1000000000,
    M: 1000000,
    K: 10000,
    BDecimals: 9,
    MDecimals: 6,
    KDecimals: 3,
    DecimalsAfterDot: 2
}

export const containsOnlyZeroes = (string: string): boolean => {
    return /^(?!.*[1-9]).*$/.test(string)
}

export const formatNumberWithSuffix = (
    number: number | bigint | string,
    config?: FormatNumberWithSuffixConfig
): string => {
    const {
        noDecimals,
        decimalsAfterDot,
        alternativeConfig,
        noSubNumbers
    }: Required<FormatNumberWithSuffixConfig> = {
        noDecimals: false,
        decimalsAfterDot: 3,
        alternativeConfig: false,
        noSubNumbers: false,
        ...config
    }
  
    const formatConfig = alternativeConfig ? AlternativeFormatConfig : FormatConfig
  
    const numberAsNumber = Number(number)
    const isNegative = numberAsNumber < 0
    const absNumberAsNumber = Math.abs(numberAsNumber)
  
    const absNumberAsString = numberToString(absNumberAsNumber)
  
    if (containsOnlyZeroes(absNumberAsString)) {
        return '0'
    }
  
    const [beforeDot, afterDot] = absNumberAsString.split('.')
  
    let formattedNumber
  
    if (Math.abs(numberAsNumber) >= formatConfig.B) {
        const formattedDecimals = noDecimals
            ? ''
            : '.' +
            (beforeDot.slice(-formatConfig.BDecimals) + (afterDot ? afterDot : '')).slice(
                0,
                formatConfig.DecimalsAfterDot
            )
    
        formattedNumber =
            beforeDot.slice(0, -formatConfig.BDecimals) + (noDecimals ? '' : formattedDecimals) + 'B'
    } else if (Math.abs(numberAsNumber) >= formatConfig.M) {
        const formattedDecimals = noDecimals
            ? ''
            : '.' +
            (beforeDot.slice(-formatConfig.MDecimals) + (afterDot ? afterDot : '')).slice(
                0,
                formatConfig.DecimalsAfterDot
            )
        formattedNumber =
            beforeDot.slice(0, -formatConfig.MDecimals) + (noDecimals ? '' : formattedDecimals) + 'M'
    } else if (Math.abs(numberAsNumber) >= formatConfig.K) {
        const formattedDecimals = noDecimals
            ? ''
            : '.' +
            (beforeDot.slice(-formatConfig.KDecimals) + (afterDot ? afterDot : '')).slice(
                0,
                formatConfig.DecimalsAfterDot
            )
        formattedNumber =
            beforeDot.slice(0, -formatConfig.KDecimals) + (noDecimals ? '' : formattedDecimals) + 'K'
    } else if (afterDot && noSubNumbers) {
        const roundedNumber = absNumberAsNumber.toFixed(decimalsAfterDot + 1).slice(0, -1)
  
        formattedNumber = trimZeros(roundedNumber)
    } else if (afterDot && countLeadingZeros(afterDot) <= decimalsAfterDot) {
        const roundedNumber = absNumberAsNumber
            .toFixed(countLeadingZeros(afterDot) + decimalsAfterDot + 1)
            .slice(0, -1)
    
        formattedNumber = trimZeros(roundedNumber)
    } else {
        const leadingZeros = afterDot ? countLeadingZeros(afterDot) : 0
    
        const parsedAfterDot =
            String(parseInt(afterDot)).length > decimalsAfterDot
            ? String(parseInt(afterDot)).slice(0, decimalsAfterDot)
            : afterDot
    
        if (noSubNumbers && afterDot) {
            formattedNumber = beforeDot + '.' + afterDot
        } else if (parsedAfterDot && afterDot) {
            formattedNumber =
            beforeDot +
            '.' +
            (parsedAfterDot
                ? leadingZeros > decimalsAfterDot
                ? '0' + printSubNumber(leadingZeros) + trimZeros(parsedAfterDot)
                : trimZeros(parsedAfterDot)
                : '')
        } else {
            formattedNumber = beforeDot
        }
    }
  
    return isNegative ? '-' + formattedNumber : formattedNumber
}

export const formatNumberWithoutSuffix = (
    number: number | bigint | string,
    options?: { twoDecimals?: boolean }
): string => {
    const numberAsNumber = Number(number)
    const isNegative = numberAsNumber < 0
    const absNumberAsNumber = Math.abs(numberAsNumber)
  
    if (options?.twoDecimals) {
        if (absNumberAsNumber === 0) {
            return '0'
        }
        if (absNumberAsNumber > 0 && absNumberAsNumber < 0.01) {
            return isNegative ? '-<0.01' : '<0.01'
        }
        return isNegative
            ? '-' + absNumberAsNumber.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
            : absNumberAsNumber.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    }  
    const absNumberAsString = numberToString(absNumberAsNumber)
    const [beforeDot, afterDot] = absNumberAsString.split('.')
  
    const leadingZeros = afterDot ? countLeadingZeros(afterDot) : 0
  
    const parsedBeforeDot = beforeDot.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    const parsedAfterDot =
        leadingZeros >= 4 && absNumberAsNumber < 1
            ? '0' + printSubNumber(leadingZeros) + trimEndingZeros(String(parseInt(afterDot)).slice(0, 3))
            : trimEndingZeros(String(afterDot).slice(0, absNumberAsNumber >= 1 ? 2 : leadingZeros + 3))
  
    const formattedNumber = parsedBeforeDot + (afterDot && parsedAfterDot ? '.' + parsedAfterDot : '')
  
    return isNegative ? '-' + formattedNumber : formattedNumber
}