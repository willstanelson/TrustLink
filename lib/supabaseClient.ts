import { createClient } from '@supabase/supabase-js';

// REPLACE THESE WITH YOUR KEYS FROM THE SUPABASE DASHBOARD
const SUPABASE_URL = 'https://ffjfddskmqecbpfsfmih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_zQKnChd7pqmvSvdcSe0WSw_nkXh5_zN';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
