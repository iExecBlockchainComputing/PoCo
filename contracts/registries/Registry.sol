pragma solidity ^0.6.0;

import '@iexec/solidity/contracts/Factory/CounterfactualFactory.sol';
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import 'zos-lib/contracts/upgradeability/InitializableUpgradeabilityProxy.sol';
import "./IRegistry.sol";
import "../tools/ens/ReverseRegistration.sol";


contract Registry is IRegistry, ERC721Full, ReverseRegistration, Ownable, CounterfactualFactory
{
	address   public master;
	bytes     public proxyCode;
	IRegistry public previous;

	constructor(
		address       _master,
		string memory _name,
		string memory _symbol,
		address       _previous)
	public ERC721Full(_name, _symbol)
	{
		master    = _master;
		proxyCode = type(InitializableUpgradeabilityProxy).creationCode;
		previous  = IRegistry(_previous);
	}

	/* Factory */
	function _mintCreate(
		address      _owner,
		bytes memory _args)
	internal returns (uint256)
	{
		// Create entry (proxy)
		address entry = _create2(proxyCode, keccak256(abi.encodePacked(_args, _owner)));
		// Initialize entry (casting to address payable is a pain in ^0.6.0)
		InitializableUpgradeabilityProxy(address(uint160(entry))).initialize(master, _args);
		// Mint corresponding token
		_mint(_owner, uint256(entry));
		return uint256(entry);
	}

	/* Interface */
	function isRegistered(address _entry)
	external view returns (bool)
	{
		return _exists(uint256(_entry)) || (address(previous) != address(0) && previous.isRegistered(_entry));
	}

	function setName(address _ens, string calldata _name)
	external onlyOwner()
	{
		_setName(_ens, _name);
	}

	function setTokenURI(uint256 _tokenId, string calldata _uri)
	external
	{
		require(_msgSender() == ownerOf(_tokenId), "ERC721: access restricted to token owner");
		_setTokenURI(_tokenId, _uri);
	}
}
