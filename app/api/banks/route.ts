import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Fetching the public endpoint without the Authorization header
    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Cache this data for 24 hours (86400 seconds) 
      next: { revalidate: 86400 } 
    });

    if (!response.ok) {
      throw new Error(`Paystack returned status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Bank fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch bank list", detail: String(error) }, 
      { status: 500 }
    );
  }
}