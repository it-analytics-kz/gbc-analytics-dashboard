import { supabase, type OrderRow } from '@/lib/supabase';
import Charts from './charts';

export const revalidate = 60;

function fmtKZT(n: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n)) + ' ₸';
}

export default async function Page() {
  const { data, error } = await supabase
    .from('orders')
    .select('id,number,status,status_group,order_method,customer_name,city,utm_source,total_summ,items_count,created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return (
      <main>
        <h1>Дашборд заказов</h1>
        <p style={{ color: 'crimson' }}>Ошибка Supabase: {error.message}</p>
      </main>
    );
  }

  const orders = (data ?? []) as OrderRow[];
  const total = orders.length;
  const revenue = orders.reduce((s, o) => s + Number(o.total_summ ?? 0), 0);
  const avg = total ? revenue / total : 0;
  const bigOrders = orders.filter((o) => Number(o.total_summ ?? 0) >= 50000).length;

  const byDayMap = new Map<string, { date: string; count: number; revenue: number }>();
  for (const o of orders) {
    if (!o.created_at) continue;
    const d = o.created_at.slice(0, 10);
    const cur = byDayMap.get(d) ?? { date: d, count: 0, revenue: 0 };
    cur.count += 1;
    cur.revenue += Number(o.total_summ ?? 0);
    byDayMap.set(d, cur);
  }
  const byDay = [...byDayMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  const utmMap = new Map<string, number>();
  for (const o of orders) {
    const k = o.utm_source || 'не указан';
    utmMap.set(k, (utmMap.get(k) ?? 0) + 1);
  }
  const utm = [...utmMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const statusMap = new Map<string, number>();
  for (const o of orders) {
    const k = o.status ?? 'unknown';
    statusMap.set(k, (statusMap.get(k) ?? 0) + 1);
  }
  const statuses = [...statusMap.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return (
    <main>
      <h1>GBC — Дашборд заказов</h1>
      <p className="subtitle">
        Источник: RetailCRM → Supabase. Данные обновляются фоновым sync-скриптом и кешируются на 60 секунд.
      </p>

      <section className="cards">
        <div className="card">
          <div className="label">Всего заказов</div>
          <div className="value">{total}</div>
        </div>
        <div className="card">
          <div className="label">Выручка</div>
          <div className="value">{fmtKZT(revenue)}</div>
        </div>
        <div className="card">
          <div className="label">Средний чек</div>
          <div className="value">{fmtKZT(avg)}</div>
        </div>
        <div className="card">
          <div className="label">Заказов &ge; 50 000 ₸</div>
          <div className="value">{bigOrders}</div>
          <div className="sub">триггер Telegram-бота</div>
        </div>
      </section>

      <Charts byDay={byDay} utm={utm} statuses={statuses} />

      <section className="table-block">
        <h2>Последние 20 заказов</h2>
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Дата</th>
              <th>Клиент</th>
              <th>Город</th>
              <th>UTM</th>
              <th>Статус</th>
              <th style={{ textAlign: 'right' }}>Сумма</th>
            </tr>
          </thead>
          <tbody>
            {orders.slice(0, 20).map((o) => (
              <tr key={o.id}>
                <td>{o.number ?? o.id}</td>
                <td>{o.created_at ? o.created_at.slice(0, 16).replace('T', ' ') : '—'}</td>
                <td>{o.customer_name ?? '—'}</td>
                <td>{o.city ?? '—'}</td>
                <td>{o.utm_source ?? '—'}</td>
                <td><span className="pill">{o.status ?? '—'}</span></td>
                <td style={{ textAlign: 'right' }}>{fmtKZT(Number(o.total_summ ?? 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <p className="refresh-note">ISR revalidate = 60s. Обновите страницу, чтобы получить свежие данные.</p>
    </main>
  );
}
