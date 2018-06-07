pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "../tools/SafeMathOZ.sol";

contract DappRegistry
{

	using SafeMathOZ for uint256;

	/**
	 * Struct
	 */
	struct Dapp
	{
		string name;
		string params;
	}

	/**
	 * Mapping
	 */
	mapping(bytes32 => Dapp                       ) m_dappRegistry;
	mapping(bytes32 => address                    ) m_dappOwnerPerIndex;
	mapping(bytes32 => uint256                    ) m_dappLocalPerIndex;
	mapping(address => uint256                    ) m_dappCountPerOwner;
	mapping(address => mapping(uint256 => bytes32)) m_dappIndexPerOwner;

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
	function viewDapp(bytes32 _index)
	public view returns (Dapp)
	{
		return m_dappRegistry[_index];
	}

	function ownerPerIndex(bytes32 _index)
	public view returns (address)
	{
		return m_dappOwnerPerIndex[_index];
	}

	function localPerIndex(bytes32 _index)
	public view returns (uint256)
	{
		return m_dappLocalPerIndex[_index];
	}

	function countPerOwner(address _owner)
	public view returns (uint256)
	{
		return m_dappCountPerOwner[_owner];
	}

	function indexPerOwner(address _owner, uint256 _local)
	public view returns (bytes32)
	{
		return m_dappIndexPerOwner[_owner][_local];
	}

	/**
	 * Methods
	 */
	function addDapp(Dapp _dapp)
	public returns (bytes32)
	{
		address owner = msg.sender;
		bytes32 index = keccak256(_dapp.name, _dapp.params, now);
		uint256 local = m_dappCountPerOwner[owner].add(1);

		m_dappRegistry     [index]        = _dapp;
		m_dappOwnerPerIndex[index]        = owner;
		m_dappLocalPerIndex[index]        = local;
		m_dappCountPerOwner[owner]        = local;
		m_dappIndexPerOwner[owner][local] = index;

		return index;
	}

	function transferDapp(bytes32 _index, address _newOwner)
	public returns (bool)
	{
		address owner = m_dappOwnerPerIndex[_index];

		require(msg.sender == owner);

		m_dappOwnerPerIndex[_index] = _newOwner;

		uint256 oldLocal  = m_dappLocalPerIndex[_index];
		uint256 lastLocal = m_dappCountPerOwner[owner].sub(1);
		bytes32 lastIndex = m_dappIndexPerOwner[owner][lastLocal];
		m_dappLocalPerIndex[lastIndex]           = oldLocal;
		m_dappCountPerOwner[owner    ]           = lastLocal;
		m_dappIndexPerOwner[owner    ][oldLocal] = lastIndex;
		delete m_dappIndexPerOwner[owner][lastLocal];

		uint256 newLocal = m_dappCountPerOwner[_newOwner].add(1);
		m_dappLocalPerIndex[_index   ]           = newLocal;
		m_dappCountPerOwner[_newOwner]           = newLocal;
		m_dappIndexPerOwner[_newOwner][newLocal] = _index;

		return true;
	}

}
