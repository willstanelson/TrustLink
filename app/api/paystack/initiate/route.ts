import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase (Admin Context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { amount, email, seller_bank, seller_number, seller_name, description } = body;

    if (!amount || !email) {
      return NextResponse.json({ status: false, message: 'Missing amount or email' }, { status: 400 });
    }

    const amountInKobo = parseFloat(amount) * 100;

    // 1. Initialize Paystack Transaction
    const res = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountInKobo,
        currency: 'NGN',
        channels: ['card', 'bank', 'ussd', 'bank_transfer'],
        metadata: {
            custom_fields: [
                { display_name: "Seller Bank", variable_name: "seller_bank", value: seller_bank },
                { display_name: "Seller Account", variable_name: "seller_account", value: seller_number },
                { display_name: "Seller Name", variable_name: "seller_name", value: seller_name },
                { display_name: "Description", variable_name: "description", value: description }
            ]
        },
        callback_url: "https://trust-link-sooty.vercel.app/"
      }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.message || "Paystack initialization failed");
    }

    // 2. SAVE TO SUPABASE (The Memory)
    // FIX: We generate a unique 'id' using Date.now() so the DB is happy.
    // FIX: We provide a placeholder 'seller_address' because that column is required.
    const { error: dbError } = await supabase
        .from('escrow_orders')
        .insert([
            {
                id: Date.now(), // <--- GENIUS FIX: Unique ID based on timestamp
                seller_address: "0xFIAT0000000000000000000000000000000000", // <--- Placeholder to satisfy DB
                buyer_email: email,
                seller_name: seller_name,
                seller_bank_details: `${seller_bank} - ${seller_number}`,
                amount: parseFloat(amount),
                currency: 'NGN',
                status: 'PENDING',
                description: description,
                paystack_ref: data.data.reference
            }
        ]);

    if (dbError) {
        // Log the full error to Vercel so we can see it if it fails again
        console.error("Database Save Failed Details:", JSON.stringify(dbError, null, 2));
    }

    return NextResponse.json(data);

  } catch (error: any) {
    console.error("[Payment Init Error]", error);
    return NextResponse.json({ status: false, message: error.message }, { status: 500 });
  }
}