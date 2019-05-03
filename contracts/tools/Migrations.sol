pragma solidity ^0.5.8;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";

contract Migrations is Ownable
{
	uint256 public lastCompletedMigration;

	constructor()
	public
	{
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
}
