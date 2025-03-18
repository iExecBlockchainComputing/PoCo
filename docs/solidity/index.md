# Solidity API

## LaPoste

THIS IS AN EXAMPLE CONTRACT.
THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
DO NOT USE THIS CODE IN PRODUCTION.

### IEXEC_POCO

```solidity
contract IexecPoco IEXEC_POCO
```

### currentChainSelector

```solidity
uint64 currentChainSelector
```

### appRegistry

```solidity
contract IAppRegistry appRegistry
```

### datasetRegistry

```solidity
contract IDatasetRegistry datasetRegistry
```

### workerpoolRegistry

```solidity
contract IWorkerpoolRegistry workerpoolRegistry
```

### lockedAssets

```solidity
mapping(address => bool) lockedAssets
```

### chains

```solidity
mapping(uint64 => struct ILaPoste.BridgeDetails) chains
```

### constructor

```solidity
constructor(contract IRouterClient ccipRouterAddress, contract LinkTokenInterface linkTokenAddress, uint64 _currentChainSelector) public
```

### enableChain

```solidity
function enableChain(uint64 chainSelector, address bridgeAddress, bytes ccipExtraArgs) external
```

### disableChain

```solidity
function disableChain(uint64 chainSelector) external
```

### lockAndBridgeApp

```solidity
function lockAndBridgeApp(address appAddress, uint64 destinationChainSelector, enum ILaPoste.PayFeesIn payFeesIn) external returns (bytes32 messageId)
```

### lockAndBridgeDataset

```solidity
function lockAndBridgeDataset(address datasetAddress, uint64 destinationChainSelector, enum ILaPoste.PayFeesIn payFeesIn) external returns (bytes32 messageId)
```

### lockAndBridgeWorkerpool

```solidity
function lockAndBridgeWorkerpool(address workerpoolAddress, uint64 destinationChainSelector, enum ILaPoste.PayFeesIn payFeesIn) external returns (bytes32 messageId)
```

### ccipReceive

```solidity
function ccipReceive(struct Client.Any2EVMMessage message) external virtual
```

Called by the Router to deliver a message.
If this reverts, any token transfers also revert. The message
will move to a FAILED state and become available for manual execution.

_Note ensure you check the msg.sender is the OffRampRouter_

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| message | struct Client.Any2EVMMessage | CCIP Message |

### withdraw

```solidity
function withdraw(address _beneficiary) public
```

### withdrawToken

```solidity
function withdrawToken(address _beneficiary, address _token) public
```

### receive

```solidity
receive() external payable
```

## ILaPoste

### PayFeesIn

```solidity
enum PayFeesIn {
  Native,
  LINK
}
```

### AssetType

```solidity
enum AssetType {
  App,
  Dataset,
  Workerpool
}
```

### InvalidRouter

```solidity
error InvalidRouter(address router)
```

### NotEnoughBalanceForFees

```solidity
error NotEnoughBalanceForFees(uint256 currentBalance, uint256 calculatedFees)
```

### NothingToWithdraw

```solidity
error NothingToWithdraw()
```

### FailedToWithdrawEth

```solidity
error FailedToWithdrawEth(address owner, address target, uint256 value)
```

### ChainNotEnabled

```solidity
error ChainNotEnabled(uint64 chainSelector)
```

### SenderNotEnabled

```solidity
error SenderNotEnabled(address sender)
```

### OperationNotAllowedOnCurrentChain

```solidity
error OperationNotAllowedOnCurrentChain(uint64 chainSelector)
```

### InvalidAssetType

```solidity
error InvalidAssetType()
```

### AssetAlreadyDeployed

```solidity
error AssetAlreadyDeployed()
```

### AssetNotLocked

```solidity
error AssetNotLocked()
```

### TransferFailed

```solidity
error TransferFailed()
```

### ChainEnabled

```solidity
event ChainEnabled(uint64 chainSelector, address bridgeAddress, bytes ccipExtraArgs)
```

### ChainDisabled

```solidity
event ChainDisabled(uint64 chainSelector)
```

### AssetLocked

```solidity
event AssetLocked(address assetAddress, address owner, enum ILaPoste.AssetType assetType, uint64 destinationChainSelector)
```

### AssetUnlocked

```solidity
event AssetUnlocked(address assetAddress, address owner, enum ILaPoste.AssetType assetType, uint64 sourceChainSelector)
```

### CrossChainSent

```solidity
event CrossChainSent(bytes32 messageId, uint64 destinationChainSelector, enum ILaPoste.AssetType assetType)
```

### CrossChainReceived

```solidity
event CrossChainReceived(uint64 sourceChainSelector, enum ILaPoste.AssetType assetType)
```

### BridgeDetails

```solidity
struct BridgeDetails {
  address bridgeAddress;
  bytes ccipExtraArgsBytes;
}
```

### AppData

```solidity
struct AppData {
  address owner;
  string name;
  string appType;
  bytes multiaddr;
  bytes32 checksum;
  bytes mrEnclave;
}
```

### DatasetData

```solidity
struct DatasetData {
  address owner;
  string name;
  bytes multiaddr;
  bytes32 checksum;
}
```

### WorkerpoolData

```solidity
struct WorkerpoolData {
  address owner;
  string description;
}
```

### AssetData

```solidity
struct AssetData {
  enum ILaPoste.AssetType assetType;
  bytes data;
}
```

## IexecPoco

### appregistry

```solidity
function appregistry() external view returns (contract IAppRegistry)
```

### datasetregistry

```solidity
function datasetregistry() external view returns (contract IDatasetRegistry)
```

### workerpoolregistry

```solidity
function workerpoolregistry() external view returns (contract IWorkerpoolRegistry)
```

## IexecLibCore_v5

### Account

Tools

```solidity
struct Account {
  uint256 stake;
  uint256 locked;
}
```

### Category

```solidity
struct Category {
  string name;
  string description;
  uint256 workClockTimeRef;
}
```

### Resource

Clerk - Deals

```solidity
struct Resource {
  address pointer;
  address owner;
  uint256 price;
}
```

### Deal

```solidity
struct Deal {
  struct IexecLibCore_v5.Resource app;
  struct IexecLibCore_v5.Resource dataset;
  struct IexecLibCore_v5.Resource workerpool;
  uint256 trust;
  uint256 category;
  bytes32 tag;
  address requester;
  address beneficiary;
  address callback;
  string params;
  uint256 startTime;
  uint256 botFirst;
  uint256 botSize;
  uint256 workerStake;
  uint256 schedulerRewardRatio;
  address sponsor;
}
```

### DealBoost

Simplified deals for PoCo Boost module.

```solidity
struct DealBoost {
  address appOwner;
  uint96 appPrice;
  address datasetOwner;
  uint96 datasetPrice;
  address workerpoolOwner;
  uint96 workerpoolPrice;
  address requester;
  uint96 workerReward;
  address callback;
  uint40 deadline;
  uint16 botFirst;
  uint16 botSize;
  bytes3 shortTag;
  address sponsor;
}
```

### TaskStatusEnum

Tasks

```solidity
enum TaskStatusEnum {
  UNSET,
  ACTIVE,
  REVEALING,
  COMPLETED,
  FAILED
}
```

### Task

```solidity
struct Task {
  enum IexecLibCore_v5.TaskStatusEnum status;
  bytes32 dealid;
  uint256 idx;
  uint256 timeref;
  uint256 contributionDeadline;
  uint256 revealDeadline;
  uint256 finalDeadline;
  bytes32 consensusValue;
  uint256 revealCounter;
  uint256 winnerCounter;
  address[] contributors;
  bytes32 resultDigest;
  bytes results;
  uint256 resultsTimestamp;
  bytes resultsCallback;
}
```

### Consensus

Consensus

```solidity
struct Consensus {
  mapping(bytes32 => uint256) group;
  uint256 total;
}
```

### ContributionStatusEnum

Consensus

```solidity
enum ContributionStatusEnum {
  UNSET,
  CONTRIBUTED,
  PROVED,
  REJECTED
}
```

### Contribution

```solidity
struct Contribution {
  enum IexecLibCore_v5.ContributionStatusEnum status;
  bytes32 resultHash;
  bytes32 resultSeal;
  address enclaveChallenge;
  uint256 weight;
}
```

## IexecLibOrders_v5

### EIP712DOMAIN_TYPEHASH

```solidity
bytes32 EIP712DOMAIN_TYPEHASH
```

### APPORDER_TYPEHASH

```solidity
bytes32 APPORDER_TYPEHASH
```

### DATASETORDER_TYPEHASH

```solidity
bytes32 DATASETORDER_TYPEHASH
```

### WORKERPOOLORDER_TYPEHASH

```solidity
bytes32 WORKERPOOLORDER_TYPEHASH
```

### REQUESTORDER_TYPEHASH

```solidity
bytes32 REQUESTORDER_TYPEHASH
```

### APPORDEROPERATION_TYPEHASH

```solidity
bytes32 APPORDEROPERATION_TYPEHASH
```

### DATASETORDEROPERATION_TYPEHASH

```solidity
bytes32 DATASETORDEROPERATION_TYPEHASH
```

### WORKERPOOLORDEROPERATION_TYPEHASH

```solidity
bytes32 WORKERPOOLORDEROPERATION_TYPEHASH
```

### REQUESTORDEROPERATION_TYPEHASH

```solidity
bytes32 REQUESTORDEROPERATION_TYPEHASH
```

### OrderOperationEnum

```solidity
enum OrderOperationEnum {
  SIGN,
  CLOSE
}
```

### EIP712Domain

```solidity
struct EIP712Domain {
  string name;
  string version;
  uint256 chainId;
  address verifyingContract;
}
```

### AppOrder

```solidity
struct AppOrder {
  address app;
  uint256 appprice;
  uint256 volume;
  bytes32 tag;
  address datasetrestrict;
  address workerpoolrestrict;
  address requesterrestrict;
  bytes32 salt;
  bytes sign;
}
```

### DatasetOrder

```solidity
struct DatasetOrder {
  address dataset;
  uint256 datasetprice;
  uint256 volume;
  bytes32 tag;
  address apprestrict;
  address workerpoolrestrict;
  address requesterrestrict;
  bytes32 salt;
  bytes sign;
}
```

### WorkerpoolOrder

```solidity
struct WorkerpoolOrder {
  address workerpool;
  uint256 workerpoolprice;
  uint256 volume;
  bytes32 tag;
  uint256 category;
  uint256 trust;
  address apprestrict;
  address datasetrestrict;
  address requesterrestrict;
  bytes32 salt;
  bytes sign;
}
```

### RequestOrder

```solidity
struct RequestOrder {
  address app;
  uint256 appmaxprice;
  address dataset;
  uint256 datasetmaxprice;
  address workerpool;
  uint256 workerpoolmaxprice;
  address requester;
  uint256 volume;
  bytes32 tag;
  uint256 category;
  uint256 trust;
  address beneficiary;
  address callback;
  string params;
  bytes32 salt;
  bytes sign;
}
```

### AppOrderOperation

```solidity
struct AppOrderOperation {
  struct IexecLibOrders_v5.AppOrder order;
  enum IexecLibOrders_v5.OrderOperationEnum operation;
  bytes sign;
}
```

### DatasetOrderOperation

```solidity
struct DatasetOrderOperation {
  struct IexecLibOrders_v5.DatasetOrder order;
  enum IexecLibOrders_v5.OrderOperationEnum operation;
  bytes sign;
}
```

### WorkerpoolOrderOperation

```solidity
struct WorkerpoolOrderOperation {
  struct IexecLibOrders_v5.WorkerpoolOrder order;
  enum IexecLibOrders_v5.OrderOperationEnum operation;
  bytes sign;
}
```

### RequestOrderOperation

```solidity
struct RequestOrderOperation {
  struct IexecLibOrders_v5.RequestOrder order;
  enum IexecLibOrders_v5.OrderOperationEnum operation;
  bytes sign;
}
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.EIP712Domain _domain) public pure returns (bytes32 domainhash)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.AppOrder _apporder) public pure returns (bytes32 apphash)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.DatasetOrder _datasetorder) public pure returns (bytes32 datasethash)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.WorkerpoolOrder _workerpoolorder) public pure returns (bytes32 workerpoolhash)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.RequestOrder _requestorder) public pure returns (bytes32 requesthash)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.AppOrderOperation _apporderoperation) public pure returns (bytes32)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.DatasetOrderOperation _datasetorderoperation) public pure returns (bytes32)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.WorkerpoolOrderOperation _workerpoolorderoperation) public pure returns (bytes32)
```

### hash

```solidity
function hash(struct IexecLibOrders_v5.RequestOrderOperation _requestorderoperation) public pure returns (bytes32)
```

## DelegateBase

_Every module must inherit from this contract._

## IexecEscrow

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

### Lock

```solidity
event Lock(address owner, uint256 amount)
```

### Unlock

```solidity
event Unlock(address owner, uint256 amount)
```

### Reward

```solidity
event Reward(address owner, uint256 amount, bytes32 ref)
```

### Seize

```solidity
event Seize(address owner, uint256 amount, bytes32 ref)
```

## IexecOrderManagementDelegate

### manageAppOrder

```solidity
function manageAppOrder(struct IexecLibOrders_v5.AppOrderOperation _apporderoperation) external
```

### manageDatasetOrder

```solidity
function manageDatasetOrder(struct IexecLibOrders_v5.DatasetOrderOperation _datasetorderoperation) external
```

### manageWorkerpoolOrder

```solidity
function manageWorkerpoolOrder(struct IexecLibOrders_v5.WorkerpoolOrderOperation _workerpoolorderoperation) external
```

### manageRequestOrder

```solidity
function manageRequestOrder(struct IexecLibOrders_v5.RequestOrderOperation _requestorderoperation) external
```

## Matching

```solidity
struct Matching {
  bytes32 apporderHash;
  address appOwner;
  bytes32 datasetorderHash;
  address datasetOwner;
  bytes32 workerpoolorderHash;
  address workerpoolOwner;
  bytes32 requestorderHash;
  bool hasDataset;
}
```

## IexecPoco1Delegate

### verifySignature

```solidity
function verifySignature(address _identity, bytes32 _hash, bytes _signature) external view returns (bool)
```

### verifyPresignature

```solidity
function verifyPresignature(address _identity, bytes32 _hash) external view returns (bool)
```

### verifyPresignatureOrSignature

```solidity
function verifyPresignatureOrSignature(address _identity, bytes32 _hash, bytes _signature) external view returns (bool)
```

### matchOrders

```solidity
function matchOrders(struct IexecLibOrders_v5.AppOrder _apporder, struct IexecLibOrders_v5.DatasetOrder _datasetorder, struct IexecLibOrders_v5.WorkerpoolOrder _workerpoolorder, struct IexecLibOrders_v5.RequestOrder _requestorder) external returns (bytes32)
```

Match orders. The requester gets debited.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _apporder | struct IexecLibOrders_v5.AppOrder | The app order. |
| _datasetorder | struct IexecLibOrders_v5.DatasetOrder | The dataset order. |
| _workerpoolorder | struct IexecLibOrders_v5.WorkerpoolOrder | The workerpool order. |
| _requestorder | struct IexecLibOrders_v5.RequestOrder | The requester order. |

### sponsorMatchOrders

```solidity
function sponsorMatchOrders(struct IexecLibOrders_v5.AppOrder _apporder, struct IexecLibOrders_v5.DatasetOrder _datasetorder, struct IexecLibOrders_v5.WorkerpoolOrder _workerpoolorder, struct IexecLibOrders_v5.RequestOrder _requestorder) external returns (bytes32)
```

Sponsor match orders for a requester.
Unlike the standard `matchOrders(..)` hook where the requester pays for
the deal, this current hook makes it possible for any `msg.sender` to pay for
a third party requester.

Be aware that anyone seeing a valid request order on the network
(via an off-chain public marketplace, via a `sponsorMatchOrders(..)`
pending transaction in the mempool or by any other means) might decide
to call the standard `matchOrders(..)` hook which will result in the
requester being debited instead. Therefore, such a front run would result
in a loss of some of the requester funds deposited in the iExec account
(a loss value equivalent to the price of the deal).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| _apporder | struct IexecLibOrders_v5.AppOrder | The app order. |
| _datasetorder | struct IexecLibOrders_v5.DatasetOrder | The dataset order. |
| _workerpoolorder | struct IexecLibOrders_v5.WorkerpoolOrder | The workerpool order. |
| _requestorder | struct IexecLibOrders_v5.RequestOrder | The requester order. |

## IexecPoco2Delegate

### initialize

```solidity
function initialize(bytes32 _dealid, uint256 idx) public returns (bytes32)
```

### contribute

```solidity
function contribute(bytes32 _taskid, bytes32 _resultHash, bytes32 _resultSeal, address _enclaveChallenge, bytes _enclaveSign, bytes _authorizationSign) external
```

### contributeAndFinalize

```solidity
function contributeAndFinalize(bytes32 _taskid, bytes32 _resultDigest, bytes _results, bytes _resultsCallback, address _enclaveChallenge, bytes _enclaveSign, bytes _authorizationSign) external
```

### reveal

```solidity
function reveal(bytes32 _taskid, bytes32 _resultDigest) external
```

### reopen

```solidity
function reopen(bytes32 _taskid) external
```

### finalize

```solidity
function finalize(bytes32 _taskid, bytes _results, bytes _resultsCallback) external
```

### claim

```solidity
function claim(bytes32 _taskid) public
```

### initializeArray

```solidity
function initializeArray(bytes32[] _dealid, uint256[] _idx) external returns (bool)
```

### claimArray

```solidity
function claimArray(bytes32[] _taskid) external returns (bool)
```

### initializeAndClaimArray

```solidity
function initializeAndClaimArray(bytes32[] _dealid, uint256[] _idx) external returns (bool)
```

## IexecPocoAccessorsDelegate

### viewDeal

```solidity
function viewDeal(bytes32 id) external view returns (struct IexecLibCore_v5.Deal deal)
```

Get a deal created by PoCo module.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | bytes32 | The ID of the deal. |

### viewTask

```solidity
function viewTask(bytes32 id) external view returns (struct IexecLibCore_v5.Task)
```

Get task created in Classic mode.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | bytes32 | id of the task |

### computeDealVolume

```solidity
function computeDealVolume(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external view returns (uint256)
```

Computes the volume of the "not yet created" deal based on the provided orders.
This function should only be used if the deal is not yet created.
For existing deals, use the deal accessors instead.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| appOrder | struct IexecLibOrders_v5.AppOrder | The application order. |
| datasetOrder | struct IexecLibOrders_v5.DatasetOrder | The dataset order. |
| workerpoolOrder | struct IexecLibOrders_v5.WorkerpoolOrder | The workerpool order. |
| requestOrder | struct IexecLibOrders_v5.RequestOrder | The request order. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | uint256 | The computed deal volume. |

## IexecPocoBoostAccessorsDelegate

Access to PoCo Boost tasks must be done with PoCo Classic `IexecAccessors`.

### viewDealBoost

```solidity
function viewDealBoost(bytes32 id) external view returns (struct IexecLibCore_v5.DealBoost deal)
```

Get a deal created by PoCo Boost module.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| id | bytes32 | The ID of the deal. |

## IexecPocoBoostDelegate

Works for deals with requested trust = 0.

### matchOrdersBoost

```solidity
function matchOrdersBoost(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external returns (bytes32)
```

This boost match orders is only compatible with trust <= 1.
The requester gets debited.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| appOrder | struct IexecLibOrders_v5.AppOrder | The order signed by the application developer. |
| datasetOrder | struct IexecLibOrders_v5.DatasetOrder | The order signed by the dataset provider. |
| workerpoolOrder | struct IexecLibOrders_v5.WorkerpoolOrder | The order signed by the workerpool manager. |
| requestOrder | struct IexecLibOrders_v5.RequestOrder | The order signed by the requester. |

#### Return Values

| Name | Type | Description |
| ---- | ---- | ----------- |
| [0] | bytes32 | The ID of the deal. |

### sponsorMatchOrdersBoost

```solidity
function sponsorMatchOrdersBoost(struct IexecLibOrders_v5.AppOrder appOrder, struct IexecLibOrders_v5.DatasetOrder datasetOrder, struct IexecLibOrders_v5.WorkerpoolOrder workerpoolOrder, struct IexecLibOrders_v5.RequestOrder requestOrder) external returns (bytes32)
```

Sponsor match orders boost for a requester.
Unlike the standard `matchOrdersBoost(..)` hook where the requester pays for
the deal, this current hook makes it possible for any `msg.sender` to pay for
a third party requester.

Be aware that anyone seeing a valid request order on the network
(via an off-chain public marketplace, via a `sponsorMatchOrdersBoost(..)`
pending transaction in the mempool or by any other means) might decide
to call the standard `matchOrdersBoost(..)` hook which will result in the
requester being debited instead. Therefore, such a front run would result
in a loss of some of the requester funds deposited in the iExec account
(a loss value equivalent to the price of the deal).

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| appOrder | struct IexecLibOrders_v5.AppOrder | The app order. |
| datasetOrder | struct IexecLibOrders_v5.DatasetOrder | The dataset order. |
| workerpoolOrder | struct IexecLibOrders_v5.WorkerpoolOrder | The workerpool order. |
| requestOrder | struct IexecLibOrders_v5.RequestOrder | The requester order. |

### pushResultBoost

```solidity
function pushResultBoost(bytes32 dealId, uint256 index, bytes results, bytes resultsCallback, bytes authorizationSign, address enclaveChallenge, bytes enclaveSign) external
```

Accept results of a task computed by a worker during Boost workflow.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dealId | bytes32 | The id of the target deal. |
| index | uint256 | The index of the target task of the deal. |
| results | bytes | The results of the task computed by the worker. |
| resultsCallback | bytes | The results of the task computed by the worker that will be forwarded as call data to the callback address set by the requester. |
| authorizationSign | bytes | The authorization signed by the scheduler. authorizing the worker to push a result. |
| enclaveChallenge | address | The enclave address which can produce enclave signature. |
| enclaveSign | bytes | The signature generated from the enclave. |

### claimBoost

```solidity
function claimBoost(bytes32 dealId, uint256 index) external
```

Claim task to get a refund if task is not completed after deadline.

#### Parameters

| Name | Type | Description |
| ---- | ---- | ----------- |
| dealId | bytes32 | The ID of the deal. |
| index | uint256 | The index of the task. |

## IexecPocoCommonDelegate

## DelegateBase

## ENSIntegrationDelegate

### setName

```solidity
function setName(address _ens, string _name) external
```

## IexecAccessorsDelegate

### name

```solidity
function name() external view returns (string)
```

### symbol

```solidity
function symbol() external view returns (string)
```

### decimals

```solidity
function decimals() external view returns (uint8)
```

### totalSupply

```solidity
function totalSupply() external view returns (uint256)
```

### balanceOf

```solidity
function balanceOf(address account) external view returns (uint256)
```

### frozenOf

```solidity
function frozenOf(address account) external view returns (uint256)
```

### allowance

```solidity
function allowance(address account, address spender) external view returns (uint256)
```

### viewAccount

```solidity
function viewAccount(address account) external view returns (struct IexecLibCore_v5.Account)
```

### token

```solidity
function token() external view returns (address)
```

### viewDeal

```solidity
function viewDeal(bytes32 _id) external view returns (struct IexecLibCore_v5.Deal deal)
```

### viewConsumed

```solidity
function viewConsumed(bytes32 _id) external view returns (uint256 consumed)
```

### viewPresigned

```solidity
function viewPresigned(bytes32 _id) external view returns (address signer)
```

### viewTask

```solidity
function viewTask(bytes32 _taskid) external view returns (struct IexecLibCore_v5.Task)
```

### viewContribution

```solidity
function viewContribution(bytes32 _taskid, address _worker) external view returns (struct IexecLibCore_v5.Contribution)
```

### viewScore

```solidity
function viewScore(address _worker) external view returns (uint256)
```

### resultFor

```solidity
function resultFor(bytes32 id) external view returns (bytes)
```

### viewCategory

```solidity
function viewCategory(uint256 _catid) external view returns (struct IexecLibCore_v5.Category category)
```

### countCategory

```solidity
function countCategory() external view returns (uint256 count)
```

### appregistry

```solidity
function appregistry() external view returns (contract IRegistry)
```

### datasetregistry

```solidity
function datasetregistry() external view returns (contract IRegistry)
```

### workerpoolregistry

```solidity
function workerpoolregistry() external view returns (contract IRegistry)
```

### teebroker

```solidity
function teebroker() external view returns (address)
```

### callbackgas

```solidity
function callbackgas() external view returns (uint256)
```

### contribution_deadline_ratio

```solidity
function contribution_deadline_ratio() external view returns (uint256)
```

### reveal_deadline_ratio

```solidity
function reveal_deadline_ratio() external view returns (uint256)
```

### final_deadline_ratio

```solidity
function final_deadline_ratio() external view returns (uint256)
```

### workerpool_stake_ratio

```solidity
function workerpool_stake_ratio() external view returns (uint256)
```

### kitty_ratio

```solidity
function kitty_ratio() external view returns (uint256)
```

### kitty_min

```solidity
function kitty_min() external view returns (uint256)
```

### kitty_address

```solidity
function kitty_address() external view returns (address)
```

### groupmember_purpose

```solidity
function groupmember_purpose() external view returns (uint256)
```

### eip712domain_separator

```solidity
function eip712domain_separator() external view returns (bytes32)
```

## IexecCategoryManagerDelegate

### createCategory

```solidity
function createCategory(string name, string description, uint256 workClockTimeRef) external returns (uint256)
```

Methods

## IexecERC20Core

### Transfer

```solidity
event Transfer(address from, address to, uint256 value)
```

### Approval

```solidity
event Approval(address owner, address spender, uint256 value)
```

## IexecERC20Delegate

### transfer

```solidity
function transfer(address recipient, uint256 amount) external returns (bool)
```

### approve

```solidity
function approve(address spender, uint256 value) external returns (bool)
```

### approveAndCall

```solidity
function approveAndCall(address spender, uint256 value, bytes extraData) external returns (bool)
```

### transferFrom

```solidity
function transferFrom(address sender, address recipient, uint256 amount) external returns (bool)
```

### increaseAllowance

```solidity
function increaseAllowance(address spender, uint256 addedValue) external returns (bool)
```

### decreaseAllowance

```solidity
function decreaseAllowance(address spender, uint256 subtractedValue) external returns (bool)
```

## IexecEscrowNativeDelegate

### receive

```solidity
receive() external payable
```

### fallback

```solidity
fallback() external payable
```

### deposit

```solidity
function deposit() external payable returns (bool)
```

### depositFor

```solidity
function depositFor(address target) external payable returns (bool)
```

### depositForArray

```solidity
function depositForArray(uint256[] amounts, address[] targets) external payable returns (bool)
```

### withdraw

```solidity
function withdraw(uint256 amount) external returns (bool)
```

### withdrawTo

```solidity
function withdrawTo(uint256 amount, address target) external returns (bool)
```

### recover

```solidity
function recover() external returns (uint256)
```

## IexecEscrowTokenDelegate

### receive

```solidity
receive() external payable
```

### fallback

```solidity
fallback() external payable
```

### deposit

```solidity
function deposit(uint256 amount) external returns (bool)
```

### depositFor

```solidity
function depositFor(uint256 amount, address target) external returns (bool)
```

### depositForArray

```solidity
function depositForArray(uint256[] amounts, address[] targets) external returns (bool)
```

### withdraw

```solidity
function withdraw(uint256 amount) external returns (bool)
```

### withdrawTo

```solidity
function withdrawTo(uint256 amount, address target) external returns (bool)
```

### recover

```solidity
function recover() external returns (uint256)
```

### receiveApproval

```solidity
function receiveApproval(address sender, uint256 amount, address token, bytes) external returns (bool)
```

## IexecMaintenanceDelegate

### configure

```solidity
function configure(address _token, string _name, string _symbol, uint8 _decimal, address _appregistryAddress, address _datasetregistryAddress, address _workerpoolregistryAddress, address _v3_iexecHubAddress) external
```

### domain

```solidity
function domain() external view returns (struct IexecLibOrders_v5.EIP712Domain)
```

### updateDomainSeparator

```solidity
function updateDomainSeparator() external
```

### importScore

```solidity
function importScore(address _worker) external
```

### setTeeBroker

```solidity
function setTeeBroker(address _teebroker) external
```

### setCallbackGas

```solidity
function setCallbackGas(uint256 _callbackgas) external
```

## IexecMaintenanceExtraDelegate

### changeRegistries

```solidity
function changeRegistries(address _appregistryAddress, address _datasetregistryAddress, address _workerpoolregistryAddress) external
```

## IexecRelayDelegate

### broadcastAppOrder

```solidity
function broadcastAppOrder(struct IexecLibOrders_v5.AppOrder _apporder) external
```

### broadcastDatasetOrder

```solidity
function broadcastDatasetOrder(struct IexecLibOrders_v5.DatasetOrder _datasetorder) external
```

### broadcastWorkerpoolOrder

```solidity
function broadcastWorkerpoolOrder(struct IexecLibOrders_v5.WorkerpoolOrder _workerpoolorder) external
```

### broadcastRequestOrder

```solidity
function broadcastRequestOrder(struct IexecLibOrders_v5.RequestOrder _requestorder) external
```

