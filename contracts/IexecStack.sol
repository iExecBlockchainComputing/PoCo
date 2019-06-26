pragma solidity ^0.5.9;
pragma experimental ABIEncoderV2;

import "./delegates/IexecAccessors.sol";
import "./delegates/IexecCategoryManager.sol";
import "./delegates/IexecCore.sol";
import "./delegates/IexecOrderSignature.sol";
import "./delegates/IexecRelay.sol";

contract IexecStack is IexecAccessors, IexecCategoryManager, IexecCore, IexecOrderSignature, IexecRelay
{}
