import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anon, {
  auth: { persistSession: false },
});

export type OrderRow = {
  id: number;
  number: string | null;
  status: string | null;
  status_group: string | null;
  order_method: string | null;
  customer_name: string | null;
  city: string | null;
  utm_source: string | null;
  total_summ: number | null;
  items_count: number | null;
  created_at: string | null;
};
