pragma solidity ^0.4.18;
import './OwnableOZ.sol';

contract Closable is OwnableOZ {

  	enum OpeningStatusEnum { OPEN, CLOSE }

    event Open();
    event Close();

    OpeningStatusEnum public m_openingStatus;

    function Closable() public
    {
      m_openingStatus = OpeningStatusEnum.OPEN;
      Open();
    }

  	function isOpen() public view returns (bool)
  	{
  		return m_openingStatus == OpeningStatusEnum.OPEN;
  	}

  	function open() public onlyOwner returns (bool)
  	{
  		require(m_openingStatus == OpeningStatusEnum.CLOSE);
  		m_openingStatus = OpeningStatusEnum.OPEN;
      Open();
  		return true;
  	}

  	function close() public onlyOwner returns (bool)
  	{
  		require(m_openingStatus == OpeningStatusEnum.OPEN);
  		m_openingStatus = OpeningStatusEnum.CLOSE;
      Close();
  		return true;
  	}
}
