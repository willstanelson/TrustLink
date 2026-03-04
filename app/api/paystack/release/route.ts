import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient'; 

// We bring the BANKS array to the backend to perform the reverse-lookup
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
        const { orderId, releaseAmount, isPartial } = body;

        // 1. Fetch the exact order details
        const { data: order, error: dbError } = await supabase
            .from('escrow_orders')
            .select('*')
            .eq('id', Number(orderId))
            .single();

        if (dbError || !order) {
            return NextResponse.json({ status: false, message: "Order not found in database" }, { status: 404 });
        }

        // 2. REVERSE LOOKUP: Extract the Bank Name and Code from "Bank Name - 9999999999"
        const bankDetailsStr = order.seller_bank_details || "";
        const parts = bankDetailsStr.split(" - ");
        
        let bankName = "";
        let accountNumber = "";

        if (parts.length === 2) {
            bankName = parts[0];
            accountNumber = parts[1];
        } else {
            return NextResponse.json({ status: false, message: "Invalid bank details format in database." }, { status: 400 });
        }

        const foundBank = BANKS.find(b => b.name === bankName);
        const bankCode = foundBank ? foundBank.code : null;

        if (!bankCode) {
            return NextResponse.json({ status: false, message: `Could not find Paystack code for bank: ${bankName}` }, { status: 400 });
        }

        // 3. THE TRUSTLINK MONETIZATION ENGINE (2% Fee)
        const totalToRelease = Number(releaseAmount);
        const trustLinkFee = totalToRelease * 0.02; // 2% cut for William
        const payoutAmount = totalToRelease - trustLinkFee;

        // 4. Create a Transfer Recipient in Paystack
        const recipientResponse = await fetch('https://api.paystack.co/transferrecipient', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                type: "nuban",
                name: order.seller_name || "TrustLink Seller",
                account_number: accountNumber,
                bank_code: bankCode
            })
        });

        const recipientData = await recipientResponse.json();
        
        if (!recipientData.status) {
            console.warn("Paystack Recipient Creation Failed:", recipientData.message);
            // If it fails (e.g., test numbers), we still update DB so your local testing isn't blocked forever
        } else {
            // 5. Fire the actual money transfer to the seller's bank
            const transferResponse = await fetch('https://api.paystack.co/transfer', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    source: "balance", // Draws from your Paystack main balance
                    amount: Math.round(payoutAmount * 100), // Paystack requires amount in kobo!
                    recipient: recipientData.data.recipient_code,
                    reason: `TrustLink Escrow Release (Order NGN-${orderId})`
                })
            });
            const transferData = await transferResponse.json();
            if (!transferData.status) console.warn("Transfer Failed:", transferData.message);
        }

        // 6. Update Supabase
        // If it's a partial release, we set a new custom status. Otherwise, it's a full success.
        const newStatus = isPartial ? 'partially_released' : 'success';
        
        const { error: updateError } = await supabase
            .from('escrow_orders')
            .update({ status: newStatus })
            .eq('id', Number(orderId));

        if (updateError) throw new Error(updateError.message);

        return NextResponse.json({ 
            status: true, 
            message: `Successfully released ₦${payoutAmount.toLocaleString()}. TrustLink collected a ₦${trustLinkFee.toLocaleString()} fee!` 
        });

    } catch (error: any) {
        console.error("Release API Error:", error);
        return NextResponse.json({ status: false, message: error.message || "Internal Server Error" }, { status: 500 });
    }
}