# Maclo Wallet NFT Contract Deployment

This directory contains the smart contracts and deployment scripts for the Maclo Wallet NFT testing feature.

## Contract Overview

The `MacloNFT` contract is a simple ERC-721 implementation with the following features:
- Free minting (configurable price)
- Configurable maximum supply
- Metadata support via token URIs
- Batch minting capability
- Owner-only admin functions

## Prerequisites

1. **Node.js and npm** installed
2. **Testnet ETH** on both Ethereum Sepolia and Base Sepolia
3. **Private key** of the account you want to deploy from

## Setup Instructions

1. **Install dependencies:**
   ```bash
   cd contracts
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp .env.example .env
   ```
   
   Then edit `.env` and add your private key:
   ```
   PRIVATE_KEY=your_private_key_here
   ```

3. **Get testnet ETH:**
   - **Ethereum Sepolia:** https://sepoliafaucet.com/
   - **Base Sepolia:** https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet

## Deployment Steps

### Option 1: Deploy to both networks at once
```bash
npm run deploy:all
```

### Option 2: Deploy to networks separately
```bash
# Deploy to Ethereum Sepolia
npm run deploy:eth

# Deploy to Base Sepolia
npm run deploy:base
```

### Option 3: Manual deployment
```bash
# Compile contracts
npx hardhat compile

# Deploy to Ethereum Sepolia
npx hardhat run deploy.js --network ethereumSepolia

# Deploy to Base Sepolia
npx hardhat run deploy.js --network baseSepolia
```

## Contract Verification (Optional)

After deployment, you can verify the contracts on block explorers:

1. **Get API keys:**
   - Etherscan: https://etherscan.io/apis
   - Basescan: https://basescan.org/apis

2. **Add to .env:**
   ```
   ETHERSCAN_API_KEY=your_etherscan_api_key
   BASESCAN_API_KEY=your_basescan_api_key
   ```

3. **Verify contracts:**
   ```bash
   npm run verify:eth
   npm run verify:base
   ```

## Deployment Output

After successful deployment, a `deployment.json` file will be created with:
- Contract addresses for both networks
- Network configuration details
- Contract configuration

## Contract Addresses

Once deployed, you'll get contract addresses like:
- **Ethereum Sepolia:** `0x...`
- **Base Sepolia:** `0x...`

Save these addresses - you'll need them for the wallet integration.

## Testing the Contract

You can test the contract functions using the wallet's mint feature or directly:

```javascript
// Mint a single NFT
await contract.mint(userAddress, "https://ipfs.io/ipfs/metadata/1.json");

// Mint multiple NFTs
await contract.mintBatch(userAddress, [
  "https://ipfs.io/ipfs/metadata/1.json",
  "https://ipfs.io/ipfs/metadata/2.json",
  "https://ipfs.io/ipfs/metadata/3.json"
]);
```

## Next Steps

After deployment:
1. Update the wallet configuration with the contract addresses
2. Test the minting feature in the wallet
3. Test NFT importing and transferring
