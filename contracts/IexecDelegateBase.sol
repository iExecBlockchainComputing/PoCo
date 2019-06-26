pragma solidity ^0.5.10;

import "./IexecStore.sol";


contract IexecDelegateBase is IexecStore
{
	constructor()
	public
	{
		renounceOwnership();
	}
}
