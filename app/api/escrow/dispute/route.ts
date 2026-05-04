import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/auth-helpers';
import { getVerifiedWallet } from '@/lib/auth-helpers';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const callerWallet = await getVerifiedWallet(req);
    const { orderId } = await req.json();

    const { data: order } = await supabaseAdmin
      .from('escrow_orders')
      .select('buyer_wallet_address, status')
      .eq('id', orderId)
      .single();

    if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (order.buyer_wallet_address.toLowerCase() !== callerWallet) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    if (order.status !== 'code_revealed') return NextResponse.json({ error: 'You can only dispute after the code is revealed' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('escrow_orders')
      .update({ 
        status: 'disputed',
        disputed_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (error) throw error;

    try {
      await resend.emails.send({
        from: 'TrustLink System <noreply@trustlink.com.ng>',
        to: 'willstanelson@gmail.com', // Your admin email
        subject: `🚨 DISPUTE RAISED: Order ${orderId.substring(0, 8)}`,
        text: `A dispute has been raised on TrustLink.\n\nOrder ID: ${orderId}\nBuyer Wallet: ${callerWallet}\n\nPlease check the database immediately.`,
      });
    } catch (emailError) {
      console.error("Failed to send dispute email alert:", emailError);
    }

    return NextResponse.json({ success: true, message: 'Dispute raised. Admin has been notified.' });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}