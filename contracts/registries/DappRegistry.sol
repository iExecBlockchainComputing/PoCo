pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

import './Dapp.sol';
import "./RegistryBase.sol";

contract DappRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateDapp(
		address indexed dappOwner,
		address dapp,
		string  dappName,
		string  dappParams,
		bytes32 dappHash);

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
		string  _dappParams,
		bytes32 _dappHash)
	public /* onlyOwner /*owner == IexecHub*/ returns (Dapp)
	{
		Dapp newDapp = new Dapp(_dappOwner, _dappName, _dappParams, _dappHash);
		require(insert(newDapp, _dappOwner));
		emit CreateDapp(_dappOwner, newDapp, _dappName, _dappParams, _dappHash);
		return newDapp;
	}

}
