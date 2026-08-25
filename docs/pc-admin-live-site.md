# PC admin + live website (Lightsail)

Use this when deploying ExnessfxBot to Amazon Lightsail while keeping the admin desk and MT5 on this Windows PC.

## Split

| Where | What runs |
| --- | --- |
| **This PC** | Admin desk (`npx next dev --port 3001`), MT5 executor, MetaTrader 5 |
| **Lightsail** | Public site only: cards, login, premium, results, Telegram card links |

Admin on the PC still writes the local queue and the executor still talks to MT5 here. After each desk change (publish, SL/TP, close) and after MT5 trails/fills, the PC **pushes** `data/signals.json` to the live site. The live site does **not** open MT5 and does **not** send a second Telegram post.

## Lightsail instance

Host: **ubuntu@63.184.44.34** (eu-central-1). SSH key: `C:\Users\GEORGE\serpai\downloads\LightsailDefaultKey-eu-central-1.pem`.

Current plan: **1 GB RAM, 40 GB SSD**, **2 GB swap**. Two production sites share the box:

| Domain | Process | Bind |
| --- | --- | --- |
| https://serpal.xyz | PM2 `serpai` | 127.0.0.1:3847 |
| https://forextradingconsultants.com | PM2 `forextradingconsultants` | 127.0.0.1:3000 |

Caddy terminates HTTPS on 80/443. App code lives in `/opt/forextradingconsultants`. Redeploy from this PC with `.\deploy\push-to-lightsail.ps1`. Do not run `next dev` on the server. If both apps are busy, move to a **2 GB** plan.

MT5 cannot run on Lightsail (Linux). The Python MetaTrader5 API is Windows-only.

## Cloudflare DNS (required for HTTPS)

In Cloudflare → forextradingconsultants.com → DNS, **DNS only** (grey cloud), not proxied:

| Type | Name | Content |
| --- | --- | --- |
| A | `@` | `63.184.44.34` |
| A | `www` | `63.184.44.34` |

Leave the nameservers as Cloudflare (`alberto` / `stevie`). After the A records exist, Caddy issues Let's Encrypt certs on its own. Orange-cloud proxy can wait until HTTPS already works (then SSL mode Full/Strict).

## Env on this PC (`.env.local`)

This PC is already pointed at the live site:

```
SITE_URL=https://forextradingconsultants.com
LIVE_SITE_URL=https://forextradingconsultants.com
LIVE_SYNC_SECRET=<same value as on the server>
```

`SITE_URL` is what Telegram uses in card links. `LIVE_SITE_URL` is where the PC posts the signal store. They are usually the same origin.

`LIVE_SYNC_SECRET` is already generated in `.env.local`. Copy that value to Lightsail. Do not put it in git.

Restart the local Next server and MT5 executor after changing these.

## Env on Lightsail

```
SITE_URL=https://forextradingconsultants.com
LIVE_SYNC_SECRET=<same secret as the PC>
```

**Do not set `LIVE_SITE_URL` on the server.** If you do, the live box would try to push to itself.

Also set `ADMIN_SECRET`, `SESSION_SECRET`, `TELEGRAM_*` as needed on the server. Telegram posting can stay on the PC; keep `TELEGRAM_BOT_TOKEN` on the PC if that is how posts are sent.

## How a signal flows after this is on

1. Send from admin on this PC.
2. Local cards + MT5 executor run as they do now.
3. PC POSTs the signal store to `LIVE_SITE_URL/api/sync/live` with `Authorization: Bearer LIVE_SYNC_SECRET`.
4. Lightsail overwrites its `signals.json`. Visitors see premium cards now, regulars after 10 minutes.
5. Trails (1R BE, 2R half-close + lock 1R) and fills on this PC are pushed the same way.

## Check

Admin desk shows **Live site: off** until `LIVE_SITE_URL` is set, then **desk on this PC will push cards to \<host\>**.

## Not synced

Users, payments, and MT5 account config stay on whichever machine wrote them. After deploy, people register and pay on the **live** site. Approving payments is then on the live admin unless that is wired later. MT5 accounts stay on this PC.
