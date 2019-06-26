pragma solidity ^0.5.9;

import "iexec-solidity/contracts/Libs/SafeMath.sol";
import "iexec-solidity/contracts/ERC20_Token/IERC20.sol";

import "./libs/IexecODBLibCore.sol";
import "./libs/IexecODBLibOrders.sol";
import "./registries/App.sol";
import "./registries/Dataset.sol";
import "./registries/Workerpool.sol";
import "./registries/RegistryBase.sol";

import "./ERC1538/ERC1538Store.sol";


contract IexecStore is ERC1538Store
{
	RegistryBase public appregistry;
	RegistryBase public datasetregistry;
	RegistryBase public workerpoolregistry;

	IERC20  internal m_baseToken;
	string  internal m_name;
	string  internal m_symbol;
	uint8   internal m_decimals;
	uint256 internal m_totalSupply;
	mapping (address =>                     uint256 ) internal m_balances;
	mapping (address =>                     uint256 ) internal m_frozens;
	mapping (address => mapping (address => uint256)) internal m_allowances;

	uint256 public constant CONTRIBUTION_DEADLINE_RATIO = 7;
	uint256 public constant REVEAL_DEADLINE_RATIO       = 2;
	uint256 public constant FINAL_DEADLINE_RATIO        = 10;
	uint256 public constant WORKERPOOL_STAKE_RATIO      = 30;
	uint256 public constant KITTY_RATIO                 = 10;
	uint256 public constant KITTY_MIN                   = 1000000000; // TODO: 1RLC ?
	address public constant KITTY_ADDRESS               = address(bytes20(keccak256(bytes("iExecKitty"))));
	uint256 public constant GROUPMEMBER_PURPOSE         = 4;
	bytes32 public          EIP712DOMAIN_SEPARATOR;

	mapping(bytes32 =>                    IexecODBLibCore.Deal         ) internal m_deals;
	mapping(bytes32 =>                    bytes32[]                    ) internal m_requestdeals;
	mapping(bytes32 =>                    uint256                      ) internal m_consumed;
	mapping(bytes32 =>                    bool                         ) internal m_presigned;
	mapping(bytes32 =>                    IexecODBLibCore.Task         ) internal m_tasks;
	mapping(bytes32 => mapping(address => IexecODBLibCore.Contribution)) internal m_contributions;
	mapping(address =>                    uint256                      ) internal m_workerScores;
	mapping(bytes32 => mapping(address => uint256                     )) internal m_logweight;
	mapping(bytes32 => mapping(bytes32 => uint256                     )) internal m_groupweight;
	mapping(bytes32 =>                    uint256                      ) internal m_totalweight;

	IexecODBLibCore.Category[] m_categories;

	modifier onlyScheduler(bytes32 _taskid)
	{
		require(msg.sender == m_deals[m_tasks[_taskid].dealid].workerpool.owner);
		_;
	}

}
