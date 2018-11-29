pragma solidity ^0.5.0;

interface OracleConsumer
{
	function receiveResult(bytes32 id, bytes calldata result) external;
}

interface Oracle
{
	function resultFor(bytes32 id) external view returns (bytes memory result);
}
