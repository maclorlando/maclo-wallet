import { ec as EC } from "elliptic";
import * as rlp from "rlp";
// @ts-expect-error - keccak module has no type definitions
import Keccak from "keccak";
import axios from "axios";

// Initialize elliptic curve
let ec: EC;
try {
    console.log('Attempting to initialize elliptic curve...');
    ec = new EC("secp256k1");
    console.log('Elliptic curve initialized:', ec ? 'success' : 'failed');
    
    // Test if the elliptic curve is working
    if (ec && typeof ec.keyFromPrivate === 'function') {
        console.log('Elliptic curve is properly initialized and functional');
    } else {
        throw new Error('Elliptic curve initialization failed - keyFromPrivate method not available');
    }
} catch (error) {
    console.error('Failed to initialize elliptic curve:', error);
    throw new Error('Failed to initialize cryptographic library: ' + error);
}

export interface WalletConfig {
    privateKey: string;
    chainId: number;
    rpcUrl: string; // used for axios mode
    provider?: { send: (method: string, params: unknown[]) => Promise<string> }; // optional for in-memory Hardhat network
}

// 🔹 Utility to strip leading zeros in hex values (unused - keeping for reference)
// function stripHexPrefixAndZero(hex: string): string {
//     let h = hex.toLowerCase();
//     if (h.startsWith("0x")) {
//         h = h.slice(2);
//     }
//     h = h.replace(/^0+/, ""); // remove leading zeros
//     return h === "" ? "0x0" : "0x" + h;
// }

export function deriveAddress(privateKey: string): string {
    try {
        console.log('deriveAddress called with privateKey:', privateKey.substring(0, 10) + '...');
        console.log('Private key length:', privateKey.length);

        // Ensure private key is properly formatted (64 hex characters)
        let cleanPrivateKey = privateKey;
        if (privateKey.startsWith('0x')) {
            cleanPrivateKey = privateKey.slice(2);
        }
        
        // Pad with zeros if needed to ensure 64 characters
        while (cleanPrivateKey.length < 64) {
            cleanPrivateKey = '0' + cleanPrivateKey;
        }
        
        console.log('Clean private key:', cleanPrivateKey.substring(0, 10) + '...');
        console.log('Clean private key length:', cleanPrivateKey.length);
        console.log('Clean private key is valid hex:', /^[0-9a-fA-F]+$/.test(cleanPrivateKey));
        
        if (!ec) {
            throw new Error('Elliptic curve is undefined');
        }
        
        if (typeof ec.keyFromPrivate !== 'function') {
            throw new Error('keyFromPrivate method is not available on elliptic curve');
        }
        
        console.log('About to call keyFromPrivate...');
        console.log('EC object at call time:', ec);

        const keyPair = ec.keyFromPrivate(cleanPrivateKey, 'hex');
        console.log('Key pair created');
        
        const pubPoint = keyPair.getPublic();
        console.log('Public point created');
        
        const pubKey = pubPoint.encode("hex", false).slice(2);
        console.log('Public key encoded:', pubKey.substring(0, 20) + '...');
        
        const hash = Keccak("keccak256").update(Buffer.from(pubKey, "hex")).digest("hex");
        console.log('Hash created:', hash.substring(0, 20) + '...');
        
        const address = "0x" + hash.slice(24);
        console.log('Address created:', address);
        
        return address;
    } catch (error) {
        console.error('Error in deriveAddress:', error);
        console.error('Private key that caused error:', privateKey);
        console.error('EC object state:', ec);
        console.error('EC object type:', typeof ec);
        throw error;
    }
}

export function ethToWeiHex(eth: string): string {
    const [whole, frac = ""] = eth.split(".");
    const wei = BigInt(whole) * BigInt(1e18) +
        BigInt((frac.padEnd(18, "0")).slice(0, 18));
    return "0x" + wei.toString(16);
}

export async function getNonce(config: WalletConfig, address: string): Promise<number> {
    if (config.provider) {
        const nonceHex: string = await config.provider.send("eth_getTransactionCount", [address, "pending"]);
        return parseInt(nonceHex, 16);
    } else {
        const res = await axios.post(config.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_getTransactionCount",
            params: [address, "pending"]
        });
        return parseInt(res.data.result, 16);
    }
}

export async function estimateGas(config: WalletConfig, from: string, to: string, valueEth: string): Promise<number> {
    const valueWei = ethToWeiHex(valueEth);
    if (config.provider) {
        const gasHex: string = await config.provider.send("eth_estimateGas", [{
            from,
            to,
            value: valueWei,
            data: "0x"
        }]);
        return parseInt(gasHex, 16);
    } else {
        const res = await axios.post(config.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_estimateGas",
            params: [{
                from,
                to,
                value: valueWei,
                data: "0x"
            }]
        });
        return parseInt(res.data.result, 16);
    }
}

export async function getGasPrice(config: WalletConfig): Promise<string> {
    if (config.provider) {
        return await config.provider.send("eth_gasPrice", []);
    } else {
        const res = await axios.post(config.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_gasPrice",
            params: []
        });
        return res.data.result;
    }
}

export async function sendRawTransaction(config: WalletConfig, rawTxHex: string) {
    if (config.provider) {
        return await config.provider.send("eth_sendRawTransaction", [rawTxHex]);
    } else {
        const res = await axios.post(config.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_sendRawTransaction",
            params: [rawTxHex]
        });
        return res.data.result;
    }
}

function toBuffer(numOrHex: number | string): Buffer {
    if (typeof numOrHex === "number") {
        if (numOrHex === 0) return Buffer.alloc(0);
        let hex = numOrHex.toString(16);
        if (hex.length % 2) hex = "0" + hex; // pad to even length
        return Buffer.from(hex, "hex");
    } else {
        let hex = numOrHex.toLowerCase();
        if (hex.startsWith("0x")) hex = hex.slice(2);
        if (hex === "" || /^0+$/.test(hex)) return Buffer.alloc(0);
        if (hex.length % 2) hex = "0" + hex; // pad to even length
        return Buffer.from(hex, "hex");
    }
}

export async function buildAndSendRawTx(config: WalletConfig, to: string, valueEth: string) {
    const { privateKey, chainId } = config;
    const senderAddress = deriveAddress(privateKey);

    const nonce = await getNonce(config, senderAddress);
    const gasLimit = await estimateGas(config, senderAddress, to, valueEth);
    const gasPrice = await getGasPrice(config);
    const valueWei = ethToWeiHex(valueEth);

    // Build unsigned tx with all numeric fields cleaned
    const txData = [
        toBuffer(nonce),
        toBuffer(gasPrice),
        toBuffer(gasLimit),
        Buffer.from(to.slice(2), "hex"), // address without 0x
        toBuffer(valueWei),
        Buffer.alloc(0), // empty data field
        toBuffer(chainId),
        Buffer.alloc(0), // empty r
        Buffer.alloc(0)  // empty s
    ];

    const rlpEncoded = rlp.encode(txData);
    const msgHash = Keccak("keccak256").update(Buffer.from(rlpEncoded)).digest();

    // Ensure private key is properly formatted
    let cleanPrivateKey = privateKey;
    if (privateKey.startsWith('0x')) {
        cleanPrivateKey = privateKey.slice(2);
    }
    
    // Pad with zeros if needed to ensure 64 characters
    while (cleanPrivateKey.length < 64) {
        cleanPrivateKey = '0' + cleanPrivateKey;
    }
    
    const keyPair = ec.keyFromPrivate(cleanPrivateKey, 'hex');
    const signature = keyPair.sign(msgHash, { canonical: true });

    const r = signature.r.toArrayLike(Buffer, "be", 32);
    const s = signature.s.toArrayLike(Buffer, "be", 32);
    let v = signature.recoveryParam!;
    v += chainId * 2 + 35;

    const signedTxData = [
        toBuffer(nonce),
        toBuffer(gasPrice),
        toBuffer(gasLimit),
        Buffer.from(to.slice(2), "hex"),
        toBuffer(valueWei),
        Buffer.alloc(0), // empty data field
        toBuffer(v),
        r, // already a Buffer from signature
        s  // already a Buffer from signature
    ];

    const signedRlpEncoded = rlp.encode(signedTxData);
    const rawTxHex = "0x" + Buffer.from(signedRlpEncoded).toString("hex");

    return await sendRawTransaction(config, rawTxHex);
}
