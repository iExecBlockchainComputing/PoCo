pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

import "../tools/SafeMathOZ.sol";

contract DataRegistry
{

	using SafeMathOZ for uint256;

	/**
	 * Struct
	 */
	struct Data
	{
		string name;
		string params;
	}

	/**
	 * Mapping
	 */
	mapping(bytes32 => Data                       ) m_dataRegistry;
	mapping(bytes32 => address                    ) m_dataOwnerPerIndex;
	mapping(bytes32 => uint256                    ) m_dataLocalPerIndex;
	mapping(address => uint256                    ) m_dataCountPerOwner;
	mapping(address => mapping(uint256 => bytes32)) m_dataIndexPerOwner;

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
	function viewData(bytes32 _index)
	public view returns (Data)
	{
		return m_dataRegistry[_index];
	}

	function ownerPerIndex(bytes32 _index)
	public view returns (address)
	{
		return m_dataOwnerPerIndex[_index];
	}

	function localPerIndex(bytes32 _index)
	public view returns (uint256)
	{
		return m_dataLocalPerIndex[_index];
	}

	function countPerOwner(address _owner)
	public view returns (uint256)
	{
		return m_dataCountPerOwner[_owner];
	}

	function indexPerOwner(address _owner, uint256 _local)
	public view returns (bytes32)
	{
		return m_dataIndexPerOwner[_owner][_local];
	}

	/**
	 * Methods
	 */
	function addData(Data _data)
	public returns (bytes32)
	{
		address owner = msg.sender;
		bytes32 index = keccak256(_data.name, _data.params, now);
		uint256 local = m_dataCountPerOwner[owner].add(1);

		m_dataRegistry     [index]        = _data;
		m_dataOwnerPerIndex[index]        = owner;
		m_dataLocalPerIndex[index]        = local;
		m_dataCountPerOwner[owner]        = local;
		m_dataIndexPerOwner[owner][local] = index;

		return index;
	}

	function transferData(bytes32 _index, address _newOwner)
	public returns (bool)
	{
		address owner = m_dataOwnerPerIndex[_index];

		require(msg.sender == owner);

		m_dataOwnerPerIndex[_index] = _newOwner;

		uint256 oldLocal  = m_dataLocalPerIndex[_index];
		uint256 lastLocal = m_dataCountPerOwner[owner].sub(1);
		bytes32 lastIndex = m_dataIndexPerOwner[owner][lastLocal];
		m_dataLocalPerIndex[lastIndex]           = oldLocal;
		m_dataCountPerOwner[owner    ]           = lastLocal;
		m_dataIndexPerOwner[owner    ][oldLocal] = lastIndex;
		delete m_dataIndexPerOwner[owner][lastLocal];

		uint256 newLocal = m_dataCountPerOwner[_newOwner].add(1);
		m_dataLocalPerIndex[_index   ]           = newLocal;
		m_dataCountPerOwner[_newOwner]           = newLocal;
		m_dataIndexPerOwner[_newOwner][newLocal] = _index;

		return true;
	}

}
