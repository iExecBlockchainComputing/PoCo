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
	public Registry(_previous)
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
		bytes32 salt = keccak256(abi.encodePacked(
			_workerpoolDescription
		));

		Workerpool workerpool = Workerpool(_create2(type(Workerpool).creationCode, salt));
		workerpool.setup(
			_workerpoolDescription
		);

		_mint(_workerpoolOwner, uint256(address(workerpool)));
		emit CreateWorkerpool(_workerpoolOwner, address(workerpool));

		return workerpool;
	}
}
