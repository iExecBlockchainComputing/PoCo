pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./Store.sol";
import "./delegates/IexecAccessors.sol";
import "./delegates/IexecCategoryManager.sol";
import "./delegates/IexecERC20.sol";
// import "./delegates/IexecEscrowNative.sol";
import "./delegates/IexecEscrowToken.sol";
import "./delegates/IexecOrderSignature.sol";
import "./delegates/IexecPoco.sol";
import "./delegates/IexecRelay.sol";

contract IexecInterface is Store, IexecAccessors, IexecCategoryManager, IexecERC20, IexecEscrowToken, IexecOrderSignature, IexecPoco, IexecRelay
{}
