import { NextRequest, NextResponse } from 'next/server';

// Network configurations with Alchemy API keys (server-side only)
const NETWORK_CONFIGS = {
  'base-sepolia': {
    rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL
  },
  'ethereum-sepolia': {
    rpcUrl: process.env.NEXT_PUBLIC_ETH_RPC_URL
  }
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { network, method, params } = body;

    // Validate request
    if (!network || !method) {
      console.error('[RPC Proxy] Missing required parameters:', { network, method });
      return NextResponse.json(
        { error: 'Missing required parameters: network and method' },
        { status: 400 }
      );
    }

    // Get network configuration
    const networkConfig = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS];
    if (!networkConfig) {
      return NextResponse.json(
        { error: `Network ${network} not supported` },
        { status: 400 }
      );
    }

    // Check if Alchemy RPC URL is configured
    if (!networkConfig.rpcUrl) {
      console.error(`[RPC Proxy] Missing environment variable for ${network}`);
      return NextResponse.json(
        { error: `RPC endpoint not configured for ${network}` },
        { status: 500 }
      );
    }



    // Forward the RPC request to Alchemy endpoint with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(networkConfig.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method,
          params: params || []
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[RPC Proxy] ${network} Alchemy request failed:`, response.status, response.statusText);
        return NextResponse.json(
          { error: `RPC request failed: ${response.statusText}` },
          { status: response.status }
        );
      }

      const data = await response.json();
      
      if (data.error) {
        console.error(`[RPC Proxy] ${network} Alchemy returned error:`, data.error);
        return NextResponse.json(
          { error: data.error.message || 'RPC error' },
          { status: 400 }
        );
      }
      
      // Success! Return the RPC response
      return NextResponse.json(data);

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        console.error(`[RPC Proxy] ${network} Alchemy request timed out after 30s`);
        return NextResponse.json(
          { error: 'RPC request timed out' },
          { status: 522 }
        );
      }
      
      console.error(`[RPC Proxy] ${network} Alchemy fetch error:`, fetchError);
      return NextResponse.json(
        { error: 'RPC request failed' },
        { status: 502 }
      );
    }

  } catch (error) {
    console.error('RPC proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
