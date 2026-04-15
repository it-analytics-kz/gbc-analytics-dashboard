'use client';

import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type ByDay = { date: string; count: number; revenue: number };
type NameCount = { name: string; count: number };

const COLOR_PRIMARY = '#4f46e5';
const COLOR_SECONDARY = '#10b981';

export default function Charts({
  byDay, utm, statuses,
}: { byDay: ByDay[]; utm: NameCount[]; statuses: NameCount[] }) {
  return (
    <>
      <section className="chart-block">
        <h2>Заказы по дням</h2>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <LineChart data={byDay} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis yAxisId="l" fontSize={12} />
              <YAxis yAxisId="r" orientation="right" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line yAxisId="l" type="monotone" dataKey="count" name="Заказы" stroke={COLOR_PRIMARY} strokeWidth={2} dot={false} />
              <Line yAxisId="r" type="monotone" dataKey="revenue" name="Выручка (₸)" stroke={COLOR_SECONDARY} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-block">
        <h2>Заказы по источникам (utm_source)</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={utm} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Bar dataKey="count" name="Заказы" fill={COLOR_PRIMARY} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="chart-block">
        <h2>Распределение по статусам</h2>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <BarChart data={statuses} layout="vertical" margin={{ top: 8, right: 16, left: 80, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef0f3" />
              <XAxis type="number" fontSize={12} />
              <YAxis type="category" dataKey="name" fontSize={12} width={160} />
              <Tooltip />
              <Bar dataKey="count" name="Заказы" fill={COLOR_SECONDARY} radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
