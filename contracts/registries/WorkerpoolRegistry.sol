pragma solidity ^0.5.0;

import './Registry.sol';
import './Workerpool.sol';


contract WorkerpoolRegistry is Registry
{
	/**
	 * Constructor
	 */
	constructor(address _previous)
	public Registry("iExec Workerpool Registry (v4)", "iExecWorkerpoolV4", _previous)
	{
	}

	/**
	 * Pool creation
	 */
	function _creationCode()
	internal pure returns (bytes memory)
	{
		return type(Workerpool).creationCode;
	}

	function createWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external returns (Workerpool)
	{
		return Workerpool(_mintCreate(
			_workerpoolOwner,
			abi.encode(
					_workerpoolDescription
			)
		));
	}
}
