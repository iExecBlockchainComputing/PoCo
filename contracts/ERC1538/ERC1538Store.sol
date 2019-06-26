pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";


contract ERC1538Store is Ownable
{
	// maps functions to the delegate contracts that execute the functions
	// funcId => delegate contract
	mapping(bytes4 => address) internal m_delegates;

	// array of function signatures supported by the contract
	bytes[] internal m_funcSignatures;

	// maps each function signature to its position in the funcSignatures array.
	// signature => index+1
	mapping(bytes => uint256) internal m_funcSignatureToIndex;

}
