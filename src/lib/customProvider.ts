import { ethers } from 'ethers';

// Custom provider that uses our RPC proxy
export class CustomProvider extends ethers.JsonRpcProvider {
  private networkName: string;

  constructor(networkName: string) {
    // Pass a dummy URL to the parent constructor
    super('http://localhost:3000/api/rpc-proxy');
    this.networkName = networkName;
  }

  async _send(payload: any): Promise<any> {
    const response = await fetch('/api/rpc-proxy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        network: this.networkName,
        method: payload.method,
        params: payload.params || []
      })
    });

    if (!response.ok) {
      throw new Error(`RPC request failed: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error.message || data.error);
    }

    return data;
  }

  // Override the network detection
  async getNetwork(): Promise<ethers.Network> {
    // Return a default network based on the network name
    if (this.networkName === 'base-sepolia') {
      return {
        name: 'base-sepolia',
        chainId: 84532n
      };
    } else if (this.networkName === 'ethereum-sepolia') {
      return {
        name: 'sepolia',
        chainId: 11155111n
      };
    }
    
    // Default fallback
    return {
      name: 'unknown',
      chainId: 1n
    };
  }
}
