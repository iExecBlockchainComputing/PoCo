pragma solidity ^0.5.0;


contract IOwnable
{
	function owner() public view returns (address);

	modifier onlyOwner()
	{
		require(owner() == msg.sender, 'caller is not the owner');
		_;
	}
}
