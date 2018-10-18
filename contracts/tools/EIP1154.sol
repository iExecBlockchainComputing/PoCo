pragma solidity ^0.4.24;
pragma experimental ABIEncoderV2;

interface OracleConsumer
{
	function receiveResult(bytes32 id, bytes result) external;
}

interface Oracle
{
	function resultFor(bytes32 id) external view returns (bytes result);
}
