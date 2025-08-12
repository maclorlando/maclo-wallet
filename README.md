# Crypto Wallet dApp

A basic cryptocurrency wallet built with Next.js, TypeScript, and Tailwind CSS. This dApp provides wallet functionality with manual transaction handling, encryption, and Base Sepolia network integration.

## 🚀 What You Can Do

- **Create New Wallet**: Generate a new wallet with 24-word mnemonic phrase
- **Import Wallet**: Import existing wallet using seed phrase
- **Password Protection**: Encrypt and store mnemonics securely in browser
- **Wallet Recovery**: Recover stored wallets using password
- **Send Transactions**: Send ETH transactions manually
- **Token Management**: Add and manage custom ERC-20 tokens
- **Real-time Balances**: View ETH and token balances with USD values

## 🛠 Technology Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Cryptography**: elliptic (ECDSA), keccak (hashing), rlp (encoding)
- **Wallet**: bip39 (mnemonics), hdkey (HD derivation), crypto-js (encryption)
- **Network**: Base Sepolia testnet via JSON-RPC

## 🔧 Manual Wallet Implementation

This project implements wallet functionality from scratch using only cryptographic libraries, avoiding high-level wallet libraries like `ethers.js` or `web3.js`.

### Transaction Creation Process

1. **Get Account Nonce**: Retrieve transaction count from blockchain
2. **Estimate Gas**: Calculate required gas for transaction
3. **Get Gas Price**: Fetch current gas price from network
4. **Build Raw Transaction**: Create unsigned transaction data
5. **RLP Encode**: Encode transaction data using RLP
6. **Hash Transaction**: Create Keccak-256 hash of encoded data
7. **ECDSA Signing**: Sign hash with private key using elliptic curve
8. **Broadcast**: Send signed transaction to network

### Key Cryptographic Functions Used

```typescript
// ECDSA signing with elliptic
const ec = new EC("secp256k1");
const keyPair = ec.keyFromPrivate(privateKey);
const signature = keyPair.sign(msgHash, { canonical: true });

// Keccak-256 hashing
const msgHash = Keccak("keccak256").update(Buffer.from(rlpEncoded)).digest();

// RLP encoding for Ethereum transactions
const rlpEncoded = rlp.encode(txData);

// HD wallet derivation
const seed = bip39.mnemonicToSeedSync(mnemonic);
const hdWallet = hdkey.fromMasterSeed(seed);
const childKey = hdWallet.derive("m/44'/60'/0'/0/0");

// AES encryption for mnemonics
const encrypted = CryptoJS.AES.encrypt(mnemonic, key).toString();
```

### Network Integration

Direct JSON-RPC calls to Base Sepolia for:
- Account nonce retrieval
- Gas estimation
- Balance fetching
- Raw transaction broadcasting