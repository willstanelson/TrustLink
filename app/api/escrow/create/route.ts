// app/api/escrow/create/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! 
);

const EscrowOrderSchema = z.object({
  buyer_wallet_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid buyer wallet address"),
  seller_address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Invalid seller wallet address"),
  buyer_email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  seller_email: z.union([z.string().email(), z.literal(""), z.null()]).optional(),
  amount: z.string().regex(/^\d+(\.\d+)?$/, "Amount must be a valid number").refine((val) => parseFloat(val) > 0, { message: "Amount must be greater than 0" }),
  token_symbol: z.string().min(1, "Token symbol is required"),
  network: z.string().min(1, "Network is required"),
  status: z.literal('secured').default('secured'),
});

export async function POST(req: Request) {
  try {
    const rawPayload = await req.json();
    const validatedData = EscrowOrderSchema.parse(rawPayload);

    const { data, error } = await supabaseAdmin
      .from('escrow_orders')
      .insert([validatedData])
      .select('id')
      .single();

    if (error) {
      console.error("Supabase Admin Insert Error:", error);
      return NextResponse.json({ status: 'error', message: 'Failed to create escrow record' }, { status: 500 });
    }

    return NextResponse.json({ status: 'success', message: 'Escrow order created successfully', id: data?.id });

  } catch (error: any) {
    console.error("API Error:", error);
    if (error.name === 'ZodError') return NextResponse.json({ status: 'error', message: 'Invalid input data', errors: error.errors }, { status: 400 });
    return NextResponse.json({ status: 'error', message: error.message || 'Internal server error' }, { status: 500 });
  }
}