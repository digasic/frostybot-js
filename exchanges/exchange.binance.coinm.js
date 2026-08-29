frostybot_exchange_binance_base = require('./exchange.binance.base');

module.exports = class frostybot_exchange_binance_coinm extends frostybot_exchange_binance_base {

    constructor(stub) {
        super(stub);
        this.stablecoins = ['USD'];
        this.order_sizing = 'quote';
        this.collateral_assets = ['BTC', 'BNB'];
        this.balances_market_map = '{currency}/USD';
        this.param_map = {
            limit: 'LIMIT',
            market: 'MARKET',
            stoploss_limit: 'STOP',
            stoploss_market: 'STOP_MARKET',
            takeprofit_limit: 'TAKE_PROFIT',
            takeprofit_market: 'TAKE_PROFIT_MARKET',
            trailing_stop: 'TRAILING_STOP_MARKET',
            post: 'postOnly',
            reduce: 'reduceOnly',
            ioc: 'timeInForce',
            tag: 'newClientOrderId',
            trigger: 'stopPrice',
            trigger_type: 'workingType',
        };
    }

    // Same hedge / trailing / workingType logic as USDT-M, against COIN-M endpoints

    async custom_params(type, order_params, custom_params) {
        order_params = this.apply_common_order_flags(order_params, custom_params || {});
        if (!order_params.params) order_params.params = {};

        var dual = false;
        try {
            var position_mode = await this.ccxt('dapiPrivate_get_positionside_dual', []);
            if (position_mode && position_mode.dualSidePosition != null) {
                dual = position_mode.dualSidePosition === true || position_mode.dualSidePosition === 'true';
            }
        } catch (e) {
            dual = false;
        }

        const side = String(order_params.side || '').toLowerCase();
        const orderType = String(type || '').toLowerCase();

        if (dual) {
            if (['stoploss', 'takeprofit', 'trailstop', 'close'].includes(orderType)) {
                if (side === 'sell') order_params.params.positionSide = 'LONG';
                if (side === 'buy') order_params.params.positionSide = 'SHORT';
            } else if (['short', 'sell'].includes(orderType)) {
                order_params.params.positionSide = 'SHORT';
            } else if (['long', 'buy'].includes(orderType)) {
                order_params.params.positionSide = 'LONG';
            } else {
                order_params.params.positionSide = side === 'sell' ? 'SHORT' : 'LONG';
            }
            delete order_params.params.reduceOnly;
        } else {
            delete order_params.params.positionSide;
            if (['stoploss', 'takeprofit', 'trailstop', 'close'].includes(orderType)) {
                if (order_params.params.reduceOnly == null) {
                    order_params.params.reduceOnly = true;
                }
            }
        }

        if (custom_params && custom_params.triggertype) {
            const wt = String(custom_params.triggertype).toLowerCase();
            if (wt.indexOf('mark') !== -1) order_params.params.workingType = 'MARK_PRICE';
            else if (wt.indexOf('contract') !== -1 || wt.indexOf('last') !== -1) order_params.params.workingType = 'CONTRACT_PRICE';
        }

        if (orderType === 'trailstop' || String(order_params.type).toUpperCase() === 'TRAILING_STOP_MARKET') {
            order_params.type = 'TRAILING_STOP_MARKET';
            let cb = custom_params && custom_params.trigger != null ? custom_params.trigger : order_params.params.stopPrice;
            if (cb != null) {
                let rate = String(cb).replace('%', '');
                if (String(custom_params.trigger).indexOf('%') === -1 && this.data && this.data.markets_by_symbol) {
                    const m = this.data.markets_by_symbol[order_params.symbol];
                    if (m && m.avg) {
                        rate = (Math.abs(Number(cb) - Number(m.avg)) / Number(m.avg)) * 100;
                    }
                }
                rate = Math.abs(Number(rate));
                if (!Number.isNaN(rate) && rate > 0) {
                    order_params.params.callbackRate = rate;
                }
            }
            delete order_params.params.stopPrice;
            delete order_params.params.triggerPrice;
            order_params.price = undefined;
        }

        Object.keys(order_params.params).forEach((k) => {
            if (order_params.params[k] === undefined || order_params.params[k] === null) delete order_params.params[k];
        });
        return order_params;
    }

    async leverage(params) {
        var [symbol, type, leverage] = this.utils.extract_props(params, ['symbol', 'type', 'leverage']);
        await this.markets();
        var market = await this.get_market_by_id_or_symbol(symbol);
        symbol = market.id;
        var marginType = (type == 'cross' ? 'CROSSED' : (type == 'isolated' ? 'ISOLATED' : null));
        leverage = String(leverage).toLowerCase().replace('x', '');
        if (marginType) {
            try {
                await this.ccxt('dapiPrivate_post_margintype', { symbol: symbol, marginType: marginType });
            } catch (e) { /* already set */ }
        }
        var leverageResult = await this.ccxt('dapiPrivate_post_leverage', { symbol: symbol, leverage: leverage });
        return (leverageResult && leverageResult.leverage == leverage);
    }

    async positions() {
        this.set_cache_time('dapiPrivate_get_positionrisk', 5);
        let raw_positions = await this.ccxt('dapiPrivate_get_positionrisk');
        await this.markets();
        var positions = [];
        if (!this.utils.is_array(raw_positions)) raw_positions = [];
        for (const raw_position of raw_positions.filter(p => p.positionAmt != 0)) {
            const symbol = raw_position.symbol;
            const market = await this.get_market_by_id_or_symbol(symbol);
            const direction = (raw_position.positionAmt > 0 ? 'long' : (raw_position.positionAmt < 0 ? 'short' : 'flat'));
            const quote_size = (raw_position.positionAmt * market.contract_size);
            const entry_price = (raw_position.entryPrice * 1);
            const liquidation_price = this.utils.is_numeric(raw_position.liquidationPrice) ? (raw_position.liquidationPrice * 1) : null;
            const position = new this.classes.position_futures(market, direction, null, quote_size, entry_price, liquidation_price, raw_position);
            positions.push(position);
        }
        this.positions = positions;
        return this.positions;
    }

    async markets() {
        if (this.data.markets != null) {
            return this.data.markets;
        }
        await this.fetch_tickers();
        let results = await this.ccxt('fetch_markets');
        var raw_markets = results;
        this.data.markets = [];
        if (!this.utils.is_array(raw_markets)) raw_markets = [];
        raw_markets
            .filter(raw_market => raw_market.active == true)
            .forEach(raw_market => {
                const id = raw_market.id;
                const symbol = raw_market.symbol;
                const tvsymbol = 'BINANCE:' + raw_market.symbol.replace('-', '').replace('/', '');
                const type = 'futures';
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
                    price: (price_filter[0] ? price_filter[0].tickSize * 1 : null),
                    amount: (amount_filter[0] ? amount_filter[0].stepSize * 1 : null)
                };
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
        this.set_cache_time('dapiPublic_get_ticker_bookticker', 10);
        var tickersRaw = await this.ccxt('dapiPublic_get_ticker_bookticker');
        if (!this.utils.is_array(tickersRaw)) tickersRaw = [];
        for (var i = 0; i < tickersRaw.length; i++) {
            var tickerRaw = tickersRaw[i];
            results[tickerRaw.symbol] = {
                bid: this.utils.is_numeric(tickerRaw.bidPrice) ? tickerRaw.bidPrice * 1 : null,
                ask: this.utils.is_numeric(tickerRaw.askPrice) ? tickerRaw.askPrice * 1 : null,
            };
        }
        this.data.tickers = results;
        return results;
    }

}
