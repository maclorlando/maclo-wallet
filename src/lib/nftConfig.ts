// NFT Contract Configuration
// Update these addresses after deploying the contracts

export const NFT_CONTRACT_ADDRESSES: Record<string, string> = {
  'ethereum-sepolia': '', // Will be filled after deployment
  'base-sepolia': '' // Will be filled after deployment
};

// Contract configuration
export const NFT_CONTRACT_CONFIG = {
  name: 'Maclo Wallet Test NFT',
  symbol: 'MWT',
  maxSupply: 1000,
  mintPrice: '0', // Free minting
  metadataURIs: [
    'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme.md',
    'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme.md',
    'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme.md'
  ]
};

// Function to update contract addresses after deployment
export function updateNFTContractAddresses(addresses: Record<string, string>) {
  Object.assign(NFT_CONTRACT_ADDRESSES, addresses);
  
  // Also update the nftService addresses
  if (typeof window !== 'undefined') {
    // @ts-expect-error - accessing global function that may not exist
    if (window.updateNFTServiceAddresses) {
      // @ts-expect-error - calling global function with dynamic addresses
      window.updateNFTServiceAddresses(addresses);
    }
  }
}

// Function to get contract address for current network
export function getNFTContractAddress(network: string): string | null {
  return NFT_CONTRACT_ADDRESSES[network] || null;
}

// Function to check if NFT contract is deployed on current network
export function isNFTContractDeployed(network: string): boolean {
  return !!NFT_CONTRACT_ADDRESSES[network];
}
