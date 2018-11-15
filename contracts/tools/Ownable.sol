pragma solidity ^0.4.25;

contract OwnableImmutable
{
	address public m_owner;

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
	constructor(address _owner) public
	{
		m_owner = _owner;
	}
}

contract OwnableMutable is OwnableImmutable
{
	event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

	/**
	 * @dev The Ownable constructor sets the original `owner` of the contract to the sender
	 * account.
	 */
	constructor() public
	OwnableImmutable(msg.sender)
	{
	}

	/**
	 * @dev Allows the current owner to transfer control of the contract to a newOwner.
	 * @param _newOwner The address to transfer ownership to.
	 */
	function transferOwnership(address _newOwner)
	public onlyOwner
	{
		require(_newOwner != address(0));
		emit OwnershipTransferred(m_owner, _newOwner);
		m_owner = _newOwner;
	}
}
