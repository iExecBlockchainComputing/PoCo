pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import './Dapp.sol';
import "../tools/Ownable.sol";
import "../tools/SafeMathOZ.sol";

contract DappHub is OwnableMutable // is Owned by IexecHub
{

	using SafeMathOZ for uint256;

	/**
	 * Members
	 */
	mapping(address => uint256                    ) m_dappCountByOwner;
	mapping(address => mapping(uint256 => address)) m_dappByOwnerByIndex;
	mapping(address => bool                       ) m_dappRegistered;

	/**
	 * Constructor
	 */
	constructor()
	public
	{
	}

	/**
	 * Accessors
	 */
	function isDappRegistered(address _dapp)
	public view returns (bool)
	{
		return m_dappRegistered[_dapp];
	}

	function getDappsCount(address _owner)
	public view returns (uint256)
	{
		return m_dappCountByOwner[_owner];
	}

	function getDapp(address _owner, uint256 _index)
	public view returns (Dapp)
	{
		return Dapp(m_dappByOwnerByIndex[_owner][_index]);
	}

	/**
	 * Dapp creation
	 */
	function createApp(
		address _dappOwner,
		string  _dappName,
		string  _dappParams)
	public onlyOwner /*owner == IexecHub*/ returns (Dapp)
	{
		Dapp newApp = new Dapp(_dappOwner, _dappName, _dappParams);

		uint id = m_dappCountByOwner[_dappOwner].add(1);
		m_dappCountByOwner  [_dappOwner]     = id;
		m_dappByOwnerByIndex[_dappOwner][id] = newApp;
		m_dappRegistered    [newApp]         = true;

		return newApp;
	}

}
