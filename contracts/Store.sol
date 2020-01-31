pragma solidity ^0.5.0;

import "@iexec/interface/contracts/IexecHub.sol";
import "@iexec/solidity/contracts/Libs/SafeMathExtended.sol";
import "@iexec/solidity/contracts/ERC1538/ERC1538Store.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./libs/IexecLibCore_v4.sol";
import "./libs/IexecLibOrders_v4.sol";
import "./registries/apps/App.sol";
import "./registries/datasets/Dataset.sol";
import "./registries/workerpools/Workerpool.sol";
import "./registries/IRegistry.sol";


contract Store is ERC1538Store
{
	constructor() internal {}

	// Registries
	IRegistry internal m_appregistry;
	IRegistry internal m_datasetregistry;
	IRegistry internal m_workerpoolregistry;

	// Escrow
	IERC20  internal m_baseToken;
	string  internal m_name;
	string  internal m_symbol;
	uint8   internal m_decimals;
	uint256 internal m_totalSupply;
	mapping (address =>                     uint256 ) internal m_balances;
	mapping (address =>                     uint256 ) internal m_frozens;
	mapping (address => mapping (address => uint256)) internal m_allowances;

	// Poco - Constants
	uint256 public constant CONTRIBUTION_DEADLINE_RATIO = 7;
	uint256 public constant REVEAL_DEADLINE_RATIO       = 2;
	uint256 public constant FINAL_DEADLINE_RATIO        = 10;
	uint256 public constant WORKERPOOL_STAKE_RATIO      = 30;
	uint256 public constant KITTY_RATIO                 = 10;
	uint256 public constant KITTY_MIN                   = 1000000000; // TODO: 1RLC ?
	address public constant KITTY_ADDRESS               = address(uint256(keccak256(bytes("iExecKitty"))) - 1);
	uint256 public constant GROUPMEMBER_PURPOSE         = 4;
	bytes32 public          EIP712DOMAIN_SEPARATOR;

	// Poco - Storage
	mapping(bytes32 =>                    address                      ) internal m_presigned;     // per order
	mapping(bytes32 =>                    uint256                      ) internal m_consumed;      // per order
	mapping(bytes32 =>                    IexecLibCore_v4.Deal         ) internal m_deals;         // per deal
	mapping(bytes32 =>                    IexecLibCore_v4.Task         ) internal m_tasks;         // per task
	mapping(bytes32 => mapping(address => IexecLibCore_v4.Contribution)) internal m_contributions; // per task-worker
	mapping(address =>                    uint256                      ) internal m_workerScores;  // per worker
	mapping(bytes32 => mapping(bytes32 => uint256                     )) internal m_groupweight;   // per task-result
	mapping(bytes32 =>                    uint256                      ) internal m_totalweight;   // per task

	// Poco - Settings
	// mapping(address => mapping(address => bool)) internal m_delegate; // TODO: add a signature delegation mechanism
	address internal m_teebroker;
	uint256 internal m_callbackgas;

	// Categories
	IexecLibCore_v4.Category[] internal m_categories;

	// Backward compatibility
	IexecHubInterface internal m_v3_iexecHub;
	mapping(address => bool) internal m_v3_scoreImported;
}
