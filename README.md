![logo](https://i.imgur.com/erwsVFZ.png "#FrostyBot")

## Frostybot-JS (digasic fork)

Standalone maintained fork of Frostybot-JS — a Node.js API endpoint for cryptocurrency trading via TradingView webhooks / REST / CLI.

> Original upstream (`CryptoMF/frostybot-js`) was deleted. This repository is the source of truth: **https://github.com/digasic/frostybot-js**

### What it does

* Commands arrive via TradingView alerts (webhooks), REST API, or Linux CLI
* Frostybot converts them into exchange orders
* Main trading commands: **long**, **short**, **buy**, **sell**, **close**, **cancel**
* `size=xxx` sizes in USD; `base=` / `quote=` for currency sizing; `price=` → limit, omit → market

### Disclaimer

Use at your own risk. Prefer testnet / isolated API keys. Risk management is entirely yours.

### Supported exchange

**Binance only:** Spot / Margin / USDT-M Futures / Coin-M.

Uses **ccxt 4.x** (Node ≥ 18).

---

## Requirements

* Linux (Ubuntu 20.04/22.04 recommended) **or** Docker
* Public IP if you need TradingView webhooks from the internet

## Installation

### Option 1 — Server install (Ubuntu)

```bash
curl -fsSL https://raw.githubusercontent.com/digasic/frostybot-js/stable/scripts/install -o /tmp/install.sh
sudo chmod +x /tmp/install.sh
sudo /tmp/install.sh
```

Log: `/tmp/install.log`

### Option 2 — Docker (recommended)

Image: **`ghcr.io/digasic/frostybot-js:latest`**

```bash
docker pull ghcr.io/digasic/frostybot-js:v1.0.0

docker run -d --name frostybot --restart unless-stopped \
  -p 8080:80 -p 2222:22 \
  -e SSH_PASS='change-me-now' \
  -v frostybot-db:/usr/local/frostybot-js/database \
  -v frostybot-log:/usr/local/frostybot-js/log \
  ghcr.io/digasic/frostybot-js:v1.0.0
```

Or use tag **`latest`**.
Or with Compose from this repo:

```bash
git clone https://github.com/digasic/frostybot-js.git
cd frostybot-js
SSH_PASS='change-me-now' docker compose up -d --build
```

| Variable | Description | Default |
| --- | --- | --- |
| `FROSTYBOT_PORT` | Listen port inside container | `80` |
| `SSH_PORT` | SSH port inside container | `22` |
| `SSH_USER` | SSH username | `frostybot` |
| `SSH_PASS` | SSH password (**change this**) | `__frostybot123__` |

Build locally:

```bash
docker build -t ghcr.io/digasic/frostybot-js:latest .
```

## Post-install

```bash
frostybot start
frostybot status
frostybot gui:enable email=<your email> password=<password>
```

GUI: `http://<host>:<port>`

Add exchange keys (example):

```bash
frostybot accounts:add stub=mystub exchange=binance apikey="<apikey>" secret="<secret>"
```

## Usage examples

```bash
frostybot trade:mystub:markets
frostybot trade:mystub:balances
frostybot trade:mystub:long symbol=BTC/USDT size=100
frostybot trade:mystub:cancelall symbol=BTC/USDT
```

Webhook / CLI commands use the same syntax as documented historically for Frostybot.

## Upgrade

On a server install:

```bash
frostybot upgrade
```

Pulls from the configured git remote (`https://github.com/digasic/frostybot-js.git` after a fresh install).

## Bugs / issues

https://github.com/digasic/frostybot-js/issues

## License

MIT — original copyright CryptoMF (2020); maintained fork by [digasic](https://github.com/digasic).
