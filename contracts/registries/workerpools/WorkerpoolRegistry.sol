pragma solidity ^0.6.0;

import '../Registry.sol';
import './Workerpool.sol';


contract WorkerpoolRegistry is Registry
{
	/**
	 * Constructor
	 */
	constructor()
	public Registry(
		address(new Workerpool()),
		"iExec Workerpool Registry (V5)",
		"iExecWorkerpoolV5")
	{
	}

	/**
	 * Pool creation
	 */
	function createWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external returns (Workerpool)
	{
		return Workerpool(_mintCreate(
			_workerpoolOwner,
			abi.encodeWithSignature(
				"initialize(string)",
				_workerpoolDescription
			)
		));
	}
}
