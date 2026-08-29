frostybot_exchange_base = require('./exchange.base');

module.exports = class frostybot_exchange_binance_base extends frostybot_exchange_base {

    constructor(stub) {
        super(stub);
        this.stablecoins = ['USDT', 'BUSD', 'USDC', 'FDUSD'];
        this.order_sizing = 'base';
        this.collateral_assets = ['USDT', 'BUSD', 'USDC', 'FDUSD'];
        this.balances_market_map = '{currency}/USDT';
        this.param_map = {
            limit: 'LIMIT',
            market: 'MARKET',
            stoploss_limit: 'STOP_LOSS_LIMIT',
            stoploss_market: 'STOP_LOSS',
            takeprofit_limit: 'TAKE_PROFIT_LIMIT',
            takeprofit_market: 'TAKE_PROFIT',
            trailing_stop: null,
            post: 'postOnly',
            reduce: 'reduceOnly',
            ioc: 'timeInForce',
            tag: 'newClientOrderId',
            trigger: 'stopPrice',
        };
    }

    // Apply common order flags (post-only / IOC / client id) without writing null keys

    apply_common_order_flags(order_params, custom_params = {}) {
        if (!order_params.params) order_params.params = {};
        const p = order_params.params;

        if (p.postOnly === true || p[this.param_map.post] === true) {
            p.postOnly = true;
            if (this.param_map.post && this.param_map.post !== 'postOnly') delete p[this.param_map.post];
        } else {
            delete p.postOnly;
            if (this.param_map.post) delete p[this.param_map.post];
        }

        // IOC mapped as timeInForce=IOC when flag is true
        if (p.timeInForce === true || p[this.param_map.ioc] === true) {
            p.timeInForce = 'IOC';
        } else if (p.timeInForce === true) {
            p.timeInForce = 'IOC';
        }
        if (p.timeInForce !== 'IOC' && p.timeInForce !== 'GTC' && p.timeInForce !== 'GTX' && p.timeInForce !== 'FOK') {
            if (p.timeInForce === true || p.timeInForce === false || p.timeInForce == null) delete p.timeInForce;
        }

        if (custom_params.tag) {
            p.newClientOrderId = String(custom_params.tag).slice(0, 36);
        }

        // ccxt unified triggerPrice; keep stopPrice for compatibility
        if (p.stopPrice != null && p.triggerPrice == null) {
            p.triggerPrice = p.stopPrice;
        }

        // Never send undefined / null litter
        Object.keys(p).forEach((k) => {
            if (p[k] === undefined || p[k] === null || k === 'null' || k === 'undefined') delete p[k];
        });

        return order_params;
    }

    custom_params(type, order_params, custom_params) {
        return this.apply_common_order_flags(order_params, custom_params || {});
    }

    async available_equity_usd(symbol) {
        return await this.total_balance_usd();
    }

    // Spot/margin market list with filter-based precision (ccxt4-safe)

    async markets() {
        if (this.data.markets != null) {
            return this.data.markets;
        }
        await this.fetch_tickers();
        let results = await this.ccxt('fetch_markets');
        var raw_markets = results;
        this.data.markets = [];
        raw_markets
            .filter(raw_market => raw_market.active == true)
            .forEach(raw_market => {
                const id = raw_market.id;
                const symbol = raw_market.symbol;
                const type = raw_market.type || 'spot';
                const base = raw_market.base;
                const quote = raw_market.quote;
                var ticker = this.data.tickers.hasOwnProperty(id) ? this.data.tickers[id] : null;
                const bid = ticker != null ? ticker.bid : null;
                const ask = ticker != null ? ticker.ask : null;
                const expiration = (raw_market.expiration != null ? raw_market.expiration : null);
                const contract_size = (raw_market.info && raw_market.info.contractSize != null ? raw_market.info.contractSize : 1);
                const filters = (raw_market.info && raw_market.info.filters) ? raw_market.info.filters : [];
                const price_filter = this.utils.filter_objects(filters, { filterType: 'PRICE_FILTER' });
                const amount_filter = this.utils.filter_objects(filters, { filterType: 'LOT_SIZE' });
                const precision = {
                    price: (price_filter[0] ? price_filter[0].tickSize * 1 : (raw_market.precision && raw_market.precision.price)),
                    amount: (amount_filter[0] ? amount_filter[0].stepSize * 1 : (raw_market.precision && raw_market.precision.amount)),
                };
                const tvsymbol = 'BINANCE:' + String(raw_market.symbol).replace('-', '').replace('/', '');
                const raw = raw_market.info;
                const market = new this.classes.market(id, symbol, type, base, quote, bid, ask, expiration, contract_size, precision, tvsymbol, raw);
                this.data.markets.push(market);
            });
        await this.index_markets();
        await this.update_markets_usd_price();
        return this.data.markets;
    }

    async fetch_tickers() {
        var results = {};
        this.data.tickers = {};
        try {
            this.set_cache_time('public_get_ticker_bookticker', 10);
            var tickersRaw = await this.ccxt('public_get_ticker_bookticker');
            if (!this.utils.is_array(tickersRaw)) {
                // ccxt unified fallback
                var unified = await this.ccxt('fetch_tickers');
                if (unified && typeof unified === 'object' && unified.result !== 'error') {
                    Object.keys(unified).forEach((sym) => {
                        const t = unified[sym];
                        if (t && t.symbol) {
                            results[t.info && t.info.symbol ? t.info.symbol : t.symbol.replace('/', '')] = {
                                bid: t.bid != null ? t.bid * 1 : null,
                                ask: t.ask != null ? t.ask * 1 : null,
                            };
                        }
                    });
                    this.data.tickers = results;
                    return results;
                }
                tickersRaw = [];
            }
            for (var i = 0; i < tickersRaw.length; i++) {
                var tickerRaw = tickersRaw[i];
                results[tickerRaw.symbol] = {
                    bid: this.utils.is_numeric(tickerRaw.bidPrice) ? tickerRaw.bidPrice * 1 : null,
                    ask: this.utils.is_numeric(tickerRaw.askPrice) ? tickerRaw.askPrice * 1 : null,
                };
            }
        } catch (e) {
            this.data.tickers = {};
            return {};
        }
        this.data.tickers = results;
        return results;
    }

    async open_orders(params) {
        var [symbol, since, limit] = this.utils.extract_props(params, ['symbol', 'since', 'limit']);
        let raworders = await this.ccxt('fetch_open_orders', [symbol, since, limit]);
        return this.parse_orders(raworders);
    }

    async all_orders(params) {
        var [symbol, since, limit] = this.utils.extract_props(params, ['symbol', 'since', 'limit']);
        let raworders = await this.ccxt('fetch_orders', [symbol, since, limit]);
        return this.parse_orders(raworders);
    }

    // ccxt4: cancelOrder(id, symbol[, params])

    async cancel(params) {
        var [symbol, id] = this.utils.extract_props(params, ['symbol', 'id']);
        var orders = await this.open_orders({ symbol: symbol });
        if (String(id).toLowerCase() == 'all') {
            await this.ccxt('cancel_all_orders', [symbol]);
            orders.forEach((order, idx) => {
                order.status = 'cancelled';
                orders[idx] = order;
            });
            return orders;
        }
        const target = String(id);
        const matched = orders.filter(order => String(order.id) === target);
        for (const order of matched) {
            await this.ccxt('cancel_order', [order.id, symbol]);
            order.status = 'cancelled';
        }
        return matched.length ? matched : orders.filter(o => String(o.id) === target);
    }

    parse_order(order) {
        if (order instanceof this.classes.order) {
            return order;
        }
        if (!order || order.result === 'error') {
            return order;
        }
        const symbol = order.symbol;
        const market = this.data.markets_by_symbol ? this.data.markets_by_symbol[symbol] : null;
        const id = order.id;
        const timestamp = order.timestamp || (order.info && (order.info.updateTime || order.info.transactTime)) || null;
        const direction = order.side;
        const info = order.info || {};
        const trigger = (
            info.trailValue != null ? info.trailValue * 1 :
            (info.triggerPrice != null ? info.triggerPrice * 1 :
            (info.stopPrice != null ? info.stopPrice * 1 :
            (order.triggerPrice != null ? order.triggerPrice * 1 : null)))
        );
        var type = String(order.type || 'market').toLowerCase();
        const market_price = (market != null ? (direction == 'buy' ? market.ask : market.bid) : null);
        const price = (
            info.orderPrice != null ? info.orderPrice * 1 :
            (order.price != null ? order.price * 1 :
            (trigger != null ? trigger :
            (type.indexOf('market') !== -1 ? market_price : null)))
        );
        const size_base = order.amount;
        const size_quote = (order.amount != null && price != null) ? order.amount * price : null;
        const filled_base = order.filled;
        const filled_quote = (order.filled != null && price != null) ? order.filled * price : null;
        switch (type) {
            case 'stop':
            case 'stop_loss':
                type = (price != null && trigger != null && price != trigger) ? 'stop_limit' : 'stop_market';
                break;
            case 'stop_market':
            case 'stop_loss_limit':
                break;
            case 'take_profit':
                type = (price != null && trigger != null && price != trigger) ? 'takeprofit_limit' : 'takeprofit_market';
                break;
            case 'take_profit_market':
                type = 'takeprofit_market';
                break;
            case 'trailing_stop_market':
                type = 'trailstop';
                break;
        }
        const status = String(order.status || '').replace(/CANCELED/i, 'cancelled').replace(/canceled/i, 'cancelled');
        const raw = info;
        return new this.classes.order(market, id, timestamp, type, direction, price, trigger, size_base, size_quote, filled_base, filled_quote, status, raw);
    }

}
