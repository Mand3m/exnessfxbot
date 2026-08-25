# Forex Trading Consultants

Independent forex-signal desk inspired by the Foresignal layout: live pair cards, monthly pip table, position-size calculator, and a private admin page to publish ideas.

**Not affiliated with Exness Ltd or any broker.** The name is yours; do not imply an official Exness product.

## Run locally

```bash
cd C:\Users\GEORGE\exnessfxbot
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- Signals: `/`
- Results: `/results`
- Calculator: `/tools/position-size`
- Learn: `/learn`
- Desk: `/admin` — password `exnessfxbot-admin` (change `ADMIN_SECRET` in `.env.local`)

## How signals work

Demo cards are created the first time the store is empty (`data/signals.json`). From the desk you can publish, edit, mark filled/cancelled, or reset the demo set.

On Vercel the file store lives in `/tmp` and resets on cold start. For a durable live book, move it to a database later.
