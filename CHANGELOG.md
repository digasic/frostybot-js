# Changelog

## [1.3.0] — 2026-08-29

Final digasic maintenance release.

### Breaking / scope

- **Binance only** — FTX, Deribit, Bitmex, Binance.US adapters removed
- **Live trading only** — Demo Trading / testnet UI and `enableDemoTrading` removed

### Trading (ccxt 4)

- Dedicated Binance classes: spot / margin / `binanceusdm` / `binancecoinm`
- Cancel, hedge mode, SL/TP, trailing updates for ccxt 4 order path
- Futures positions via unified `fetchPositions`
- Config keys tolerate colon symbols (`BTC/USDT:USDT`)

### Ops / GUI

- GUI session tokens preserved across `gui:enable` on container restart (logs tab)
- `is_object(null)` fixed (API no longer crashes on empty cluster node settings)
- Docker: GUI auto-enable via `GUI_EMAIL` / `GUI_PASSWORD` / `GUI_AUTO_ENABLE`

### Docs

- README rewritten for Docker-first install, live Binance only, no demo/testnet

---

## [1.1.0] — 2026-08-29

- ccxt 1.95 → 4.5.76
- Node 16 → 20 (Docker + install)
- better-sqlite3 7 → 11.7
- Binance book ticker / method name fallbacks
- FTX removed from ccxt v4 surface

## [1.0.1] — 2026-08-29

- GUI auto-enable on Docker first boot

## [1.0.0] — 2026-08-29

- Initial digasic standalone fork after upstream deletion
