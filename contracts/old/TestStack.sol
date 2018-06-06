pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

contract MyContract
{
	struct Agent
	{
		address reference;
		uint256 price;
	}
	struct WorkOrder
	{
		Agent   dapp;
		Agent   data;
		Agent   pool;
		uint256 D;
		uint256 E;
		address F;
		address G;
		address H;
		string  I;
		uint256 J;
		uint256 K;
	}

	mapping(bytes32 => WorkOrder) public m_structs;

	constructor() public
	{
	}
}



/*
pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

contract MyContract
{
	struct MyStruct
	{
		address A_address;
		uint256 A_value;
		address B_address;
		uint256 B_value;
		address C_address;
		uint256 C_value;
		uint256 D;
		uint256 E;
		address F;
		address G;
		address H;
		string  I;
		uint256 J;
		uint256 K;
	}

	mapping(bytes32 => MyStruct) public m_structs;

	constructor() public
	{
	}
}
*/
