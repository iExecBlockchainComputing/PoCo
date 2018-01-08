pragma solidity ^0.4.18;

contract IStake
{
	/**
	 * Public functions
	 */
	function deposit(uint _amount) public returns (bool);
	function withdraw(uint _amount) public returns (bool);
	function checkBalance() public view returns (uint, uint);
	/**
	 * Internal function
	 */
	function lock  (address _user, uint _amount) internal returns (bool);
	function unlock(address _user, uint _amount) internal returns (bool);
	function reward(address _user, uint _amount) internal returns (bool);
	function seize (address _user, uint _amount) internal returns (bool);
    function debit(address _user, uint _amount) internal returns (bool);

}
