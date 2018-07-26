pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import './Dapp.sol';
import "./RegistryBase.sol";

contract DappRegistry is RegistryBase
{
	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Dapp creation
	 */
	function createDapp(
		address _dappOwner,
		string  _dappName,
		string  _dappParams)
	public onlyOwner /*owner == IexecHub*/ returns (Dapp)
	{
		Dapp newDapp = new Dapp(_dappOwner, _dappName, _dappParams);
		require(insert(newDapp, _dappOwner));
		return newDapp;
	}

}
