pragma solidity ^0.4.18;
import './interfaces/IDappHub.sol';

contract DappHub is IDappHub {

  modifier onlyDappRegistered(){
      assert(dapps[msg.sender].provider != 0x0);
      _;
  }

  struct Dapp {
    string dappName;
    uint256 dappPrice;
    address provider;
    //TODO add type and uri where to find (docker, IPFS, iexec (in xtremweb server))
  }

  //mapping (dapp address => Dapp Struct)
  mapping (address => Dapp ) dapps ;

  function registerDappAndProvider(uint256 dappPrice,string dappName) public  returns (bool) {
      assert(dapps[msg.sender].provider == 0x0);
      assert(msg.sender != tx.origin);
      dapps[msg.sender].provider=tx.origin;
      dapps[msg.sender].dappPrice=dappPrice;
      dapps[msg.sender].dappName=dappName;
      Register(msg.sender,tx.origin,dappPrice,dappName);

      // TODO add a dappPrice ratio staking check for D(w)

      return true;
  }

  function getDapp(address dapp) constant public returns (string dappName, uint256 dappPrice, address provider) {
      return (
      dapps[dapp].dappName,
      dapps[dapp].dappPrice,
      dapps[dapp].provider
      );
  }

  function getProvider(address dapp) constant public returns (address provider) {
      return dapps[dapp].provider;
  }

  function getDappPrice(address dapp) constant public returns (uint256 dappPrice) {
      return dapps[dapp].dappPrice;
  }

  function getDappName(address dapp) constant public returns (string dappName) {
      return dapps[dapp].dappName;
  }


}
