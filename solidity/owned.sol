pragma solidity ^0.4.19;

/*****************************************************************************
 * Contract owned: restrict execution to creator                             *
 *****************************************************************************/
contract owned
{
	address m_owner;
	function owned() public
	{
		m_owner = msg.sender;
	}
	modifier onlyOwner
	{
		require(msg.sender == m_owner);
		_;
	}
	function transferOwnership(address _newowner) onlyOwner
	{
		require(_newowner != address(0))
		m_owner = _newowner;
	}
}
