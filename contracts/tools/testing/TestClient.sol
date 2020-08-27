// SPDX-License-Identifier: Apache-2.0

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

pragma solidity ^0.6.0;

import "@iexec/solidity/contracts/ERC1154/IERC1154.sol";


contract TestClient is IOracleConsumer
{
	event GotResult(bytes32 indexed id, bytes result);

	mapping(bytes32 => uint256) public gstore;
	mapping(bytes32 => bytes  ) public store;

	constructor()
	public
	{
	}

	function receiveResult(bytes32 id, bytes calldata result) external override
	{
		gstore[id] = gasleft();
		store[id]  = result;
		emit GotResult(id, result);
	}

}
