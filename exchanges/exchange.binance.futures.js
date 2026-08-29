frostybot_exchange_binance_base = require('./exchange.binance.base');

module.exports = class frostybot_exchange_binance_futures extends frostybot_exchange_binance_base {

    constructor(stub) {
        super(stub);
        this.stablecoins = ['USDT', 'BUSD', 'USDC'];
        this.order_sizing = 'base';
        this.collateral_assets = ['USDT', 'BUSD', 'USDC'];
        this.balances_market_map = '{currency}USDT';
        this.param_map = {
            limit: 'LIMIT',
            market: 'MARKET',
            stoploss_limit: 'STOP',
            stoploss_market: 'STOP_MARKET',
            takeprofit_limit: 'TAKE_PROFIT',
            takeprofit_market: 'TAKE_PROFIT_MARKET',
            take_profit_limit: 'TAKE_PROFIT',
            take_profit_market: 'TAKE_PROFIT_MARKET',
            trailing_stop: 'TRAILING_STOP_MARKET',
            post: 'postOnly',
            reduce: 'reduceOnly',
            ioc: 'timeInForce',
            tag: 'newClientOrderId',
            trigger: 'stopPrice',
            trigger_type: 'workingType',
        };
    }

    // Hedge-mode positionSide + workingType + trailing callbackRate

    async custom_params(type, order_params, custom_params) {
        order_params = this.apply_common_order_flags(order_params, custom_params || {});
        if (!order_params.params) order_params.params = {};

        // Position mode (one-way vs hedge)
        var dual = false;
        try {
            var position_mode = await this.ccxt('fapiPrivate_get_positionside_dual');
            if (position_mode && position_mode.result !== 'error' && position_mode.dualSidePosition != null) {
                dual = position_mode.dualSidePosition === true || position_mode.dualSidePosition === 'true';
            }
        } catch (e) {
            dual = false;
        }

        const side = String(order_params.side || '').toLowerCase();
        const orderType = String(type || '').toLowerCase();

        if (dual) {
            // Hedge: positionSide required; reduceOnly forbidden by Binance
            if (['stoploss', 'takeprofit', 'trailstop', 'close'].includes(orderType)) {
                // Closing long => SELL + LONG; closing short => BUY + SHORT
                if (side === 'sell') order_params.params.positionSide = 'LONG';
                if (side === 'buy') order_params.params.positionSide = 'SHORT';
            } else if (['short', 'sell'].includes(orderType)) {
                order_params.params.positionSide = 'SHORT';
            } else if (['long', 'buy'].includes(orderType)) {
                order_params.params.positionSide = 'LONG';
            } else {
                // fallback by side for layered/unknown
                order_params.params.positionSide = side === 'sell' ? 'SHORT' : 'LONG';
            }
            delete order_params.params.reduceOnly;
        } else {
            // One-way: reduceOnly OK; no positionSide
            delete order_params.params.positionSide;
            if (['stoploss', 'takeprofit', 'trailstop', 'close'].includes(orderType)) {
                if (order_params.params.reduceOnly == null) {
                    order_params.params.reduceOnly = true;
                }
            }
        }

        // workingType: MARK_PRICE | CONTRACT_PRICE
        if (custom_params && custom_params.triggertype) {
            const wt = String(custom_params.triggertype).toLowerCase();
            if (wt.indexOf('mark') !== -1) order_params.params.workingType = 'MARK_PRICE';
            else if (wt.indexOf('contract') !== -1 || wt.indexOf('last') !== -1) order_params.params.workingType = 'CONTRACT_PRICE';
        }

        // Trailing stop: Binance wants callbackRate (%), optional activationPrice
        if (orderType === 'trailstop' || String(order_params.type).toUpperCase() === 'TRAILING_STOP_MARKET') {
            order_params.type = 'TRAILING_STOP_MARKET';
            let cb = custom_params && custom_params.trigger != null ? custom_params.trigger : order_params.params.stopPrice;
            if (cb != null) {
                let rate = String(cb).replace('%', '');
                // If absolute price was supplied, approximate % from mid
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
                await this.ccxt('fapiPrivate_post_margintype', { symbol: symbol, marginType: marginType });
            } catch (e) { /* already set */ }
        }
        var leverageResult = await this.ccxt('fapiPrivate_post_leverage', { symbol: symbol, leverage: leverage });
        return (leverageResult && leverageResult.leverage == leverage);
    }

    async available_equity_usd(symbol) {
        return await this.total_balance_usd();
    }

    async positions() {
        await this.markets();
        var positions = [];
        let raw_positions = [];
        try {
            // Demo Trading rejects legacy /fapi/v1/positionRisk (-5000); use unified fetchPositions
            const fetched = await this.ccxt('fetch_positions');
            if (this.utils.is_array(fetched)) {
                raw_positions = fetched
                    .filter(p => Math.abs(Number(p.contracts != null ? p.contracts : (p.info && p.info.positionAmt) || 0)) > 0)
                    .map(p => ({
                        symbol: (p.info && p.info.symbol) ? p.info.symbol : (p.symbol || '').replace('/USDT:USDT', 'USDT').replace('/', ''),
                        positionAmt: p.contracts != null ? p.contracts * (p.side === 'short' ? -1 : 1) : Number(p.info && p.info.positionAmt),
                        entryPrice: p.entryPrice != null ? p.entryPrice : (p.info && p.info.entryPrice),
                        liquidationPrice: p.liquidationPrice != null ? p.liquidationPrice : (p.info && p.info.liquidationPrice),
                        _market_symbol: p.symbol,
                        raw: p.info || p
                    }));
            }
        } catch (e) {
            this.set_cache_time('fapiPrivate_get_positionrisk', 5);
            let legacy = await this.execute('fapiPrivate_get_positionrisk');
            if (this.utils.is_array(legacy)) {
                raw_positions = legacy.filter(p => Number(p.positionAmt) != 0);
            }
        }
        for (const raw_position of raw_positions) {
            const market = raw_position._market_symbol
                ? await this.get_market_by_id_or_symbol(raw_position._market_symbol)
                : await this.get_market_by_id(raw_position.symbol);
            if (!market) continue;
            const direction = (raw_position.positionAmt > 0 ? 'long' : (raw_position.positionAmt < 0 ? 'short' : 'flat'));
            const base_size = (raw_position.positionAmt * 1);
            const entry_price = (raw_position.entryPrice * 1);
            const liquidation_price = this.utils.is_numeric(raw_position.liquidationPrice) ? (raw_position.liquidationPrice * 1) : null;
            const position = new this.classes.position_futures(market, direction, base_size, null, entry_price, liquidation_price, raw_position.raw || raw_position);
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
        raw_markets
            .filter(raw_market => raw_market.active == true && raw_market.info && String(raw_market.info.contractType || '').toLowerCase() == 'perpetual')
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
                const contract_size = (raw_market.info.contractSize != null ? raw_market.info.contractSize : 1);
                const price_filter = this.utils.filter_objects(raw_market.info.filters, { filterType: 'PRICE_FILTER' });
                const amount_filter = this.utils.filter_objects(raw_market.info.filters, { filterType: 'LOT_SIZE' });
                const precision = {
                    price: (price_filter[0].tickSize * 1),
                    amount: (amount_filter[0].stepSize * 1)
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
        this.set_cache_time('fapiPublic_get_ticker_bookticker', 10);
        var tickersRaw = await this.ccxt('fapiPublic_get_ticker_bookticker');
        if (!this.utils.is_array(tickersRaw)) tickersRaw = [];
        for (var i = 0; i < tickersRaw.length; i++) {
            var tickerRaw = tickersRaw[i];
            var symbol = tickerRaw.symbol;
            results[symbol] = {
                bid: this.utils.is_numeric(tickerRaw.bidPrice) ? tickerRaw.bidPrice * 1 : null,
                ask: this.utils.is_numeric(tickerRaw.askPrice) ? tickerRaw.askPrice * 1 : null,
            };
        }
        this.data.tickers = results;
        return results;
    }

}
