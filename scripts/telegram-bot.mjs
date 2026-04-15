import fs from 'node:fs/promises';
import path from 'node:path';

const {
  RETAILCRM_URL,
  RETAILCRM_API_KEY,
  TELEGRAM_BOT_TOKEN,
  TELEGRAM_CHAT_ID,
  TELEGRAM_ORDER_THRESHOLD = '50000',
  POLL_INTERVAL_SECONDS = '60',
} = process.env;

if (!RETAILCRM_URL || !RETAILCRM_API_KEY || !TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
  console.error('Missing required env vars');
  process.exit(1);
}

const THRESHOLD = Number(TELEGRAM_ORDER_THRESHOLD);
const INTERVAL = Number(POLL_INTERVAL_SECONDS) * 1000;
const STATE_FILE = path.resolve(process.cwd(), '.bot-state.json');

async function loadState() {
  try {
    return JSON.parse(await fs.readFile(STATE_FILE, 'utf8'));
  } catch {
    return { lastId: 0, notified: [] };
  }
}
async function saveState(s) {
  await fs.writeFile(STATE_FILE, JSON.stringify(s, null, 2));
}

async function fetchRecentOrders() {
  const url = new URL(`${RETAILCRM_URL}/api/v5/orders`);
  url.searchParams.set('apiKey', RETAILCRM_API_KEY);
  url.searchParams.set('limit', '100');
  const res = await fetch(url);
  const j = await res.json();
  if (!j.success) throw new Error('RetailCRM: ' + JSON.stringify(j));
  return j.orders || [];
}

async function sendTelegram(text) {
  const res = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  const j = await res.json();
  if (!j.ok) console.error('Telegram error:', j);
  return j.ok;
}

function fmt(n) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function formatMessage(o) {
  const items = Array.isArray(o.items) ? o.items : [];
  const itemsList = items
    .map((i) => `• ${i.offer?.displayName || i.offer?.name || 'товар'} × ${i.quantity}`)
    .join('\n');
  const url = `${RETAILCRM_URL}/orders/${o.id}/edit`;
  return [
    `🔔 <b>Крупный заказ ≥ ${fmt(THRESHOLD)} ₸</b>`,
    ``,
    `<b>№${o.number || o.id}</b> — ${fmt(o.totalSumm || o.summ || 0)} ₸`,
    `Клиент: ${o.firstName || ''} ${o.lastName || ''}`.trim(),
    o.phone ? `Телефон: ${o.phone}` : null,
    o.delivery?.address?.city ? `Город: ${o.delivery.address.city}` : null,
    ``,
    itemsList || null,
    ``,
    `<a href="${url}">Открыть в RetailCRM</a>`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function tick(state) {
  const orders = await fetchRecentOrders();
  let newMax = state.lastId;
  let sent = 0;

  const sorted = orders.sort((a, b) => a.id - b.id);
  for (const o of sorted) {
    if (o.id > newMax) newMax = o.id;
    if (o.id <= state.lastId) continue;
    const sum = Number(o.totalSumm ?? o.summ ?? 0);
    if (sum < THRESHOLD) continue;
    if (state.notified.includes(o.id)) continue;

    const ok = await sendTelegram(formatMessage(o));
    if (ok) {
      state.notified.push(o.id);
      sent++;
      console.log(`[${new Date().toISOString()}] Sent notification for order #${o.number || o.id} (${sum} ₸)`);
    }
  }

  state.lastId = newMax;
  if (state.notified.length > 500) state.notified = state.notified.slice(-500);
  await saveState(state);
  if (sent === 0) {
    console.log(`[${new Date().toISOString()}] polled ${orders.length} orders, no new big orders (lastId=${state.lastId})`);
  }
}

async function main() {
  const state = await loadState();
  if (state.lastId === 0 && process.argv.includes('--from-now')) {
    const orders = await fetchRecentOrders();
    state.lastId = Math.max(0, ...orders.map((o) => o.id));
    await saveState(state);
    console.log(`Initialized baseline lastId=${state.lastId} (notifications only for newer orders)`);
  }

  console.log(
    `Bot started. Threshold=${THRESHOLD} ₸, interval=${INTERVAL / 1000}s, chat=${TELEGRAM_CHAT_ID}, lastId=${state.lastId}`,
  );

  // One immediate run, then interval
  await tick(state);
  if (process.argv.includes('--once')) return;
  setInterval(() => tick(state).catch((e) => console.error(e)), INTERVAL);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
