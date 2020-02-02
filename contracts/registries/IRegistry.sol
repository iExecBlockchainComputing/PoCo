pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol";


contract IRegistry is IERC721Enumerable
{
	constructor() internal {}

	function isRegistered(address _entry) external view returns (bool);
}
