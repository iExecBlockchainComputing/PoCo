pragma solidity ^0.5.0;

import './Workerpool.sol';
import './CounterfactualFactory.sol';
import './RegistryBase.sol';


contract WorkerpoolRegistry is CounterfactualFactory, RegistryBase, ENSReverseRegistrationOwnable
{
	event CreateWorkerpool(address indexed workerpoolOwner, address workerpool);

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
	external returns (Workerpool)
	{
		bytes32 salt = keccak256(abi.encodePacked(
			_workerpoolDescription
		));

		Workerpool workerpool = Workerpool(_create2(type(Workerpool).creationCode, salt));
		workerpool.setup(
			_workerpoolOwner,
			_workerpoolDescription
		);

		insert(address(workerpool), _workerpoolOwner);
		emit CreateWorkerpool(_workerpoolOwner, address(workerpool));

		return workerpool;
	}
}
