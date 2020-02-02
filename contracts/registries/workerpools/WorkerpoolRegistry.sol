pragma solidity ^0.6.0;

import '../Registry.sol';
import './Workerpool.sol';


contract WorkerpoolRegistry is Registry
{
	/**
	 * Constructor
	 */
	constructor(address _previous)
	public Registry(
		address(new Workerpool()),
		"iExec Workerpool Registry (v4)",
		"iExecWorkerpoolV4",
		_previous)
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
