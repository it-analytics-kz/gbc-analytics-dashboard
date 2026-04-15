import fs from 'node:fs/promises';
import path from 'node:path';

const API = process.env.RETAILCRM_URL;
const KEY = process.env.RETAILCRM_API_KEY;
const SITE = process.env.RETAILCRM_SITE;

if (!API || !KEY || !SITE) {
  console.error('Missing RETAILCRM_* env vars');
  process.exit(1);
}

const MOCK_PATH = path.resolve(process.cwd(), '..', 'mock_orders.json');
const mock = JSON.parse(await fs.readFile(MOCK_PATH, 'utf8'));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function createOrder(raw) {
  const order = {
    firstName: raw.firstName,
    lastName: raw.lastName,
    phone: raw.phone,
    email: raw.email,
    orderType: 'main',
    orderMethod: raw.orderMethod || 'shopping-cart',
    status: raw.status || 'new',
    customer: {
      firstName: raw.firstName,
      lastName: raw.lastName,
      phone: raw.phone,
      email: raw.email,
    },
    items: (raw.items || []).map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      initialPrice: i.initialPrice,
    })),
    delivery: raw.delivery,
    customFields: raw.customFields,
  };

  const body = new URLSearchParams({
    site: SITE,
    order: JSON.stringify(order),
  });

  const res = await fetch(`${API}/api/v5/orders/create?apiKey=${KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const json = await res.json();
  return json;
}

let ok = 0, fail = 0;
const failures = [];

for (let i = 0; i < mock.length; i++) {
  const raw = mock[i];
  try {
    const r = await createOrder(raw);
    if (r.success) {
      ok++;
      console.log(`[${i + 1}/${mock.length}] OK id=${r.id} ${raw.firstName} ${raw.lastName}`);
    } else {
      fail++;
      failures.push({ i, raw, r });
      console.log(`[${i + 1}/${mock.length}] FAIL`, JSON.stringify(r).slice(0, 300));
    }
  } catch (e) {
    fail++;
    failures.push({ i, raw, err: String(e) });
    console.log(`[${i + 1}/${mock.length}] ERR`, e.message);
  }
  await wait(250);
}

console.log(`\nDone. ok=${ok} fail=${fail}`);
if (failures.length) {
  await fs.writeFile('load-failures.json', JSON.stringify(failures, null, 2));
  console.log('Wrote load-failures.json');
}
