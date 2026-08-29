frostybot_exchange_binance_base = require('./exchange.binance.base');

module.exports = class frostybot_exchange_binance_margin extends frostybot_exchange_binance_base {

    constructor(stub) {
        super(stub);
        this.balances_market_map = '{currency}/{stablecoin}';
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

    async positions() {
        var markets = await this.markets();
        var positions = [];
        var balances = await this.balances();
        balances.forEach((balance) => {
            markets.forEach(market => {
                if (market.base == balance.currency) {
                    const position = new this.classes.position_spot(market, 'long', balance.base.total);
                    positions.push(position);
                }
            });
        });
        this.positions = positions;
        return this.positions;
    }

}
