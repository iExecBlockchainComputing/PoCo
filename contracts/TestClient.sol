pragma solidity ^0.5.0;

import "./interfaces/IERC1154.sol";

contract TestClient is IOracleConsumer
{
	event GotResult(bytes32 indexed id, bytes result);

	mapping(bytes32 => bytes) public store;

	constructor()
	public
	{
	}

	function receiveResult(bytes32 id, bytes calldata result) external
	{
		store[id] = result;
		emit GotResult(id, result);
	}

}
