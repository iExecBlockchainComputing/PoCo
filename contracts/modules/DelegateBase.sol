pragma solidity ^0.5.0;

import "../Store.sol";


contract DelegateBase is Store
{
	constructor()
	public
	{
		renounceOwnership();
	}
}
