pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./IexecStore.sol";
import "./delegates/IexecAccessors.sol";
import "./delegates/IexecCategoryManager.sol";
import "./delegates/IexecERC20.sol";
// import "./delegates/IexecEscrowNative.sol";
import "./delegates/IexecEscrowToken.sol";
import "./delegates/IexecOrderSignature.sol";
import "./delegates/IexecPoco.sol";
import "./delegates/IexecRelay.sol";

contract IexecStack is IexecStore, IexecAccessors, IexecCategoryManager, IexecERC20, IexecEscrowToken, IexecOrderSignature, IexecPoco, IexecRelay
{}
