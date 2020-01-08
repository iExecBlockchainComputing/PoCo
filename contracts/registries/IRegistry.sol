pragma solidity ^0.5.0;

import "@openzeppelin/contracts/token/ERC721/IERC721Enumerable.sol";


contract IRegistry is IERC721Enumerable
{
	function isRegistered(address _entry) external view returns (bool);
}
