pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import './Dapp.sol';
import "./RegistryBase.sol";

contract DappRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateDapp(address indexed dappOwner, address indexed dapp, string dappName, string dappParams);

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
	public /* onlyOwner /*owner == IexecHub*/ returns (Dapp)
	{
		Dapp newDapp = new Dapp(_dappOwner, _dappName, _dappParams);
		require(insert(newDapp, _dappOwner));
		emit CreateDapp(_dappOwner, newDapp, _dappName, _dappParams);
		return newDapp;
	}

}
