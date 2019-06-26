pragma solidity ^0.5.0;

import "./ERC1538Store.sol";


interface ERC1538Query
{
	function totalFunctions            (                           ) external view returns(uint256);
	function functionByIndex           (uint256          _index    ) external view returns(string memory, bytes4, address);
	function functionById              (bytes4           _id       ) external view returns(string memory, bytes4, address);
	function functionExists            (string  calldata _signature) external view returns(bool);
	function functionSignatures        (                           ) external view returns(string memory);
	function delegateFunctionSignatures(address          _delegate ) external view returns(string memory);
	function delegateAddress           (string  calldata _signature) external view returns(address);
	function delegateAddresses         (                           ) external view returns(address[] memory);
}

contract ERC1538QueryDelegate is ERC1538Query, ERC1538Store
{
	function totalFunctions()
	external view returns(uint256)
	{
		return m_funcSignatures.length;
	}

	function functionByIndex(uint256 _index)
	external view returns(string memory signature, bytes4 id, address delegate)
	{
		require(_index < m_funcSignatures.length, "functionSignatures index does not exist.");
		id = bytes4(keccak256(m_funcSignatures[_index]));
		return (string(m_funcSignatures[_index]), id, m_delegates[id]);
	}

	function functionById(bytes4 _id)
	external view returns(string memory signature, bytes4 id, address delegate)
	{
		for (uint256 index = 0; index < m_funcSignatures.length; ++index)
		{
			if (_id == bytes4(keccak256(m_funcSignatures[index])))
			{
				return (string(m_funcSignatures[index]), _id, m_delegates[_id]);
			}
		}
		revert("functionId not found");
	}

	function functionExists(string calldata _signature)
	external view returns(bool)
	{
		return m_funcSignatureToIndex[bytes(_signature)] != 0;
	}

	function functionSignatures()
	external view returns(string memory)
	{
		uint256 signaturesLength;
		bytes memory signatures;
		bytes memory signature;
		uint256 functionIndex;
		uint256 charPos;
		uint256 funcSignaturesNum = m_funcSignatures.length;
		bytes[] memory memoryFuncSignatures = new bytes[](funcSignaturesNum);
		for (; functionIndex < funcSignaturesNum; ++functionIndex)
		{
			signature = m_funcSignatures[functionIndex];
			signaturesLength += signature.length + 1; // EDIT
			memoryFuncSignatures[functionIndex] = signature;
		}
		signatures = new bytes(signaturesLength);
		functionIndex = 0;
		for (; functionIndex < funcSignaturesNum; ++functionIndex)
		{
			signature = memoryFuncSignatures[functionIndex];
			for (uint256 i = 0; i < signature.length; ++i)
			{
				signatures[charPos] = signature[i];
				charPos++;
			}
			signatures[charPos] = 0x3B; // EDIT: extra ';'
			charPos++; // EDIT
		}
		return string(signatures);
	}

	function delegateFunctionSignatures(address _delegate)
	external view returns(string memory)
	{
		uint256 funcSignaturesNum = m_funcSignatures.length;
		bytes[] memory delegateSignatures = new bytes[](funcSignaturesNum);
		uint256 delegateSignaturesPos;
		uint256 signaturesLength;
		bytes memory signatures;
		bytes memory signature;
		uint256 functionIndex;
		uint256 charPos;
		for (; functionIndex < funcSignaturesNum; ++functionIndex)
		{
			signature = m_funcSignatures[functionIndex];
			if (_delegate == m_delegates[bytes4(keccak256(signature))])
			{
				signaturesLength += signature.length;
				delegateSignatures[delegateSignaturesPos] = signature;
				++delegateSignaturesPos;
			}
		}
		signatures = new bytes(signaturesLength);
		functionIndex = 0;
		for (; functionIndex < delegateSignatures.length; ++functionIndex)
		{
			signature = delegateSignatures[functionIndex];
			if (signature.length == 0)
			{
				break;
			}
			for (uint256 i = 0; i < signature.length; ++i)
			{
				signatures[charPos] = signature[i];
				++charPos;
			}
		}
		return string(signatures);
	}

	function delegateAddress(string calldata _signature)
	external view returns(address)
	{
		require(m_funcSignatureToIndex[bytes(_signature)] != 0, "Function signature not found.");
		return m_delegates[bytes4(keccak256(bytes(_signature)))];
	}

	function delegateAddresses()
	external view returns(address[] memory)
	{
		uint256 funcSignaturesNum = m_funcSignatures.length;
		address[] memory delegatesBucket = new address[](funcSignaturesNum);
		uint256 numDelegates;
		uint256 functionIndex;
		bool foundDelegate;
		address delegate;
		for (; functionIndex < funcSignaturesNum; ++functionIndex)
		{
			delegate = m_delegates[bytes4(keccak256(m_funcSignatures[functionIndex]))];
			for (uint256 i = 0; i < numDelegates; ++i)
			{
				if (delegate == delegatesBucket[i])
				{
					foundDelegate = true;
					break;
				}
			}
			if (foundDelegate == false)
			{
				delegatesBucket[numDelegates] = delegate;
				++numDelegates;
			}
			else
			{
				foundDelegate = false;
			}
		}
		address[] memory delegates_ = new address[](numDelegates);
		functionIndex = 0;
		for (; functionIndex < numDelegates; ++functionIndex)
		{
			delegates_[functionIndex] = delegatesBucket[functionIndex];
		}
		return delegates_;
	}
}
