pragma solidity ^0.4.8;

contract SafeMath {
	function safeMul(uint a, uint b) internal pure returns (uint) {
		uint c = a * b;
		require(a == 0 || c / a == b);
		return c;
	}

	function safeDiv(uint a, uint b) internal pure returns (uint) {
		require(b > 0);
		uint c = a / b;
		require(a == b * c + a % b);
		return c;
	}

	function safeSub(uint a, uint b) internal pure returns (uint) {
		require(b <= a);
		return a - b;
	}

	function safeAdd(uint a, uint b) internal pure returns (uint) {
		uint c = a + b;
		require(c>=a && c>=b);
		return c;
	}

	function max64(uint64 a, uint64 b) internal pure returns (uint64) {
		return a >= b ? a : b;
	}

	function min64(uint64 a, uint64 b) internal pure returns (uint64) {
		return a < b ? a : b;
	}

	function max256(uint256 a, uint256 b) internal pure returns (uint256) {
		return a >= b ? a : b;
	}

	function min256(uint256 a, uint256 b) internal pure returns (uint256) {
		return a < b ? a : b;
	}
}
