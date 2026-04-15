# GBC — Дашборд заказов

Мини-дашборд: **RetailCRM → Supabase → Next.js (Vercel) + Telegram-бот**.

## Что внутри

```
gbc-dashboard/
├── app/                        # Next.js App Router (дашборд)
│   ├── page.tsx                #   SSR-страница, читает Supabase anon key
│   ├── charts.tsx              #   графики (Recharts, client component)
│   ├── layout.tsx
│   └── globals.css
├── lib/supabase.ts             # клиент Supabase для фронта
├── scripts/
│   ├── load-mock-orders.mjs    # шаг 1: заливка mock_orders.json в RetailCRM
│   ├── sync-to-supabase.mjs    # шаг 2: RetailCRM → Supabase (upsert)
│   └── telegram-bot.mjs        # шаг 4: уведомления о заказах ≥ 50 000 ₸
├── supabase/schema.sql         # таблица public.orders + RLS-политика
├── .env.example
└── package.json
```

## Архитектура

```
mock_orders.json ─▶ load-mock-orders.mjs ─▶ RetailCRM
                                                │
                                                ├─▶ sync-to-supabase.mjs ─▶ Supabase (public.orders)
                                                │                                   │
                                                │                                   ▼
                                                │                          Next.js / Vercel (ISR 60s)
                                                │
                                                └─▶ telegram-bot.mjs ──▶ Telegram (при totalSumm ≥ 50 000 ₸)
```

## Запуск локально

1. `cp .env.example .env` и заполнить переменные.
2. `npm install`
3. В Supabase SQL Editor запустить `supabase/schema.sql`.
4. `npm run load:retailcrm` — разовая заливка 50 тестовых заказов.
5. `npm run sync:supabase` — синхронизация RetailCRM → Supabase (cron/разово).
6. `npm run dev` — локальный дашборд на `http://localhost:3000`.
7. `npm run bot:telegram -- --from-now` — бот с baseline (не спамит старыми).

## Деплой

- **Supabase:** SQL из `supabase/schema.sql` (кнопка Run в SQL Editor).
- **Vercel:** `vercel --prod` или Import GitHub repo в UI. Обязательные env:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Sync-скрипт и бот:** запускаются отдельно (локально, cron, VPS или Vercel Cron + API routes).

## Что делает каждый шаг

### Шаг 1 — Заливка в RetailCRM

`scripts/load-mock-orders.mjs` читает `../mock_orders.json`, маппит на схему RetailCRM
(`orderType: main`, `orderMethod: shopping-cart`) и создаёт заказы через
`POST /api/v5/orders/create`. Пауза 250 мс между запросами — не упираемся в rate limit.

### Шаг 2 — RetailCRM → Supabase

`scripts/sync-to-supabase.mjs` постранично (`limit=100`) выгребает заказы из
`/api/v5/orders`, нормализует (customer_name, city, utm_source, суммы и т.д.) и
делает `upsert` в `public.orders` по `id`. Полное тело заказа сохраняется в `raw jsonb`.

### Шаг 3 — Дашборд

Next.js 14, App Router, SSR + ISR (`revalidate = 60`). Страница читает Supabase
через anon key (RLS разрешает только SELECT). Карточки: всего заказов, выручка,
средний чек, заказы ≥ 50 000 ₸. Графики Recharts: динамика по дням,
распределение по utm_source и по статусам. Таблица последних 20 заказов.

### Шаг 4 — Telegram-бот

`scripts/telegram-bot.mjs` — отдельный Node-процесс, опрашивает RetailCRM раз в
`POLL_INTERVAL_SECONDS`, ведёт state-файл `.bot-state.json` (`lastId`, `notified[]`)
и при `totalSumm ≥ 50 000 ₸` шлёт HTML-сообщение в Telegram.

Флаг `--from-now` на первом запуске выставляет baseline = max(id) — исторические
заказы не триггерят уведомления, только новые.

---

## Как делал: промпты и затыки

### Промпты Claude Code

Рабочий цикл вёлся в Claude Code, ключевые промпты (обобщённо):

1. «Прочти и выполни задание в файле "Задание — AI Tools Specialist.md"».
2. «Учётные данные: RetailCRM URL/ключ, Supabase URL/ключи, Telegram token/chat_id, GitHub repo».
3. «Готово» — после каждого ручного шага (создание таблицы в Supabase, Start у бота).

Плюс уточняющие вопросы Claude → мои ответы о стеке, про `gh auth`, про Recharts,
и про выбор между коллаборатором / форком для push.

### Затыки и как решил

- **Telegram `chat_id` ≠ id бота.** Пользователь сначала прислал `8732965693` — это id
  самого бота (часть перед `:` в токене). Решение: попросил нажать Start у
  `@boulat_bot`, отправил любое сообщение, и через `getUpdates` достал реальный
  `chat_id = 68127874`.

- **RetailCRM `orderType: eshop-individual` не существует** в демо-аккаунте. В
  `mock_orders.json` стоял именно такой код. Решение: перед загрузкой запросил
  `/api/v5/reference/order-types` — там только `main`, — и в лоадере принудительно
  маппил все заказы в `orderType: main`.

- **Нельзя выполнить DDL через Supabase REST API.** `service_role` ключ не даёт
  произвольный SQL. Решение: положил схему в `supabase/schema.sql` и попросил
  пользователя один раз нажать Run в SQL Editor.

- **Баг в фильтре polling-а бота.** Первый вариант `fetchRecentOrders(minId)` пытался
  добавить `filter[ids][]=` и RetailCRM отвечал 400. Решение: убрал фильтр,
  бот грузит последние 100 заказов и отсекает уже уведомлённые по state-файлу.

- **Background-процесс умирал при запуске через `&`.** При использовании
  `run_in_background: true` флаг `&` не нужен — процесс и так отвязан. Запускаю
  `node scripts/telegram-bot.mjs` без `&` — живёт.

- **Исторические 25 заказов ≥ 50 000 ₸.** Если просто запустить бота, он заспамил бы
  25 сообщений. Решение: флаг `--from-now` на первом запуске ставит baseline
  `lastId = max(id)`, после чего срабатывают только НОВЫЕ большие заказы. Отдельно
  отправил одно ручное сообщение для скриншота.

- **Push в организационный репо `it-analytics-kz`.** Локально `gh` логин под
  аккаунтом `bolat`, но в `it-analytics-kz/gbc-analytics-dashboard` нет write-прав.
  Решение — см. ниже.

## Сборка проверена

```
npx next build → 4/4 pages generated, size dashboard route ~188 kB first load JS
```

## Результаты

- Дашборд (Vercel): _после деплоя_.
- Telegram-скриншот: уведомление о заказе #105A (81 000 ₸) и #106A (85 000 ₸).
- Скрипты и README — в этом репозитории.
