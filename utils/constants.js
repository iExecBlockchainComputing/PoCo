/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

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
	SIGNATURE: "0x",
	DATAORDER: {
		dataset:            "0x0000000000000000000000000000000000000000",
		datasetprice:       0,
		volume:             0,
		tag:                "0x0000000000000000000000000000000000000000000000000000000000000000",
		apprestrict:        "0x0000000000000000000000000000000000000000",
		workerpoolrestrict: "0x0000000000000000000000000000000000000000",
		requesterrestrict:  "0x0000000000000000000000000000000000000000",
		salt:               "0x0000000000000000000000000000000000000000000000000000000000000000",
		sign:               "0x",
	}
});

// ENUM
define("OrderOperationEnum", {
	SIGN:  0,
	CLOSE: 1
});
define("TaskStatusEnum", {
	UNSET:     0,
	ACTIVE:    1,
	REVEALING: 2,
	COMPLETED: 3,
	FAILED:    4
});
define("ContributionStatusEnum", {
	UNSET       : 0,
	CONTRIBUTED : 1,
	PROVED      : 2,
	REJECTED    : 3
});

define("MULTIADDR",       "/ipfs/QmRwwTz9Chq4Y7F7ReKKcx1GV6s3H7egmNGrku9XrwiDa8");
define("MULTIADDR_BYTES", "0xa503221220359d55f58a43126d4ba446a35940265eb2dab57ecbc439e7f105c558f8774819");
