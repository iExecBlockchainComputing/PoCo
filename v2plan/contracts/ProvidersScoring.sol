pragma solidity ^0.4.18;
import "./SafeMathOZ.sol";
contract ProvidersScoring
{
	using SafeMathOZ for uint256;
	mapping(address => uint256) public m_score;

	function score(address _user) public view returns (uint256)
	{
		return m_score[_user];
	}
	function scoreWin(address _user, uint256 _value) internal returns (bool)
	{
		m_score[_user] = m_score[_user].add(_value);
		return true;
	}
	function scoreLose(address _user, uint256 _value) internal returns (bool)
	{
		m_score[_user] = m_score[_user].sub(_value.min256(m_score[_user]));
		return true;
	}
}
