pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

import "./Store.sol";
import "./modules/interfaces/IexecAccessors.sol";
import "./modules/interfaces/IexecAccessorsABILegacy.sol";
import "./modules/interfaces/IexecCategoryManager.sol";
import "./modules/interfaces/IexecERC20.sol";
import "./modules/interfaces/IexecEscrowNative.sol";
import "./modules/interfaces/IexecMaintenance.sol";
import "./modules/interfaces/IexecOrderSignature.sol";
import "./modules/interfaces/IexecPoco.sol";
import "./modules/interfaces/IexecRelay.sol";
import "./modules/interfaces/IexecTokenSpender.sol";
import "./modules/interfaces/ENSIntegration.sol";


contract IexecInterfaceNativeABILegacy is Store, IexecAccessors, IexecAccessorsABILegacy, IexecCategoryManager, IexecERC20, IexecEscrowNative, IexecMaintenance, IexecOrderSignature, IexecPoco, IexecRelay, IexecTokenSpender, ENSIntegration
{}
