pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC721/ERC721Enumerable.sol";
import 'zos-lib/contracts/upgradeability/InitializableUpgradeabilityProxy.sol';
import 'iexec-solidity/contracts/Factory/CounterfactualFactory.sol';
import "./IRegistry.sol";
import "../tools/ens/ReverseRegistration.sol";


contract Registry is IRegistry, ERC721Enumerable, ReverseRegistration, Ownable, CounterfactualFactory
{
	address   public master;
	bytes     public proxyCode;
	string    public name;
	string    public symbol;
	IRegistry public previous;

	constructor(address _master, string memory _name, string memory _symbol, address _previous)
	public
	{
		master    = _master;
		proxyCode = type(InitializableUpgradeabilityProxy).creationCode;
		name      = _name;
		symbol    = _symbol;
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
		// Initialize entry (casting to address payable is a pain in ^0.5.0)
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
}
