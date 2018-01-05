pragma solidity ^0.4.18;

contract IDappHub{

  event Register(address indexed dapp, address indexed provider,uint256 dappPrice, string dappName);

  function registerDappAndProvider(uint256 dappPrice,string dappName) public returns (bool) ;

  function getDapp(address dapp) view public returns (string dappName, uint256 dappPrice, address provider);

  function getProvider(address dapp) view public returns (address provider);

  function getDappPrice(address dapp) view public returns (uint256 dappPrice);

  function getDappName(address dapp) view public returns (string dappName);

  // TO COMPLETE

}
