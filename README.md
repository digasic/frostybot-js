![logo](https://i.imgur.com/erwsVFZ.png "#FrostyBot")

## Frostybot-JS (digasic)

Standalone fork of Frostybot-JS — Node.js webhook / REST / CLI gateway for **Binance** trading.

> Upstream `CryptoMF/frostybot-js` was deleted. This repo is the source of truth: **https://github.com/digasic/frostybot-js**

**Current release: [v1.3.0](https://github.com/digasic/frostybot-js/releases/tag/v1.3.0)** · Docker: `ghcr.io/digasic/frostybot-js:v1.3.0`

### What it does

* Commands via TradingView webhooks, REST API, or CLI
* Mapped to Binance orders (ccxt 4.x / Node ≥ 18)
* Core trade verbs: **long**, **short**, **buy**, **sell**, **close**, **cancel**
* `size=` = USD notional; `base=` / `quote=` for coin sizing; `price=` → limit, omit → market

### Exchange support

**Binance only:** Spot · Margin · USDT-M Futures · Coin-M Futures.

Live trading only (no Demo Trading / testnet mode). Futures symbols use ccxt unified form, e.g. `BTC/USDT:USDT`.

### Disclaimer

Use at your own risk. Use isolated API keys with limited permissions. Risk management is entirely yours. Do not commit API keys; they are stored encrypted in the local database volume only.

---

## Requirements

* Docker (recommended) **or** Linux (Ubuntu 20.04/22.04)
* Public IP if TradingView must reach your webhook from the internet

---

## Docker (recommended)

```bash
docker pull ghcr.io/digasic/frostybot-js:v1.3.0

docker run -d --name frostybot --restart unless-stopped \
  -p 8080:80 -p 2222:22 \
  -e SSH_PASS='change-me-now' \
  -e GUI_EMAIL='you@example.com' \
  -e GUI_PASSWORD='change-me-now' \
  -v frostybot-db:/usr/local/frostybot-js/database \
  -v frostybot-log:/usr/local/frostybot-js/log \
  ghcr.io/digasic/frostybot-js:v1.3.0
```

Or Compose from this repo:

```bash
git clone https://github.com/digasic/frostybot-js.git
cd frostybot-js
git checkout v1.3.0
SSH_PASS='change-me-now' docker compose up -d --build
```

| Variable | Description | Default |
| --- | --- | --- |
| `FROSTYBOT_HOST_PORT` | Host → container HTTP (Compose) | `8080` |
| `SSH_HOST_PORT` | Host → container SSH (Compose) | `2222` |
| `SSH_USER` | SSH username | `frostybot` |
| `SSH_PASS` | SSH password (**change this**) | `changeme` |
| `GUI_AUTO_ENABLE` | Enable GUI on first boot | `true` |
| `GUI_EMAIL` | Initial GUI login email | `admin@localhost` |
| `GUI_PASSWORD` | Initial GUI login password | `frostybot123` |

Data lives in Docker volumes (`frostybot-db`, `frostybot-log`). Removing those volumes deletes encrypted exchange keys and logs.

GUI: `http://localhost:8080`

---

## Server install (Ubuntu)

```bash
curl -fsSL https://raw.githubusercontent.com/digasic/frostybot-js/stable/scripts/install -o /tmp/install.sh
sudo chmod +x /tmp/install.sh
sudo /tmp/install.sh
```

Log: `/tmp/install.log`

```bash
frostybot start
frostybot status
frostybot gui:enable email=<your email> password=<password>
```

---

## Exchange account

```bash
frostybot accounts:add stub=bfut exchange=binance type=futures apikey="<apikey>" secret="<secret>"
```

`type`: `spot` | `margin` | `futures` (USDT-M) | `coinm`

Keys are encrypted at rest in SQLite. Never put them in git, Dockerfiles, or compose files.

---

## Usage examples

```bash
frostybot trade:bfut:markets
frostybot trade:bfut:balances
frostybot trade:bfut:positions
frostybot trade:bfut:long symbol=BTC/USDT:USDT size=100
frostybot trade:bfut:close symbol=BTC/USDT:USDT
frostybot trade:bfut:cancelall symbol=BTC/USDT:USDT
```

Webhook / REST use the same command syntax as the CLI.

---

## Upgrade

**Docker:** pull a newer tag (or `latest` on `stable`) and recreate the container; keep the same volumes.

**Server install:**

```bash
frostybot upgrade
```

Pulls from `https://github.com/digasic/frostybot-js.git` (`stable`).

---

## Changelog

See [CHANGELOG.md](CHANGELOG.md) and [Releases](https://github.com/digasic/frostybot-js/releases).

## Issues

https://github.com/digasic/frostybot-js/issues

## License

MIT — original copyright CryptoMF (2020); maintained fork by [digasic](https://github.com/digasic).
