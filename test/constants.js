function define(name, value)
{
	Object.defineProperty(exports, name, { value: value, enumerable: true	});
}

//config
define("EVENT_WAIT_TIMEOUT",  100000);
define("AMOUNT_GAS_PROVIDED", 4500000);

define("NULL", {
	ADDRESS: "0x0000000000000000000000000000000000000000",
	BYTES32: "0x0000000000000000000000000000000000000000000000000000000000000000"
});

// ENUM
define("WorkOrderStatusEnum", {
	UNSET:     0,
	ACTIVE:    1,
	REVEALING: 2,
	COMPLETED: 3,
	FAILLED:   4
});
define("ContributionStatusEnum", {
	UNSET       : 0,
	AUTHORIZED  : 1,
	CONTRIBUTED : 2,
	PROVED      : 3,
	REJECTED    : 4
});


define("DAPP_PARAMS_EXAMPLE", "{\"type\":\"DOCKER\",\"provider\"=\"hub.docker.com\",\"uri\"=\"iexechub/r-clifford-attractors:latest\",\"minmemory\"=\"512mo\"}");
