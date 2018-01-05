pragma solidity ^0.4.19;


contract IScoring
{
	function score(address _user) public view returns (uint);
	function scoreWin(address _user, uint _value) internal returns (bool);
	function scoreLose(address _user, uint _value) internal returns (bool);
}
