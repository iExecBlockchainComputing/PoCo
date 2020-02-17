pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./Store.sol";
import "./modules/interfaces/IexecAccessors.sol";
import "./modules/interfaces/IexecCategoryManager.sol";
import "./modules/interfaces/IexecERC20.sol";
import "./modules/interfaces/IexecEscrowNative.sol";
import "./modules/interfaces/IexecMaintenance.sol";
import "./modules/interfaces/IexecOrderManagement.sol";
import "./modules/interfaces/IexecPoco.sol";
import "./modules/interfaces/IexecRelay.sol";
import "./modules/interfaces/IexecTokenSpender.sol";
import "./modules/interfaces/ENSIntegration.sol";


interface IexecInterfaceNative is /*Store,*/ IexecAccessors, IexecCategoryManager, IexecERC20, IexecEscrowNative, IexecMaintenance, IexecOrderManagement, IexecPoco, IexecRelay, IexecTokenSpender, ENSIntegration
{
}
