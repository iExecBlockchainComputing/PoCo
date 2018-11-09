function define(name, value)
{
	Object.defineProperty(exports, name, { value: value, enumerable: true	});
}

//config
define("EVENT_WAIT_TIMEOUT",  100000);
define("AMOUNT_GAS_PROVIDED", 4500000);
//define("AMOUNT_GAS_PROVIDED", 0xFFFFFFFFFFFFFFFF);

define("NULL", {
	ADDRESS: "0x0000000000000000000000000000000000000000",
	BYTES32: "0x0000000000000000000000000000000000000000000000000000000000000000",
	SIGNATURE: {
		r: "0x0000000000000000000000000000000000000000000000000000000000000000",
		s: "0x0000000000000000000000000000000000000000000000000000000000000000",
		v: 0
	}
});

// ENUM
define("TaskStatusEnum", {
	UNSET:     0,
	ACTIVE:    1,
	REVEALING: 2,
	COMPLETED: 3,
	FAILLED:   4
});
define("ContributionStatusEnum", {
	UNSET       : 0,
	CONTRIBUTED : 1,
	PROVED      : 2,
	REJECTED    : 3
});


define("DAPP_PARAMS_EXAMPLE", "{\"type\":\"DOCKER\",\"provider\":\"hub.docker.com\",\"uri\":\"iexechub/vanityeth:latest\",\"minmemory\":\"512mo\"}");
