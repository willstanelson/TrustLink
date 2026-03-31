import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ✅ Service role key — safe in backend routes, bypasses RLS
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BANKS = [
    { code: '120001', name: '9mobile 9Payment Service Bank' },
    { code: '801', name: 'Abbey Mortgage Bank' },
    { code: '51204', name: 'Above Only MFB' },
    { code: '51312', name: 'Abulesoro MFB' },
    { code: '044', name: 'Access Bank' },
    { code: '063', name: 'Access Bank (Diamond)' },
    { code: '120004', name: 'Airtel Smartcash PSB' },
    { code: '035A', name: 'ALAT by WEMA' },
    { code: '50926', name: 'Amju Unique MFB' },
    { code: '50083', name: 'Aramoko MFB' },
    { code: '401', name: 'ASO Savings and Loans' },
    { code: 'MFB50094', name: 'Astrapolaris MFB LTD' },
    { code: '51229', name: 'Bainescredit MFB' },
    { code: '50931', name: 'Bowen Microfinance Bank' },
    { code: '565', name: 'Carbon' },
    { code: '50823', name: 'CEMCS Microfinance Bank' },
    { code: '50171', name: 'Chanelle Microfinance Bank Limited' },
    { code: '023', name: 'Citibank Nigeria' },
    { code: '50204', name: 'Corestep MFB' },
    { code: '559', name: 'Coronation Merchant Bank' },
    { code: '51297', name: 'Crescent MFB' },
    { code: '050', name: 'Ecobank Nigeria' },
    { code: '50263', name: 'Ekimogun MFB' },
    { code: '562', name: 'Ekondo Microfinance Bank' },
    { code: '50126', name: 'Eyowo' },
    { code: '070', name: 'Fidelity Bank' },
    { code: '51314', name: 'Firmus MFB' },
    { code: '011', name: 'First Bank of Nigeria' },
    { code: '214', name: 'First City Monument Bank' },
    { code: '501', name: 'FSDH Merchant Bank Limited' },
    { code: '812', name: 'Gateway Mortgage Bank LTD' },
    { code: '00103', name: 'Globus Bank' },
    { code: '100022', name: 'GoMoney' },
    { code: '058', name: 'Guaranty Trust Bank' },
    { code: '51251', name: 'Hackman Microfinance Bank' },
    { code: '50383', name: 'Hasal Microfinance Bank' },
    { code: '030', name: 'Heritage Bank' },
    { code: '120002', name: 'HopePSB' },
    { code: '51244', name: 'Ibile Microfinance Bank' },
    { code: '50439', name: 'Ikoyi Osun MFB' },
    { code: '50457', name: 'Infinity MFB' },
    { code: '301', name: 'Jaiz Bank' },
    { code: '50502', name: 'Kadpoly MFB' },
    { code: '082', name: 'Keystone Bank' },
    { code: '50200', name: 'Kredi Money MFB LTD' },
    { code: '50211', name: 'Kuda Bank' },
    { code: '90052', name: 'Lagos Building Investment Company Plc.' },
    { code: '50549', name: 'Links MFB' },
    { code: '031', name: 'Living Trust Mortgage Bank' },
    { code: '303', name: 'Lotus Bank' },
    { code: '50563', name: 'Mayfair MFB' },
    { code: '50304', name: 'Mint MFB' },
    { code: '120003', name: 'MTN Momo PSB' },
    { code: '100002', name: 'Paga' },
    { code: '999991', name: 'PalmPay' },
    { code: '104', name: 'Parallex Bank' },
    { code: '311', name: 'Parkway - ReadyCash' },
    { code: '999992', name: 'Opay (Paycom)' },
    { code: '50746', name: 'Petra Mircofinance Bank Plc' },
    { code: '076', name: 'Polaris Bank' },
    { code: '50864', name: 'Polyunwana MFB' },
    { code: '105', name: 'PremiumTrust Bank' },
    { code: '101', name: 'Providus Bank' },
    { code: '51293', name: 'QuickFund MFB' },
    { code: '502', name: 'Rand Merchant Bank' },
    { code: '90067', name: 'Refuge Mortgage Bank' },
    { code: '125', name: 'Rubies MFB' },
    { code: '51113', name: 'Safe Haven MFB' },
    { code: '50800', name: 'Solid Rock MFB' },
    { code: '51310', name: 'Sparkle Microfinance Bank' },
    { code: '221', name: 'Stanbic IBTC Bank' },
    { code: '068', name: 'Standard Chartered Bank' },
    { code: '51253', name: 'Stellas MFB' },
    { code: '232', name: 'Sterling Bank' },
    { code: '100', name: 'Suntrust Bank' },
    { code: '302', name: 'TAJ Bank' },
    { code: '51269', name: 'Tangerine Money' },
    { code: '51211', name: 'TCF MFB' },
    { code: '102', name: 'Titan Bank' },
    { code: '100039', name: 'Titan Paystack' },
    { code: '50871', name: 'Unical MFB' },
    { code: '032', name: 'Union Bank of Nigeria' },
    { code: '033', name: 'United Bank For Africa' },
    { code: '215', name: 'Unity Bank' },
    { code: '566', name: 'VFD Microfinance Bank Limited' },
    { code: '035', name: 'Wema Bank' },
    { code: '057', name: 'Zenith Bank' }
];

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { orderId, releaseAmount } = body;

        // --- Input validation ---
        if (!orderId || !releaseAmount || isNaN(Number(releaseAmount)) || Number(releaseAmount) <= 0) {
            return NextResponse.json({ status: false, message: "Invalid request parameters." }, { status: 400 });
        }

        // 1. Fetch the order
        const { data: order, error: dbError } = await supabase
            .from('escrow_orders')
            .select('*')
            .eq('id', Number(orderId))
            .single();

        if (dbError || !order) {
            return NextResponse.json({ status: false, message: "Order not found in database." }, { status: 404 });
        }

        // 2. Idempotency check — prevent releases on completed orders
        if (order.status.toUpperCase() === 'SUCCESS') {
            return NextResponse.json({ status: false, message: "This order has already been fully released." }, { status: 400 });
        }

        if (order.release_in_progress) {
            return NextResponse.json({ status: false, message: "A release is already in progress for this order. Please wait." }, { status: 409 });
        }

        // 3. Lock the order AND save pending_release_amount in one atomic update
        // This is critical — the webhook needs pending_release_amount to roll back correctly on failure
        const totalToRelease = Number(releaseAmount);

        const { error: lockError } = await supabase
            .from('escrow_orders')
            .update({
                release_in_progress: true,
                pending_release_amount: totalToRelease  // ✅ Saved here so webhook can roll back
            })
            .eq('id', Number(orderId))
            .eq('release_in_progress', false); // Only lock if not already locked (prevents race condition)

        if (lockError) {
            return NextResponse.json({ status: false, message: "Could not acquire release lock. Please try again." }, { status: 409 });
        }

        // Helper to release the lock on any error path
        const releaseLock = async () => {
            await supabase
                .from('escrow_orders')
                .update({ release_in_progress: false, pending_release_amount: 0 })
                .eq('id', Number(orderId));
        };

        // 4. Parse and validate bank details
        const bankDetailsStr = order.seller_bank_details || "";
        const parts = bankDetailsStr.split(" - ");

        if (parts.length !== 2) {
            await releaseLock();
            return NextResponse.json({ status: false, message: "Invalid bank details format in database." }, { status: 400 });
        }

        const [bankName, accountNumber] = parts;
        const foundBank = BANKS.find(b => b.name === bankName);

        if (!foundBank) {
            await releaseLock();
            return NextResponse.json({ status: false, message: `Could not find Paystack code for bank: ${bankName}` }, { status: 400 });
        }

        // 5. Amount calculations
        const totalAmount = Number(order.amount);
        const previouslyReleased = Number(order.released_amount || 0);
        const remainingBalance = totalAmount - previouslyReleased;

        if (totalToRelease > remainingBalance) {
            await releaseLock();
            return NextResponse.json({
                status: false,
                message: `Cannot release more than the remaining balance (₦${remainingBalance.toLocaleString()}).`
            }, { status: 400 });
        }

        const trustLinkFee = totalToRelease * 0.02;
        const payoutAmount = totalToRelease - trustLinkFee;

        // 6. Create Paystack Transfer Recipient
        const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: "nuban",
                name: order.seller_name,
                account_number: accountNumber,
                bank_code: foundBank.code
            })
        });

        const recipientData = await recipientResponse.json();

        if (!recipientData.status) {
            await releaseLock();
            return NextResponse.json({
                status: false,
                message: `Failed to create transfer recipient: ${recipientData.message}`
            }, { status: 400 });
        }

        // 7. Initiate the transfer
        const transferResponse = await fetch('https://api.paystack.co/transfer', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                source: "balance",
                amount: Math.round(payoutAmount * 100), // Paystack expects kobo
                recipient: recipientData.data.recipient_code,
                reason: `TrustLink Escrow Release (Order NGN-${orderId})`
            })
        });

        const transferData = await transferResponse.json();

        // 8. Handle Paystack response
        // 'pending' is valid — means OTP confirmation required for large transfers
        const transferSucceeded = transferData.status &&
            (transferData.data?.status === 'success' || transferData.data?.status === 'pending');

        if (!transferSucceeded) {
            await releaseLock();
            return NextResponse.json({
                status: false,
                message: `Transfer failed: ${transferData.message || 'Unknown Paystack error'}`
            }, { status: 400 });
        }

        // 9. Update Supabase ONLY after confirmed transfer success/pending
        const newReleasedAmount = previouslyReleased + totalToRelease;
        const newStatus = newReleasedAmount >= totalAmount ? 'success' : 'partially_released';

        const { error: updateError } = await supabase
            .from('escrow_orders')
            .update({
                status: newStatus,
                released_amount: newReleasedAmount,
                release_in_progress: false    // Unlock
                // ✅ FIXED: We leave pending_release_amount untouched here for the webhook to clear!
            })
            .eq('id', Number(orderId));

        if (updateError) {
            // Transfer went through but DB failed — this needs immediate human attention
            console.error("CRITICAL: Transfer succeeded but DB update failed for order", orderId, updateError);
            return NextResponse.json({
                status: false,
                message: "Transfer was sent but we failed to update the order record. Please contact support immediately."
            }, { status: 500 });
        }

        // 10. Reputation Engine — only on full completion
        if (newStatus === 'success') {
            const updateProfile = async (email: string) => {
                if (!email) return;
                const id = email.toLowerCase();
                const { data } = await supabase.from('profiles').select('*').eq('id', id).single();

                if (data) {
                    await supabase.from('profiles').update({
                        total_orders: (data.total_orders || 0) + 1,
                        successful_orders: (data.successful_orders || 0) + 1
                    }).eq('id', id);
                } else {
                    await supabase.from('profiles').insert({ id, total_orders: 1, successful_orders: 1 });
                }
            };

            // Run both updates in parallel for speed
            await Promise.all([
                updateProfile(order.buyer_email),
                updateProfile(order.seller_email)
            ]);
        }

        return NextResponse.json({
            status: true,
            message: `Successfully released ₦${payoutAmount.toLocaleString()}. TrustLink fee: ₦${trustLinkFee.toLocaleString()}.`,
            transferStatus: transferData.data?.status // 'success' or 'pending'
        });

    } catch (error: any) {
        console.error("Release API Error:", error);
        return NextResponse.json({ status: false, message: error.message || "Internal Server Error" }, { status: 500 });
    }
}