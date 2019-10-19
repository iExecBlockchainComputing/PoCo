pragma solidity ^0.5.0;

import './Registry.sol';
import './CounterfactualFactory.sol';
import './Workerpool.sol';


contract WorkerpoolRegistry is Registry, CounterfactualFactory
{
	event CreateWorkerpool(address indexed workerpoolOwner, address workerpool);

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
	function createWorkerpool(
		address          _workerpoolOwner,
		string  calldata _workerpoolDescription)
	external returns (Workerpool)
	{
		Workerpool workerpool = Workerpool(_create2(
			abi.encodePacked(
				type(Workerpool).creationCode,
				abi.encode(
					_workerpoolDescription
				)
			),
			bytes32(0)
		));

		_mint(_workerpoolOwner, uint256(address(workerpool)));
		emit CreateWorkerpool(_workerpoolOwner, address(workerpool));

		return workerpool;
	}
}
