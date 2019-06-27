pragma solidity ^0.5.10;

import "../Store.sol";


contract DelegateBase is Store
{
	constructor()
	public
	{
		renounceOwnership();
	}
}
