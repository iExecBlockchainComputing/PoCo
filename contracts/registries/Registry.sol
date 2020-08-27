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
import "@iexec/solidity/contracts/Upgradeability/InitializableUpgradeabilityProxy.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Create2.sol";
import "./IRegistry.sol";


abstract contract Registry is IRegistry, ERC721, ENSReverseRegistration, Ownable
{
	address   public master;
	bytes     public proxyCode;
	bytes32   public proxyCodeHash;
	IRegistry public previous;
	bool      public initialized;

	constructor(address _master, string memory _name, string memory _symbol)
	public ERC721(_name, _symbol)
	{
		master        = _master;
		proxyCode     = type(InitializableUpgradeabilityProxy).creationCode;
		proxyCodeHash = keccak256(proxyCode);
	}

	function initialize(address _previous)
	external onlyOwner()
	{
		require(!initialized);
		initialized = true;
		previous    = IRegistry(_previous);
	}

	/* Factory */
	function _mintCreate(address _owner, bytes memory _args)
	internal returns (uint256)
	{
		// Create entry (proxy)
		address entry = Create2.deploy(0, keccak256(abi.encodePacked(_args, _owner)), proxyCode);
		// Initialize entry (casting to address payable is a pain in ^0.5.0)
		InitializableUpgradeabilityProxy(payable(entry)).initialize(master, _args);
		// Mint corresponding token
		_mint(_owner, uint256(entry));
		return uint256(entry);
	}

	function _mintPredict(address _owner, bytes memory _args)
	internal view returns (uint256)
	{
		address entry = Create2.computeAddress(keccak256(abi.encodePacked(_args, _owner)), proxyCodeHash);
		return uint256(entry);
	}

	/* Administration */
	function setName(address _ens, string calldata _name)
	external onlyOwner()
	{
		_setName(IENS(_ens), _name);
	}

	function setBaseURI(string calldata _baseURI)
	external onlyOwner()
	{
		_setBaseURI(_baseURI);
	}

	/* Interface */
	function isRegistered(address _entry)
	external view override returns (bool)
	{
		return _exists(uint256(_entry)) || (address(previous) != address(0) && previous.isRegistered(_entry));
	}
}
