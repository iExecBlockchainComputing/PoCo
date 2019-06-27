pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./IexecStore.sol";
import "./delegates/IexecAccessors.sol";
import "./delegates/IexecCategoryManager.sol";
import "./delegates/IexecCore.sol";
import "./delegates/IexecERC20.sol";
// import "./delegates/IexecEscrowNative.sol";
import "./delegates/IexecEscrowToken.sol";
import "./delegates/IexecOrderSignature.sol";
import "./delegates/IexecRelay.sol";

contract IexecStack is IexecStore, IexecAccessors, IexecCategoryManager, IexecCore, IexecERC20, IexecEscrowToken, IexecOrderSignature, IexecRelay
{}
