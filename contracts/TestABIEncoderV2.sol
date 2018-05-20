pragma solidity ^0.4.21;
pragma experimental ABIEncoderV2;

contract TestABIEncoderV2
{

	struct UserMarket
	{
		uint256 category;
		uint256 trust;
		uint256 value;
		/* address app; */
		/* address dataset; */
		/* address callback; */
		/* address beneficiary; */
		/* address requester; */
		/* string  params; */
		/* uint256 salt; */
		/* uint8   v; */
		/* bytes32 r; */
		/* bytes32 s; */
	}

	/* function testABI() */
	function testABI(UserMarket usermarket)
	public pure returns(uint256)
	{
		/* return 42; */
		return usermarket.category;
	}
}
