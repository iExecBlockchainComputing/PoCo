pragma solidity ^0.4.18;
contract TestSha {

    	event SolidityKeccak256FromString(bytes32  result, string input);
    	event SolidityKeccak256FromBytes(bytes32  result, bytes32 input);

      function testSolidityKeccak256FromString(string input) {
        SolidityKeccak256FromString(keccak256(input),input);
      }

      function testSolidityKeccak256FromBytes(bytes32 input) {
        SolidityKeccak256FromBytes(keccak256(input),input);
      }

}
