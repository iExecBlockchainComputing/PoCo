pragma solidity ^0.4.25;

import "./tools/EIP1154.sol";

contract TestClient //is OracleConsumer
{
	event GotResult(bytes32 indexed id, bytes result);

	mapping(bytes32 => bytes) public store;

	constructor()
	public
	{
	}

	function receiveResult(bytes32 id, bytes result) external
	{
		store[id] = result;
		emit GotResult(id, result);
	}

}
