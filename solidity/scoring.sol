pragma solidity ^0.4.19;

import "./SafeMath.sol";s

contract scoring
{
	mapping(address => uint) public m_score;

	function score(address _user) public view returns (uint)
	{
		return m_score[_user];
	}
	function scoreWin(address _user, uint _value) internal returns (bool)
	{
		m_score[_user] = safeAdd(m_score[_user], _value);
		return true;
	}
	function scoreLose(address _user, uint _value) internal returns (bool)
	{
		m_score[_user] = safeSub(m_score[_user], min256(m_score[_user], _value));
		return true;
	}
}
