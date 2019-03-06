pragma solidity ^0.5.5;

import './Workerpool.sol';
import './RegistryBase.sol';

contract WorkerpoolRegistry is RegistryBase //, OwnableMutable // is Owned by IexecHub
{
	event CreateWorkerpool(address indexed workerpoolOwner, address indexed workerpool, string workerpoolDescription);

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Pool creation
	 */
	function createWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external /* onlyOwner /*owner == IexecHub*/ returns (Workerpool)
	{
		Workerpool newWorkerpool = new Workerpool(
			_workerpoolOwner,
			_workerpoolDescription
		);
		require(insert(address(newWorkerpool), _workerpoolOwner));
		emit CreateWorkerpool(_workerpoolOwner, address(newWorkerpool), _workerpoolDescription);
		return newWorkerpool;
	}
}
