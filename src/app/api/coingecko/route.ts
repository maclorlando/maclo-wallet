import { NextRequest, NextResponse } from 'next/server';

const COINGECKO_BASE_URL = 'https://api.coingecko.com/api/v3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');
    const apiKey = process.env.NEXT_PUBLIC_COINGECKO_API_KEY;

    if (!endpoint) {
      return NextResponse.json({ error: 'Endpoint parameter is required' }, { status: 400 });
    }

    // Build the full URL
    const url = `${COINGECKO_BASE_URL}${endpoint}`;
    
    // Add API key if available
    const finalUrl = apiKey ? `${url}${url.includes('?') ? '&' : '?'}x_cg_demo_api_key=${apiKey}` : url;

    // Make the request to CoinGecko
    const response = await fetch(finalUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MacloWallet/1.0',
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('CoinGecko API error:', response.status, errorText);
      
      // Return appropriate error response
      if (response.status === 429) {
        return NextResponse.json({ 
          error: 'Rate limit exceeded', 
          retryAfter: response.headers.get('Retry-After') 
        }, { status: 429 });
      }
      
      return NextResponse.json({ 
        error: 'Failed to fetch data from CoinGecko',
        status: response.status 
      }, { status: response.status });
    }

    const data = await response.json();
    
    // Add CORS headers
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    responseHeaders.set('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes

    return NextResponse.json(data, { headers: responseHeaders });

  } catch (error) {
    console.error('Proxy error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  // Handle preflight requests
  const responseHeaders = new Headers();
  responseHeaders.set('Access-Control-Allow-Origin', '*');
  responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  return new NextResponse(null, { headers: responseHeaders });
}
