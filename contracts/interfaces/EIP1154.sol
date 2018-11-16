pragma solidity ^0.4.25;

interface OracleConsumer
{
	function receiveResult(bytes32 id, bytes result) external;
}

interface Oracle
{
	function resultFor(bytes32 id) external view returns (bytes result);
}
