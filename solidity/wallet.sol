pragma solidity ^0.4.19;

/*****************************************************************************
 * Contract wallet: ...                                                     *
 *****************************************************************************/
contract wallet
{
	/**
	 * Account structure
	 */
	struct Account
	{
		uint stake;
		uint locked;
	}
	/**
	 * Internal data: address to account mapping
	 */
	mapping(address => Account) m_accounts;
	/**
	 * Public functions
	 */
	function balance() public view returns(uint)
	{
		return m_accounts[msg.sender].stake;
	}
	function deposit() public payable
	{
		m_accounts[msg.sender].stake += msg.value;
	}
	function withdraw(uint _amount) public
	{
		require(_amount > 0  && m_accounts[msg.sender].stake >= _amount);
		m_accounts[msg.sender].stake -= _amount;
		msg.sender.transfer(_amount);
	}
	/**
	 * Internal function
	 */
	function lock(address _user, uint _amount) internal
	{
		require(m_accounts[_user].stake >= _amount);
		m_accounts[_user].stake  -= _amount;
		m_accounts[_user].locked += _amount;
	}
	function unlock(address _user, uint _amount) internal
	{
		require(m_accounts[_user].locked >= _amount);
		m_accounts[_user].locked -= _amount;
		m_accounts[_user].stake  += _amount;
	}
	function reward(address _user, uint _amount) internal
	{
		m_accounts[_user].stake += _amount;
	}
	function seize(address _user, uint _amount) internal
	{
		require(m_accounts[_user].locked >= _amount);
		m_accounts[_user].locked -= _amount;
	}
}
