pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

contract TestABI
{
	struct Entry
	{
		uint256 a;
		address b;
		uint8   c;
		bytes32 d;
		bytes32 e;
	}

	mapping(bytes32 => address) public m_owners;
	mapping(bytes32 => Entry  ) public m_entries;

	constructor() public
	{
	}

	function viewData(bytes32 key) public view returns (Entry)
	{
		return m_entries[key];
	}

	function pushData(bytes32 key, Entry entry) public
	{
		require(m_owners[key] == address(0) || m_owners[key] == msg.sender);
		m_owners [key] = msg.sender;
		m_entries[key] = entry;
	}

	function deleteData(bytes32 key) public
	{
		require(m_owners[key] == msg.sender);
		delete m_owners [key];
		delete m_entries[key];
	}

}
