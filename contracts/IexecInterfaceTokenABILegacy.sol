pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Store.sol";
import "./delegates/IexecAccessors.sol";
import "./delegates/IexecAccessorsABILegacy.sol";
import "./delegates/IexecCategoryManager.sol";
import "./delegates/IexecERC20.sol";
import "./delegates/IexecEscrowToken.sol";
import "./delegates/IexecOrderSignature.sol";
import "./delegates/IexecPoco.sol";
import "./delegates/IexecRelay.sol";
import "./delegates/IexecTokenSpender.sol";
import "./delegates/ENSIntegration.sol";


contract IexecInterfaceTokenABILegacy is Store, IexecAccessors, IexecAccessorsABILegacy, IexecCategoryManager, IexecERC20, IexecEscrowToken, IexecOrderSignature, IexecPoco, IexecRelay, IexecTokenSpender, ENSIntegration
{}
