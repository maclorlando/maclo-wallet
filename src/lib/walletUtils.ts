import { ec as EC } from "elliptic";
import * as rlp from "rlp";
// @ts-expect-error - keccak module has no type definitions
import Keccak from "keccak";
import axios from "axios";

// Initialize elliptic curve
let ec: EC;
try {
    ec = new EC("secp256k1");
    
    // Test if the elliptic curve is working
    if (!ec || typeof ec.keyFromPrivate !== 'function') {
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

export interface TokenTransferData {
    tokenAddress: string;
    to: string;
    amount: string; // For ERC20: amount in smallest unit, For ERC721: tokenId
    isERC721: boolean;
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

// ERC20 transfer function signature: transfer(address,uint256)
const ERC20_TRANSFER_SIGNATURE = "0xa9059cbb";

// ERC721 transfer function signature: transferFrom(address,address,uint256)
const ERC721_TRANSFER_FROM_SIGNATURE = "0x23b872dd";

// ERC721 safeTransferFrom function signature: safeTransferFrom(address,address,uint256)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const ERC721_SAFE_TRANSFER_FROM_SIGNATURE = "0x42842e0e";

// Function to encode ERC20 transfer data
export function encodeERC20TransferData(to: string, amount: string, decimals: number = 18): string {
    // Remove 0x prefix if present
    const cleanTo = to.startsWith('0x') ? to.slice(2) : to;
    
    // Convert amount to the smallest unit (e.g., wei for ETH, smallest unit for tokens)
    // For tokens with decimals, multiply by 10^decimals
    const amountInSmallestUnit = BigInt(Math.floor(Number(amount) * Math.pow(10, decimals)));
    
    // Convert to hex and pad to 32 bytes (64 hex characters)
    const amountHex = amountInSmallestUnit.toString(16).padStart(64, '0');
    
    // Encode parameters: address (32 bytes) + uint256 (32 bytes)
    const encodedData = ERC20_TRANSFER_SIGNATURE + 
                       cleanTo.padStart(64, '0') + 
                       amountHex;
    
    // Return without 0x prefix since it will be added later
    return encodedData;
}

// Function to encode ERC721 transfer data
export function encodeERC721TransferData(from: string, to: string, tokenId: string): string {
    // Remove 0x prefix if present
    const cleanFrom = from.startsWith('0x') ? from.slice(2) : from;
    const cleanTo = to.startsWith('0x') ? to.slice(2) : to;
    
    // Convert tokenId to hex and pad to 32 bytes (64 hex characters)
    const tokenIdHex = BigInt(tokenId).toString(16).padStart(64, '0');
    
    // Encode parameters: address (32 bytes) + address (32 bytes) + uint256 (32 bytes)
    const encodedData = ERC721_TRANSFER_FROM_SIGNATURE + 
                       cleanFrom.padStart(64, '0') + 
                       cleanTo.padStart(64, '0') + 
                       tokenIdHex;
    
    // Return without 0x prefix since it will be added later
    return encodedData;
}

export function deriveAddress(privateKey: string): string {
    try {
        // Ensure private key is properly formatted (64 hex characters)
        let cleanPrivateKey = privateKey;
        if (privateKey.startsWith('0x')) {
            cleanPrivateKey = privateKey.slice(2);
        }
        
        // Pad with zeros if needed to ensure 64 characters
        while (cleanPrivateKey.length < 64) {
            cleanPrivateKey = '0' + cleanPrivateKey;
        }
        
        if (!ec) {
            throw new Error('Elliptic curve is undefined');
        }
        
        if (typeof ec.keyFromPrivate !== 'function') {
            throw new Error('keyFromPrivate method is not available on elliptic curve');
        }

        const keyPair = ec.keyFromPrivate(cleanPrivateKey, 'hex');
        const pubPoint = keyPair.getPublic();
        const pubKey = pubPoint.encode("hex", false).slice(2);
        const hash = Keccak("keccak256").update(Buffer.from(pubKey, "hex")).digest("hex");
        const address = "0x" + hash.slice(24);
        
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

export async function estimateGas(config: WalletConfig, from: string, to: string, valueEth: string, data: string = "0x"): Promise<number> {
    const valueWei = ethToWeiHex(valueEth);
    if (config.provider) {
        const gasHex: string = await config.provider.send("eth_estimateGas", [{
            from,
            to,
            value: valueWei,
            data: data
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
                data: data
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

export async function buildAndSendRawTx(config: WalletConfig, to: string, valueEth: string, data: string = "0x") {
    const { privateKey, chainId } = config;
    const senderAddress = deriveAddress(privateKey);

    const nonce = await getNonce(config, senderAddress);
    const gasLimit = await estimateGas(config, senderAddress, to, valueEth, data);
    const gasPrice = await getGasPrice(config);
    const valueWei = ethToWeiHex(valueEth);

    // Ensure data has 0x prefix
    const cleanData = data.startsWith('0x') ? data : '0x' + data;

    // Build unsigned tx with all numeric fields cleaned
    const txData = [
        toBuffer(nonce),
        toBuffer(gasPrice),
        toBuffer(gasLimit),
        Buffer.from(to.slice(2), "hex"), // address without 0x
        toBuffer(valueWei),
        Buffer.from(cleanData.slice(2), "hex"), // data field without 0x
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
        Buffer.from(cleanData.slice(2), "hex"), // data field without 0x
        toBuffer(v),
        r, // already a Buffer from signature
        s  // already a Buffer from signature
    ];

    const signedRlpEncoded = rlp.encode(signedTxData);
    const rawTxHex = "0x" + Buffer.from(signedRlpEncoded).toString("hex");

    return await sendRawTransaction(config, rawTxHex);
}

// New function for ERC20 token transfers
export async function sendERC20Token(config: WalletConfig, tokenAddress: string, to: string, amount: string, decimals: number = 18) {
    console.log('sendERC20Token called with:', { tokenAddress, to, amount, decimals });
    const transferData = encodeERC20TransferData(to, amount, decimals);
    console.log('Encoded transfer data:', transferData);
    const result = await buildAndSendRawTx(config, tokenAddress, "0", transferData);
    console.log('Transaction result:', result);
    return result;
}

// New function for ERC721 NFT transfers
export async function sendERC721NFT(config: WalletConfig, nftAddress: string, from: string, to: string, tokenId: string) {
    const transferData = encodeERC721TransferData(from, to, tokenId);
    return await buildAndSendRawTx(config, nftAddress, "0", transferData);
}

// Function to get ERC20 token balance
export async function getERC20Balance(config: WalletConfig, tokenAddress: string, walletAddress: string): Promise<string> {
    const balanceOfSignature = "0x70a08231"; // balanceOf(address)
    const paddedAddress = walletAddress.slice(2).padStart(64, '0');
    const data = balanceOfSignature + paddedAddress;

    if (config.provider) {
        const result = await config.provider.send("eth_call", [{
            to: tokenAddress,
            data: data
        }, "latest"]);
        return BigInt(result).toString();
    } else {
        const res = await axios.post(config.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{
                to: tokenAddress,
                data: data
            }, "latest"]
        });
        return BigInt(res.data.result).toString();
    }
}

// Function to get ERC721 token owner
export async function getERC721Owner(config: WalletConfig, nftAddress: string, tokenId: string): Promise<string> {
    const ownerOfSignature = "0x6352211e"; // ownerOf(uint256)
    const paddedTokenId = BigInt(tokenId).toString(16).padStart(64, '0');
    const data = ownerOfSignature + paddedTokenId;

    if (config.provider) {
        const result = await config.provider.send("eth_call", [{
            to: nftAddress,
            data: data
        }, "latest"]);
        return "0x" + result.slice(26); // Remove padding and add 0x
    } else {
        const res = await axios.post(config.rpcUrl, {
            jsonrpc: "2.0",
            id: 1,
            method: "eth_call",
            params: [{
                to: nftAddress,
                data: data
            }, "latest"]
        });
        return "0x" + res.data.result.slice(26); // Remove padding and add 0x
    }
}
