import { createClient } from '@supabase/supabase-js';

const {
  RETAILCRM_URL,
  RETAILCRM_API_KEY,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
} = process.env;

if (!RETAILCRM_URL || !RETAILCRM_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars. Check .env');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function fetchOrdersPage(page) {
  const url = new URL(`${RETAILCRM_URL}/api/v5/orders`);
  url.searchParams.set('apiKey', RETAILCRM_API_KEY);
  url.searchParams.set('limit', '100');
  url.searchParams.set('page', String(page));
  const res = await fetch(url);
  if (!res.ok) throw new Error(`RetailCRM ${res.status}`);
  return res.json();
}

function mapOrder(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  return {
    id: o.id,
    number: o.number ?? null,
    status: o.status ?? null,
    status_group: o.statusGroup ?? null,
    order_type: o.orderType ?? null,
    order_method: o.orderMethod ?? null,
    site: o.site ?? null,
    customer_name: [o.firstName, o.lastName].filter(Boolean).join(' ') || null,
    phone: o.phone ?? null,
    email: o.email ?? null,
    city: o.delivery?.address?.city ?? null,
    utm_source:
      (Array.isArray(o.customFields)
        ? o.customFields.find((c) => c.code === 'utm_source')?.value
        : o.customFields?.utm_source) ?? null,
    total_summ: o.totalSumm ?? o.summ ?? 0,
    items_count: items.reduce((s, i) => s + (i.quantity || 0), 0),
    created_at: o.createdAt ? new Date(o.createdAt.replace(' ', 'T')).toISOString() : null,
    updated_at: o.statusUpdatedAt
      ? new Date(o.statusUpdatedAt.replace(' ', 'T')).toISOString()
      : null,
    raw: o,
    synced_at: new Date().toISOString(),
  };
}

async function main() {
  let page = 1;
  let all = [];
  while (true) {
    const j = await fetchOrdersPage(page);
    if (!j.success) throw new Error('RetailCRM error: ' + JSON.stringify(j));
    all = all.concat(j.orders || []);
    const total = j.pagination?.totalPageCount || 1;
    console.log(`Fetched page ${page}/${total} (${j.orders?.length || 0} orders)`);
    if (page >= total) break;
    page++;
  }
  console.log(`Total orders from RetailCRM: ${all.length}`);

  const rows = all.map(mapOrder);
  const chunk = 100;
  for (let i = 0; i < rows.length; i += chunk) {
    const slice = rows.slice(i, i + chunk);
    const { error } = await sb.from('orders').upsert(slice, { onConflict: 'id' });
    if (error) {
      console.error('Upsert error:', error);
      process.exit(1);
    }
    console.log(`Upserted ${Math.min(i + chunk, rows.length)}/${rows.length}`);
  }
  console.log('Sync complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
