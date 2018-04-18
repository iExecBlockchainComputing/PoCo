pragma solidity ^0.4.21;

contract IexecCallbackInterface
{
	
	function workOrderCallback(
		address _woid,
		string  _stdout,
		string  _stderr,
		string  _uri) public returns (bool);

	event WorkOrderCallback(address woid, string stdout, string stderr, string uri);
}
