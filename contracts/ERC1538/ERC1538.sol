pragma solidity ^0.5.10;

import "./ERC1538Store.sol";


interface ERC1538
{
	event CommitMessage(string message);
	event FunctionUpdate(bytes4 indexed functionId, address indexed oldDelegate, address indexed newDelegate, string functionSignature);
	function updateContract(address _delegate, string calldata _functionSignatures, string calldata commitMessage) external;
}

contract ERC1538Delegate is ERC1538, ERC1538Store
{
	function updateContract(
		address         _delegate,
		string calldata _functionSignatures,
		string calldata _commitMessage
	)
	external onlyOwner
	{
		bytes memory signatures = bytes(_functionSignatures);
		uint256 start;
		uint256 pos;
		uint256 end;
		uint256 size;

		if (_delegate != address(0))
		{
			assembly
			{
				size := extcodesize(_delegate)
			}
			require(size > 0, "[ERC1538] _delegate address is not a contract and is not address(0)");
		}
		assembly
		{
			start := add(signatures, 32)
			end   := add(start, mload(signatures))
		}
		for (pos = start; pos < end; ++pos)
		{
			uint256 char;
			assembly
			{
				char := byte(0, mload(pos))
			}
			if (char == 0x3B) // 0x3B = ';'
			{
				size = (pos - start);
				assembly
				{
					mstore(signatures, size)
				}
				bytes4  funcId      = bytes4(keccak256(signatures));
				address oldDelegate = m_delegates[funcId];
				if (_delegate == address(0))
				{
					uint256 index = m_funcSignatureToIndex[signatures];
					require(index != 0, "[ERC1538] function does not exist.");
					index--;
					uint256 lastIndex = m_funcSignatures.length - 1;
					if (index != lastIndex)
					{
						m_funcSignatures[index] = m_funcSignatures[lastIndex];
						m_funcSignatureToIndex[m_funcSignatures[lastIndex]] = index + 1;
					}
					m_funcSignatures.length--;
					delete m_funcSignatureToIndex[signatures];
					delete m_delegates[funcId];
					emit FunctionUpdate(funcId, oldDelegate, address(0), string(signatures));
				}
				else if (m_funcSignatureToIndex[signatures] == 0)
				{
					require(oldDelegate == address(0), "[ERC1538] funcId clash.");
					m_delegates[funcId] = _delegate;
					m_funcSignatures.push(signatures);
					m_funcSignatureToIndex[signatures] = m_funcSignatures.length;
					emit FunctionUpdate(funcId, address(0), _delegate, string(signatures));
				}
				else if (m_delegates[funcId] != _delegate)
				{
					m_delegates[funcId] = _delegate;
					emit FunctionUpdate(funcId, oldDelegate, _delegate, string(signatures));
				}
				assembly
				{
					signatures := add(signatures, add(size, 1))
				}
				start = ++pos;
			}
		}
		emit CommitMessage(_commitMessage);
	}
}
