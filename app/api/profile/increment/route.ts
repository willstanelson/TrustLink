import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabaseClient';

export async function POST(req: Request) {
    try {
        const { buyer, seller } = await req.json();
        
        const updateStats = async (userId: string) => {
            if (!userId) return;
            const id = userId.toLowerCase();
            
            const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
            
            if (data) {
                // Safely update ONLY the math, leave the name/avatar alone
                await supabase.from('profiles').update({
                    total_orders: (data.total_orders || 0) + 1,
                    successful_orders: (data.successful_orders || 0) + 1
                }).eq('id', id);
            } else {
                // If they have no profile yet, create a fresh one
                await supabase.from('profiles').insert({ id: id, total_orders: 1, successful_orders: 1 });
            }
        };

        await Promise.all([updateStats(buyer), updateStats(seller)]);
        return NextResponse.json({ status: true, message: "Reputation updated" });
    } catch (error: any) {
        return NextResponse.json({ status: false, message: error.message }, { status: 500 });
    }
}