import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. The server makes the call, completely bypassing browser CORS rules
    const response = await fetch('https://api.paystack.co/bank?country=nigeria', {
      method: 'GET',
      headers: {
        // Even though the bank list is public, it's best practice to pass your secret key
        'Authorization': `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, 
        'Content-Type': 'application/json',
      },
      // 2. Cache this data for 24 hours (86400 seconds) so we don't spam Paystack
      next: { revalidate: 86400 } 
    });

    if (!response.ok) {
      throw new Error(`Paystack returned status: ${response.status}`);
    }

    const data = await response.json();
    
    // 3. Send the clean data to your frontend
    return NextResponse.json(data);
    
  } catch (error) {
    console.error("Bank fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch bank list" }, { status: 500 });
  }
}