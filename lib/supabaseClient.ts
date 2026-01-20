import { createClient } from '@supabase/supabase-js';

// REPLACE THESE WITH YOUR KEYS FROM THE SUPABASE DASHBOARD
const SUPABASE_URL = 'https://ffjfddskmqecbpfsfmih.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_c3JHy363SK7zK8-1lRsBFQ_UkZ47_es';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);