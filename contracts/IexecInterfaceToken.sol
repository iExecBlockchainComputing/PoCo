pragma solidity ^0.6.0;
pragma experimental ABIEncoderV2;

import "./modules/interfaces/IOwnable.sol";
import "./modules/interfaces/IexecAccessors.sol";
import "./modules/interfaces/IexecCategoryManager.sol";
import "./modules/interfaces/IexecERC20.sol";
import "./modules/interfaces/IexecEscrowToken.sol";
import "./modules/interfaces/IexecEscrowTokenSwap.sol";
import "./modules/interfaces/IexecMaintenance.sol";
import "./modules/interfaces/IexecOrderManagement.sol";
import "./modules/interfaces/IexecPoco.sol";
import "./modules/interfaces/IexecRelay.sol";
import "./modules/interfaces/IexecTokenSpender.sol";
import "./modules/interfaces/ENSIntegration.sol";


interface IexecInterfaceToken is IOwnable, IexecAccessors, IexecCategoryManager, IexecERC20, IexecEscrowToken, IexecEscrowTokenSwap, IexecMaintenance, IexecOrderManagement, IexecPoco, IexecRelay, IexecTokenSpender, ENSIntegration
{
}
