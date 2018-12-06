pragma solidity ^0.5.0;

import "./Ownable.sol";

contract Migrations
{
	address public owner;
	uint256 public lastCompletedMigration;

	modifier onlyOwner() {
		require (msg.sender == owner);
		_;
	}

	constructor() public {
		owner = msg.sender;
	}
	
	function setCompleted(uint completed) public onlyOwner
	{
		lastCompletedMigration = completed;
	}

	function upgrade(address newAddress) public onlyOwner
	{
		Migrations upgraded = Migrations(newAddress);
		upgraded.setCompleted(lastCompletedMigration);
	}

	function transferOwnership(address newOwner) public onlyOwner {
		if (newOwner != address(0)) owner = newOwner;
	}
}
