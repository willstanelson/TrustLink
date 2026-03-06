import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const { buyer, seller } = await req.json();
        
        const updateStats = async (userId: string) => {
            if (!userId) return;
            const id = userId.toLowerCase();
            
            const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
            
            await supabase.from('profiles').upsert({
                id: id,
                total_orders: (data?.total_orders || 0) + 1,
                successful_orders: (data?.successful_orders || 0) + 1
            }, { onConflict: 'id' });
        };

        // Update both wallets simultaneously
        await Promise.all([updateStats(buyer), updateStats(seller)]);
        
        return NextResponse.json({ status: true, message: "Reputation updated" });
    } catch (error: any) {
        console.error("Reputation API Error:", error);
        return NextResponse.json({ status: false, message: error.message }, { status: 500 });
    }
}