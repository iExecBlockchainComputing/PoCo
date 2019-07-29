pragma solidity ^0.5.10;
pragma experimental ABIEncoderV2;

import "./Store.sol";
import "./delegates/IexecAccessors.sol";
import "./delegates/IexecCategoryManager.sol";
import "./delegates/IexecERC20.sol";
import "./delegates/IexecEscrowNative.sol";
import "./delegates/IexecOrderSignature.sol";
import "./delegates/IexecPoco.sol";
import "./delegates/IexecRelay.sol";
import "./delegates/ENSIntegration.sol";

contract IexecInterfaceNative is Store, IexecAccessors, IexecCategoryManager, IexecERC20, IexecEscrowNative, IexecOrderSignature, IexecPoco, IexecRelay, ENSIntegration
{}
