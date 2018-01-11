pragma solidity ^0.4.18;

import './Dapp.sol';
import "rlc-token/contracts/Ownable.sol";
import "./SafeMathOZ.sol";
contract DappHub is Ownable // is Owned by IexecHub
{
  using SafeMathOZ for uint256;
  event CreateDapp(address indexed dappOwner, address indexed dapp, string dappName,uint256 dappPrice, string dappParam, string dappUri);

  // owner => dapps count
	mapping (address => uint256) m_dappsCountByOwner;

  // owner => index => dapp
  mapping (address => mapping (uint256 => address)) m_dappByOwnerByIndex;

  //  dapp => owner
  mapping (address => address) m_ownerByDapp;

	function getDappsCount(address _owner) view public returns (uint256)
	{
		return m_dappsCountByOwner[_owner];
	}

  function getDapp(address _owner,uint256 _index) view public returns (address)
  {
    return m_dappByOwnerByIndex[_owner][_index];
  }

  function getDappOwner(address _dapp) view public returns (address)
  {
    return m_ownerByDapp[_dapp];
  }

  function isDappRegistred(address _dapp) view public returns (bool)
  {
    return m_ownerByDapp[_dapp] != 0x0;
  }

	function createDapp(string _dappName, uint256 _dappPrice, string _dappParam, string _dappUri) public onlyOwner /*owner == IexecHub*/ returns(address createdDapp)
	{
    // tx.origin == owner
    // msg.sender == IexecHub
		address newDapp = new Dapp(msg.sender,_dappName, _dappPrice, _dappParam, _dappUri);
    m_dappsCountByOwner[tx.origin]=m_dappsCountByOwner[tx.origin].add(1);
    m_dappByOwnerByIndex[tx.origin][m_dappsCountByOwner[tx.origin]] = newDapp;
    m_ownerByDapp[newDapp]= tx.origin;
    CreateDapp(tx.origin,newDapp,_dappName, _dappPrice, _dappParam, _dappUri);
		return newDapp;
	}


  function getDappPrice(address _dapp) view public returns (uint256 dappPrice) {
      Dapp dapp =Dapp(_dapp);
      return dapp.dappPrice();
  }



}
