pragma solidity ^0.4.18;

contract TestSha
{
	event SolidityKeccak256FromBytes  (bytes32 result, bytes32 input);
	event SolidityKeccak256FromString (bytes32 result, string  input);
	event SolidityKeccak256FromAddress(bytes32 result, address input);

	event SignedVote(
		bytes32 input,
		address voter,
		bytes32 vote,
		bytes32 sign
	);

	function testSolidityKeccak256FromBytes(bytes32 _input) public
	{
		SolidityKeccak256FromBytes(keccak256(_input), _input);
	}

	function testSolidityKeccak256FromString(string _input) public
	{
		SolidityKeccak256FromString(keccak256(_input), _input);
	}

	function testSolidityKeccak256FromAddress(address _input) public
	{
		SolidityKeccak256FromAddress(keccak256(_input), _input);
	}

	function testSignedVote(bytes32 _result) public
	{
		bytes32 vote = keccak256(_result                        );
		bytes32 sign = keccak256(_result ^ keccak256(msg.sender));
		SignedVote(_result, msg.sender, vote, sign);
	}
}
