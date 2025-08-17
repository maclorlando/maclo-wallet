# Maclo Wallet

A secure, feature-rich cryptocurrency wallet built with Next.js, TypeScript, and Tailwind CSS. This wallet supports multiple networks, accounts, and token types with a modern, user-friendly interface.

## Features

### 🔐 Security & Wallet Management
- **HD Wallet Support**: BIP39 mnemonic phrase generation and recovery
- **Multiple Accounts**: Create and manage multiple accounts from a single mnemonic
- **Account Switching**: Seamlessly switch between different accounts
- **Encrypted Storage**: Secure local storage with password protection
- **Manual Transaction Creation**: All transactions are created manually without external wallet libraries

### 🌐 Network Support
- **Base Sepolia**: Testnet for Base network
- **Ethereum Sepolia**: Ethereum testnet
- **Network Switching**: Easy switching between supported networks
- **Automatic RPC Configuration**: Proper RPC endpoints for each network

### 💰 Token Management
- **ETH Transfers**: Send native ETH on supported networks
- **ERC20 Token Support**: Send any ERC20 token
- **ERC721 NFT Support**: Transfer NFTs between addresses
- **Token Balance Tracking**: Real-time balance updates
- **Custom Token Addition**: Add any ERC20 token to your wallet
- **USD Value Display**: Token values in USD (where available)

### 🔄 Balance Management
- **Automatic Refresh**: Balances refresh automatically every 60 seconds
- **Manual Refresh**: Manual balance refresh button
- **Post-Transaction Refresh**: Balances update after successful transactions
- **Multi-Account Balances**: Track balances across all accounts

### 🎨 User Interface
- **Modern Design**: Clean, responsive interface with Tailwind CSS
- **Real-time Updates**: Live balance and transaction status updates
- **Alert System**: Success, error, and info notifications
- **Loading States**: Visual feedback during operations
- **Mobile Responsive**: Works on desktop and mobile devices

## Technical Implementation

### Core Technologies
- **Next.js 15**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Elliptic**: Cryptography library for key generation and signing
- **BIP39**: Mnemonic phrase generation and validation
- **HDKey**: Hierarchical deterministic key derivation

### Key Components
- **Manual Transaction Creation**: All transactions are built from scratch without using ethers.js or similar libraries
- **Raw Transaction Signing**: Custom implementation of EIP-155 transaction signing
- **Gas Estimation**: Automatic gas estimation for transactions
- **Nonce Management**: Proper nonce handling for transaction ordering

### Security Features
- **Client-side Only**: All cryptographic operations happen in the browser
- **No External Dependencies**: No reliance on external wallet providers
- **Encrypted Storage**: Local storage encryption with PBKDF2
- **Secure Key Derivation**: BIP44 HD wallet path derivation

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd maclo-wallet
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file (optional):
```bash
# For better performance, add your own RPC URLs
NEXT_PUBLIC_BASE_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_API_KEY
NEXT_PUBLIC_ETH_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_API_KEY
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

### Creating a Wallet
1. Click "Create New Wallet"
2. Save your mnemonic phrase securely
3. Set a password to encrypt your wallet
4. Your wallet is ready to use!

### Managing Accounts
1. Click the "Account X" button in the header
2. View all accounts derived from your mnemonic
3. Switch between accounts by clicking on them
4. Add new accounts with the "Add New Account" button

### Sending Transactions
1. Click "Send Transaction" in the Quick Actions
2. Choose transaction type: ETH, Token, or NFT
3. Fill in recipient address and amount
4. Confirm and send

### Adding Tokens
1. Click "Add Token" in Quick Actions
2. Enter token contract address and details
3. Or select from popular tokens in the dropdown
4. Token will appear in your balance list

### Managing NFTs
1. Click "Manage NFTs" in Quick Actions
2. Add NFT contract address and token ID
3. View and manage your NFT collection
4. Send NFTs using the Send Transaction feature

## Network Support

### Base Sepolia
- **Chain ID**: 84532
- **RPC URL**: https://sepolia.base.org
- **Block Explorer**: https://sepolia.basescan.org
- **Native Token**: ETH

### Ethereum Sepolia
- **Chain ID**: 11155111
- **RPC URL**: https://rpc.sepolia.org
- **Block Explorer**: https://sepolia.etherscan.io
- **Native Token**: ETH

## Security Considerations

⚠️ **Important Security Notes**:
- This is a testnet wallet - do not use with real funds
- Always backup your mnemonic phrase securely
- Never share your private keys or mnemonic
- The wallet stores data locally - clear browser data to remove wallets
- Consider using hardware wallets for mainnet funds

## Development

### Project Structure
```
src/
├── app/                 # Next.js app router pages
├── components/          # React components
│   ├── AccountManager.tsx
│   ├── NFTManager.tsx
│   ├── NetworkSwitcher.tsx
│   ├── SafeImage.tsx
│   └── SendTransaction.tsx
├── lib/                 # Core wallet logic
│   ├── walletContext.tsx
│   ├── walletManager.ts
│   ├── walletUtils.ts
│   └── requestManager.ts
```

### Key Functions
- `walletUtils.ts`: Core cryptographic and transaction functions
- `walletManager.ts`: Wallet and account management
- `walletContext.tsx`: React context for wallet state
- `requestManager.ts`: HTTP request handling with caching

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Disclaimer

This wallet is for educational and testing purposes only. Use at your own risk and never store real funds without proper security measures.