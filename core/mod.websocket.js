// Websocket Server (Binance-only build — legacy FTX/Deribit WS removed)

const frostybot_module = require('./mod.base')

module.exports = class frostybot_websocket_module extends frostybot_module {

  constructor() {
      super()
  }

  initialize() {
      this.connect_all();
  }

  async connect_all() {
      // Binance trading path uses REST/ccxt; stub WS hooks retained for API compatibility
  }

  async connect_stub(stub) {
      return false;
  }

  async message(params) {
    if (params.hasOwnProperty('frostybot')) {
      const stub = params.frostybot.stub;
      if (this.hasOwnProperty('ws') && this.ws.hasOwnProperty(stub)) {
          var results = this.ws[stub].parse(params);
          results.forEach (result => {
            global.frostybot.wss.emit('proxy', result)
          });
      }
    }
  }

  async connected(stub) {
    return this.hasOwnProperty('ws') && this.ws.hasOwnProperty(stub);
  }

  async subscribe(stub, channel, symbol) {
    return false;
  }

  async unsubscribe(stub, channel, symbol) {
    return false;
  }

}
