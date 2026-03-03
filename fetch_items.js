import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://mgylypvmgjebvpxhlmly.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_RG-4on-iquEBjcvHD-ZAMw_SqZTkHTS';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { data, error } = await supabase.from('market_items').select('name, price');
    if (error) return console.error(error);

    const withQty = data.filter(d => /\[\s*\d+\s*pcs|x\s*\d+|\d+\s*x/i.test(d.name));
    console.log('Items with quantity:', withQty.length, 'out of', data.length);
    console.log(withQty.slice(0, 10));
}
check();
