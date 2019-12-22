pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Enumerable.sol";
import "./IRegistry.sol";
import "../tools/ENSReverseRegistration.sol";


contract Registry is IRegistry, ERC721Enumerable, ENSReverseRegistration, Ownable
{
	IRegistry public previous;
	string    public name;
	string    public symbol;

	constructor(string memory _name, string memory _symbol, address _previous)
	public
	{
		previous = IRegistry(_previous);
		name     = _name;
		symbol   = _symbol;
	}

	function isRegistered(address _entry)
	public view returns (bool)
	{
		return _exists(uint256(_entry)) || (address(previous) != address(0) && previous.isRegistered(_entry));
	}

	function ENSReverseRegister(address _ens, string calldata _name)
	external onlyOwner()
	{
		_ENSReverseRegister(_ens, _name);
	}
}
