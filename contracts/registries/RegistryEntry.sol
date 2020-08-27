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

import "@iexec/solidity/contracts/ENStools/ENSReverseRegistration.sol";
import "./Registry.sol";


abstract contract RegistryEntry is ENSReverseRegistration
{
	IRegistry public registry;

	function _initialize(address _registry) internal
	{
		require(address(registry) == address(0), 'already initialized');
		registry = IRegistry(_registry);
	}

	function owner() public view returns (address)
	{
		return registry.ownerOf(uint256(address(this)));
	}

	modifier onlyOwner()
	{
		require(owner() == msg.sender, 'caller is not the owner');
		_;
	}

	function setName(address _ens, string calldata _name)
	external onlyOwner()
	{
		_setName(IENS(_ens), _name);
	}
}
