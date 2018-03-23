function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}
//config
define("EVENT_WAIT_TIMEOUT", 100000);
define("AMOUNT_GAS_PROVIDED", 4500000);


// ENUM
define("WorkOrderStatusEnum", {
  UNSET:     0,
  PENDING:   1,
  CANCELLED: 2,
  ACTIVE:    3,
  REVEALING: 4,
  CLAIMED:   5,
  COMPLETED: 6
});

define("MarketOrderDirectionEnum",{
  UNSET  : 0,
  BID    : 1,
  ASK    : 2,
  CLOSED : 3
});

define("DAPP_PARAMS_EXAMPLE","{\"type\":\"DOCKER\",\"provider\"=\"hub.docker.com\",\"uri\"=\"iexechub/r-clifford-attractors:latest\",\"minmemory\"=\"512mo\"}");
