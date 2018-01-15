pragma solidity ^0.4.18;

import './OwnableOZ.sol';
import './IexecHubInterface.sol';

contract Dapp is OwnableOZ, IexecHubInterface //Owned by a D(w){
{
	string   public  dappName;
	uint256  public  dappPrice;
	string   public  dappParam;
	string   public  dappUri;

	//TODO add black and white listing possible by owner
	//TODO add OPEN and CLOSE STATUS for dappUri maintenance

	//constructor
	function Dapp(
		address _iexecHubAddress,
		string  _dappName,
		uint256 _dappPrice,
		string  _dappParam,
		string  _dappUri)
	IexecHubInterface(_iexecHubAddress)
	public
	{
		// tx.origin == owner
		// msg.sender == DatasetHub
		require(tx.origin != msg.sender);
		transferOwnership(tx.origin); // owner → tx.origin

		dappName  = _dappName;
		dappPrice = _dappPrice;
		dappParam = _dappParam;
		dappUri   = _dappUri;
	}

}
