pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Enumerable.sol";
import "../tools/ENSReverseRegistration.sol";


contract IRegistry is IERC721Enumerable
{
	function isRegistered(address _entry) external view returns (bool);
}

contract Registry is IRegistry, ERC721Enumerable, ENSReverseRegistration, Ownable
{

	IRegistry public previous;

	/**
	 * Constructor
	 */
	constructor(address _previous)
	public
	{
		previous = IRegistry(_previous);
	}

	/**
	 * Accessors
	 */
	function isRegistered(address _entry)
	public view returns (bool)
	{
		return _exists(uint256(_entry)) || (address(previous) != address(0) && previous.isRegistered(_entry));
	}
}
