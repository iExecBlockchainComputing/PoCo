pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Enumerable.sol";
import 'iexec-solidity/contracts/Factory/CounterfactualFactory.sol';
import "./IRegistry.sol";
import "../tools/ENSReverseRegistration.sol";


contract Registry is IRegistry, ERC721Enumerable, ENSReverseRegistration, Ownable, CounterfactualFactory
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

	/* Factory */
	function _creationCode()
	internal pure returns (bytes memory);

	function _mintCreate(
		address      _owner,
		bytes memory _args)
	internal returns (uint256)
	{
		uint256 tokenid = uint256(_create2(
			abi.encodePacked(
				_creationCode(),
				_args
			),
			bytes32(uint256(_owner))
		));
		_mint(_owner, tokenid);
		return tokenid;
	}

	/* Interface */
	function creationCode()
	external pure returns (bytes memory)
	{
		return _creationCode();
	}

	function isRegistered(address _entry)
	external view returns (bool)
	{
		return _exists(uint256(_entry)) || (address(previous) != address(0) && previous.isRegistered(_entry));
	}

	function ENSReverseRegister(address _ens, string calldata _name)
	external onlyOwner()
	{
		_ENSReverseRegister(_ens, _name);
	}
}
