pragma solidity ^0.4.18;

/**
 * @title Ownable
 * @dev The Ownable contract has an owner address, and provides basic authorization control
 * functions, this simplifies the implementation of "user permissions".
 */
contract OwnableOZ
{
	address public m_owner;

	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	/**
	 * @dev Throws if called by any account other than the owner.
	 */
	modifier onlyOwner()
	{
		require(msg.sender == m_owner);
		_;
	}

	/**
	 * @dev The Ownable constructor sets the original `owner` of the contract to the sender
	 * account.
	 */
	function OwnableOZ(address _owner) public
	{

		require(_owner != address(0));
		m_owner = _owner;
	}

	/**
	 * @dev Allows the current owner to transfer control of the contract to a newOwner.
	 * @param newOwner The address to transfer ownership to.
	 */
	function transferOwnership(address _newOwner) public onlyOwner
	{
		require(_newOwner != address(0));
		OwnershipTransferred(m_owner, _newOwner);
		m_owner = _newOwner;
	}

}
