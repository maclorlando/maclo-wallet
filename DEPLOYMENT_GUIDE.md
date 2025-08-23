# NFT Contract Deployment Guide

This guide will walk you through deploying the NFT contract to both Ethereum Sepolia and Base Sepolia, and then integrating it with your wallet.

## Prerequisites

1. **Node.js and npm** installed
2. **Testnet ETH** on both networks
3. **Private key** of the account you want to deploy from

## Step 1: Get Testnet ETH

### Ethereum Sepolia
- Visit: https://sepoliafaucet.com/
- Enter your wallet address
- Request test ETH

### Base Sepolia
- Visit: https://www.coinbase.com/faucets/base-ethereum-sepolia-faucet
- Connect your wallet or enter your address
- Request test ETH

## Step 2: Deploy the NFT Contract

### 1. Navigate to the contracts directory
```bash
cd contracts
```

### 2. Install dependencies
```bash
npm install
```

### 3. Create environment file
```bash
# Create .env file
echo "PRIVATE_KEY=your_private_key_here" > .env
```

**Replace `your_private_key_here` with your actual private key (without 0x prefix)**

### 4. Deploy to both networks
```bash
npm run deploy:all
```

This will deploy the contract to both Ethereum Sepolia and Base Sepolia networks.

### 5. Save the deployment addresses
After successful deployment, you'll see output like:
```
Ethereum Sepolia NFT deployed to: 0x1234...
Base Sepolia NFT deployed to: 0x5678...
```

**Save these addresses - you'll need them for the next step.**

## Step 3: Update Wallet Configuration

### 1. Update the contract addresses in the wallet

Open `src/lib/nftConfig.ts` and update the addresses:

```typescript
export const NFT_CONTRACT_ADDRESSES: Record<string, string> = {
  'ethereum-sepolia': '0x1234...', // Your deployed Ethereum Sepolia address
  'base-sepolia': '0x5678...' // Your deployed Base Sepolia address
};
```

### 2. Restart the development server
```bash
# From the root directory
npm run dev
```

## Step 4: Test the NFT Features

### 1. Create or import a wallet
- Make sure you have a wallet with some testnet ETH

### 2. Switch to Ethereum Sepolia or Base Sepolia
- Use the network switcher in the wallet

### 3. Mint test NFTs
- Go to the NFT Collections section
- Click "Mint Test NFT"
- Choose how many NFTs to mint (1-3)
- Confirm the transaction

### 4. Test NFT importing
- After minting, the NFTs should appear in your wallet
- You can also manually add NFTs using the "Add NFT" button

### 5. Test NFT transferring
- Select an NFT and click the send button
- Enter a recipient address
- Confirm the transaction

## Step 5: Verify Contracts (Optional)

If you want to verify the contracts on block explorers:

### 1. Get API keys
- **Etherscan**: https://etherscan.io/apis
- **Basescan**: https://basescan.org/apis

### 2. Add to .env
```
ETHERSCAN_API_KEY=your_etherscan_api_key
BASESCAN_API_KEY=your_basescan_api_key
```

### 3. Verify contracts
```bash
npm run verify:eth
npm run verify:base
```

## Contract Features

The deployed NFT contract includes:

- **Free minting** (configurable price)
- **Batch minting** (mint multiple NFTs at once)
- **Metadata support** (IPFS/HTTP URIs)
- **Configurable supply** (currently set to 1000)
- **Owner functions** (set price, supply, withdraw funds)

## Troubleshooting

### Contract deployment fails
- Check that you have enough testnet ETH
- Verify your private key is correct
- Check network connectivity

### Minting fails
- Ensure you're on the correct network
- Check that the contract address is updated in `nftConfig.ts`
- Verify you have enough ETH for gas fees

### NFTs don't appear
- Check the transaction on the block explorer
- Refresh the wallet
- Try switching networks and back

## Next Steps

After successful deployment and testing:

1. **Test on both networks** - Make sure everything works on both Ethereum Sepolia and Base Sepolia
2. **Test all features** - Minting, importing, transferring, and viewing NFTs
3. **Customize metadata** - Update the metadata URIs in the contract if needed
4. **Deploy to mainnet** - When ready, deploy to Ethereum mainnet and Base mainnet

## Contract Addresses

After deployment, your contract addresses will be:
- **Ethereum Sepolia**: `0x...`
- **Base Sepolia**: `0x...`

Keep these addresses safe and update them in the wallet configuration.
