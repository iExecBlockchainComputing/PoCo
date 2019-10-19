pragma solidity ^0.5.0;

import '../factory/CounterfactualFactory.sol';
import './Registry.sol';
import './Workerpool.sol';


contract WorkerpoolRegistry is Registry, CounterfactualFactory
{
	event CreateWorkerpool(address indexed workerpoolOwner, address workerpool);

	/**
	 * Constructor
	 */
	constructor(address _owner, address _previous)
	public Registry(_owner, "iExec Workerpool Registry (v4)", "iExecWorkerpoolV4", _previous)
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
