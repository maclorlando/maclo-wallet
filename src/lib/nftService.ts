import { ethers } from 'ethers';
import { NETWORKS, getCurrentNetwork } from './walletManager';
import { NFT_CONTRACT_ADDRESSES, updateNFTContractAddresses } from './nftConfig';

// NFT Contract ABI - only the functions we need
const NFT_ABI = [
  "function mint(address to, string memory tokenURI) public payable returns (uint256)",
  "function mintBatch(address to, string[] memory tokenURIs) public payable returns (uint256[])",
  "function totalSupply() public view returns (uint256)",
  "function tokenURI(uint256 tokenId) public view returns (string memory)",
  "function ownerOf(uint256 tokenId) public view returns (address)",
  "function balanceOf(address owner) public view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) public view returns (uint256)",
  "event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI)"
];

// Contract addresses are now imported from nftConfig.ts

// Metadata URIs for the test NFTs
const NFT_METADATA_URIS = [
  'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme.md',
  'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme.md',
  'https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG/readme.md'
];

export interface MintResult {
  success: boolean;
  tokenId?: string;
  tokenIds?: string[];
  error?: string;
  transactionHash?: string;
}

export class NFTService {
  private network: string;
  private privateKey: string;
  private contract: ethers.Contract | null = null;
  private signer: ethers.Wallet | null = null;

  constructor(privateKey: string) {
    this.network = getCurrentNetwork();
    this.privateKey = privateKey;
    
    // Create wallet without provider for now
    this.signer = new ethers.Wallet(privateKey);
    
    const contractAddress = NFT_CONTRACT_ADDRESSES[network];
    if (contractAddress) {
      this.contract = new ethers.Contract(contractAddress, NFT_ABI, this.signer);
    }
  }

  // Update contract addresses after deployment
  static updateContractAddresses(addresses: Record<string, string>) {
    updateNFTContractAddresses(addresses);
  }

  // Get contract address for current network
  static getContractAddress(): string | null {
    const network = getCurrentNetwork();
    return NFT_CONTRACT_ADDRESSES[network] || null;
  }

  // Helper method to make RPC calls through proxy
  private async makeRPCRequest(method: string, params: any[] = []): Promise<any> {
    const response = await fetch('/api/rpc-proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ network: this.network, method, params })
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data.result;
  }

  // Check if NFT contract is available
  isContractAvailable(): boolean {
    return NFT_CONTRACT_ADDRESSES[this.network] !== undefined;
  }

  // Mint a single NFT
  async mintNFT(tokenURI?: string): Promise<MintResult> {
    if (!this.contract || !this.signer) {
      return {
        success: false,
        error: 'Contract not available or signer not initialized'
      };
    }

    try {
      const userAddress = await this.signer.getAddress();
      const metadataURI = tokenURI || NFT_METADATA_URIS[0];
      
      console.log(`Minting NFT to ${userAddress} with URI: ${metadataURI}`);
      
      const tx = await this.contract.mint(userAddress, metadataURI, {
        value: ethers.parseEther('0') // Free minting
      });
      
      const receipt = await tx.wait();
      
      // Find the NFTMinted event
      const mintEvent = receipt.logs.find((log: any) => {
        try {
          const parsed = this.contract!.interface.parseLog(log);
          return parsed.name === 'NFTMinted';
        } catch {
          return false;
        }
      });

      if (mintEvent) {
        const parsed = this.contract!.interface.parseLog(mintEvent);
        const tokenId = parsed.args[1].toString();
        
        return {
          success: true,
          tokenId,
          transactionHash: receipt.hash
        };
      }

      return {
        success: true,
        transactionHash: receipt.hash
      };

    } catch (error) {
      console.error('Error minting NFT:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Mint multiple NFTs
  async mintBatchNFTs(count: number = 3): Promise<MintResult> {
    if (!this.contract || !this.signer) {
      return {
        success: false,
        error: 'Contract not available or signer not initialized'
      };
    }

    try {
      const userAddress = await this.signer.getAddress();
      const tokenURIs = NFT_METADATA_URIS.slice(0, count);
      
      console.log(`Minting ${count} NFTs to ${userAddress}`);
      
      const tx = await this.contract.mintBatch(userAddress, tokenURIs, {
        value: ethers.parseEther('0') // Free minting
      });
      
      const receipt = await tx.wait();
      
      // Find all NFTMinted events
      const mintEvents = receipt.logs.filter((log: any) => {
        try {
          const parsed = this.contract!.interface.parseLog(log);
          return parsed.name === 'NFTMinted';
        } catch {
          return false;
        }
      });

      const tokenIds = mintEvents.map((log: any) => {
        const parsed = this.contract!.interface.parseLog(log);
        return parsed.args[1].toString();
      });

      return {
        success: true,
        tokenIds,
        transactionHash: receipt.hash
      };

    } catch (error) {
      console.error('Error minting batch NFTs:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  // Get user's NFTs from the contract
  async getUserNFTs(): Promise<string[]> {
    if (!this.contract || !this.signer) {
      return [];
    }

    try {
      const userAddress = await this.signer.getAddress();
      const balance = await this.contract.balanceOf(userAddress);
      const tokenIds: string[] = [];

      for (let i = 0; i < balance; i++) {
        const tokenId = await this.contract.tokenOfOwnerByIndex(userAddress, i);
        tokenIds.push(tokenId.toString());
      }

      return tokenIds;
    } catch (error) {
      console.error('Error getting user NFTs:', error);
      return [];
    }
  }

  // Get NFT metadata
  async getNFTMetadata(tokenId: string): Promise<any> {
    if (!this.contract) {
      return null;
    }

    try {
      const tokenURI = await this.contract.tokenURI(tokenId);
      
      // Fetch metadata from IPFS or HTTP
      const response = await fetch(tokenURI);
      if (!response.ok) {
        throw new Error('Failed to fetch metadata');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error getting NFT metadata:', error);
      return null;
    }
  }
}

// Helper function to create NFT service instance
export function createNFTService(privateKey: string): NFTService {
  return new NFTService(privateKey);
}
