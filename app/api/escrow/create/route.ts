// app/api/escrow/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

// Initialize Supabase Admin client (Service Role Key)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

// Define strict schema for validation
const EscrowOrderSchema = z.object({
  buyer_wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid buyer wallet address"),
  seller_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid seller wallet address"),
  
  // 🚀 THE FIX: Allows valid emails, null, undefined, OR empty strings ""
  buyer_email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  seller_email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  
  // 🚀 THE FIX: Validates it's a number AND greater than 0 right inside Zod
  amount: z.string()
    .regex(/^\d+(\.\d+)?$/, "Amount must be a valid number")
    .refine((val) => parseFloat(val) > 0, { message: "Amount must be greater than 0" }),
    
  // 🚀 THE FIX: Allows dynamic tokens (like tBNB, XPL, POL) while ensuring it's not blank
  token_symbol: z.string().min(1, "Token symbol is required"),
  
  network: z.string().min(1, "Network is required"),
  status: z.literal('secured').default('secured'),
});

export async function POST(req: Request) {
  try {
    const rawPayload = await req.json();

    // 1. Validate input (Zod will automatically throw an error if it fails)
    const validatedData = EscrowOrderSchema.parse(rawPayload);

    // 2. Insert using service role (bypasses RLS)
    const { data, error } = await supabaseAdmin
      .from('escrow_orders')
      .insert([validatedData])
      .select('id')
      .single();

    if (error) {
      console.error("Supabase Admin Insert Error:", error);
      return NextResponse.json(
        { status: 'error', message: 'Failed to create escrow record' }, 
        { status: 500 }
      );
    }

    return NextResponse.json({ 
      status: 'success', 
      message: 'Escrow order created successfully',
      id: data?.id 
    });

  } catch (error: any) {
    console.error("API Error:", error);

    // Catch Zod validation errors and send them back to the frontend
    if (error.name === 'ZodError') {
      return NextResponse.json({
        status: 'error',
        message: 'Invalid input data',
        errors: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      status: 'error',
      message: error.message || 'Internal server error'
    }, { status: 500 });
  }
}