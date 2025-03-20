// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC721} from "@openzeppelin/contracts-v5/token/ERC721/IERC721.sol";
import {ERC165} from "@openzeppelin/contracts-v5/utils/introspection/ERC165.sol";
import {ERC721Holder} from "@openzeppelin/contracts-v5/token/ERC721/utils/ERC721Holder.sol";
import {IERC20} from "@openzeppelin/contracts-v5/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts-v5/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts-v5/utils/ReentrancyGuard.sol";
import {Client} from "@chainlink/contracts-ccip/src/v0.8/ccip/libraries/Client.sol";
import {IRouterClient} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IRouterClient.sol";
import {IAny2EVMMessageReceiver} from "@chainlink/contracts-ccip/src/v0.8/ccip/interfaces/IAny2EVMMessageReceiver.sol";
import {OwnerIsCreator} from "@chainlink/contracts-ccip/src/v0.8/shared/access/OwnerIsCreator.sol";
import {LinkTokenInterface} from "@chainlink/contracts/src/v0.8/shared/interfaces/LinkTokenInterface.sol";
import {IexecPoco} from "./interfaces/IexecPoco.sol";
import {IWorkerpoolRegistry, IWorkerpool} from "../registries/workerpools/IWorkerpoolRegistry.sol";
import {IDatasetRegistry, IDataset} from "../registries/datasets/IDatasetRegistry.sol";
import {IAppRegistry, IApp} from "../registries/apps/IAppRegistry.sol";
import {ILaPoste} from "./interfaces/ILaPoste.sol";
/**
 * THIS IS AN EXAMPLE CONTRACT.
 * THIS IS AN EXAMPLE CONTRACT THAT USES UN-AUDITED CODE.
 * DO NOT USE THIS CODE IN PRODUCTION.
 */
contract LaPoste is
    ILaPoste,
    IAny2EVMMessageReceiver,
    ReentrancyGuard,
    OwnerIsCreator,
    ERC721Holder,
    ERC165
{
    using SafeERC20 for IERC20;

    //###########################
    // Store
    //###########################
    IexecPoco public constant IEXEC_POCO = IexecPoco(0x4AB8068bE5bd7C693EA7F5cF0701D973Da005c2f);
    IRouterClient internal immutable _ccipRouter;
    LinkTokenInterface internal immutable _linkToken;
    uint64 public currentChainSelector;
    IAppRegistry public appRegistry;
    IDatasetRegistry public datasetRegistry;
    IWorkerpoolRegistry public workerpoolRegistry;

    // Map of asset address to boolean indicating if it's locked
    mapping(address => bool) public lockedAssets;
    // Map chain selectors to bridge details
    mapping(uint64 destChainSelector => BridgeDetails bridgeDetails) public chains;

    //###########################
    // Modifiers
    //###########################
    modifier onlyRouter() {
        if (msg.sender != address(_ccipRouter)) {
            revert InvalidRouter(msg.sender);
        }
        _;
    }

    modifier onlyEnabledChain(uint64 _chainSelector) {
        if (chains[_chainSelector].bridgeAddress == address(0)) {
            revert ChainNotEnabled(_chainSelector);
        }
        _;
    }

    modifier onlyEnabledSender(uint64 _chainSelector, address _sender) {
        if (chains[_chainSelector].bridgeAddress != _sender) {
            revert SenderNotEnabled(_sender);
        }
        _;
    }

    modifier onlyOtherChains(uint64 _chainSelector) {
        if (_chainSelector == currentChainSelector) {
            revert OperationNotAllowedOnCurrentChain(_chainSelector);
        }
        _;
    }

    constructor(
        IRouterClient ccipRouterAddress,
        LinkTokenInterface linkTokenAddress,
        uint64 _currentChainSelector
    ) {
        if (address(ccipRouterAddress) == address(0)) revert InvalidRouter(address(0));

        _ccipRouter = ccipRouterAddress;
        _linkToken = linkTokenAddress;
        currentChainSelector = _currentChainSelector;

        // Initialize registry addresses
        appRegistry = IEXEC_POCO.appregistry();
        datasetRegistry = IEXEC_POCO.datasetregistry();
        workerpoolRegistry = IEXEC_POCO.workerpoolregistry();
    }

    //###########################
    // Functions
    //###########################
    function enableChain(
        uint64 chainSelector,
        address bridgeAddress,
        bytes memory ccipExtraArgs
    ) external onlyOwner onlyOtherChains(chainSelector) {
        chains[chainSelector] = BridgeDetails({
            bridgeAddress: bridgeAddress,
            ccipExtraArgsBytes: ccipExtraArgs
        });
        emit ChainEnabled(chainSelector, bridgeAddress, ccipExtraArgs);
    }

    function disableChain(uint64 chainSelector) external onlyOwner onlyOtherChains(chainSelector) {
        delete chains[chainSelector];
        emit ChainDisabled(chainSelector);
    }

    function lockAndBridgeApp(
        address appAddress,
        uint64 destinationChainSelector,
        PayFeesIn payFeesIn
    ) external nonReentrant onlyEnabledChain(destinationChainSelector) returns (bytes32 messageId) {
        // Lock the asset by transferring it to this contract
        try
            IERC721(address(appRegistry)).transferFrom(
                msg.sender,
                address(this),
                uint256(uint160(appAddress))
            )
        {
            // Mark the asset as locked
            lockedAssets[appAddress] = true;
        } catch {
            revert TransferFailed();
        }

        // Get appData
        AppData memory appData = getAppData(IApp(appAddress));
        AssetData memory assetData = AssetData({
            assetType: AssetType.App,
            data: abi.encode(appData)
        });

        // Send CCIP message
        messageId = _sendCCIPMessage(destinationChainSelector, assetData, payFeesIn);

        emit AssetLocked(appAddress, msg.sender, AssetType.App, destinationChainSelector);
        emit CrossChainSent(messageId, destinationChainSelector, AssetType.App);

        return messageId;
    }

    function lockAndBridgeDataset(
        address datasetAddress,
        uint64 destinationChainSelector,
        PayFeesIn payFeesIn
    ) external nonReentrant onlyEnabledChain(destinationChainSelector) returns (bytes32 messageId) {
        // Lock the asset by transferring it to this contract
        try
            IERC721(address(datasetRegistry)).transferFrom(
                msg.sender,
                address(this),
                uint256(uint160(datasetAddress))
            )
        {
            // Mark the asset as locked
            lockedAssets[datasetAddress] = true;
        } catch {
            revert TransferFailed();
        }
        // Get dataset data
        DatasetData memory datasetData = getDatasetData(IDataset(datasetAddress));
        AssetData memory assetData = AssetData({
            assetType: AssetType.Dataset,
            data: abi.encode(datasetData)
        });

        // Send CCIP message
        messageId = _sendCCIPMessage(destinationChainSelector, assetData, payFeesIn);

        emit AssetLocked(datasetAddress, msg.sender, AssetType.Dataset, destinationChainSelector);
        emit CrossChainSent(messageId, destinationChainSelector, AssetType.Dataset);

        return messageId;
    }

    function lockAndBridgeWorkerpool(
        address workerpoolAddress,
        uint64 destinationChainSelector,
        PayFeesIn payFeesIn
    ) external nonReentrant onlyEnabledChain(destinationChainSelector) returns (bytes32 messageId) {
        // Lock the asset by transferring it to this contract
        try
            IERC721(address(workerpoolRegistry)).transferFrom(
                msg.sender,
                address(this),
                uint256(uint160(workerpoolAddress))
            )
        {
            // Mark the asset as locked
            lockedAssets[workerpoolAddress] = true;
        } catch {
            revert TransferFailed();
        }

        // Get workerpool data
        WorkerpoolData memory workerpoolData = getWorkerpoolData(IWorkerpool(workerpoolAddress));
        AssetData memory assetData = AssetData({
            assetType: AssetType.Workerpool,
            data: abi.encode(workerpoolData)
        });

        // Send CCIP message
        messageId = _sendCCIPMessage(destinationChainSelector, assetData, payFeesIn);

        emit AssetLocked(
            workerpoolAddress,
            msg.sender,
            AssetType.Workerpool,
            destinationChainSelector
        );
        emit CrossChainSent(messageId, destinationChainSelector, AssetType.Workerpool);

        return messageId;
    }

    function _sendCCIPMessage(
        uint64 destinationChainSelector,
        AssetData memory assetData,
        PayFeesIn payFeesIn
    ) internal returns (bytes32 messageId) {
        Client.EVM2AnyMessage memory message = Client.EVM2AnyMessage({
            receiver: abi.encode(chains[destinationChainSelector].bridgeAddress),
            data: abi.encode(assetData),
            tokenAmounts: new Client.EVMTokenAmount[](0),
            extraArgs: chains[destinationChainSelector].ccipExtraArgsBytes,
            feeToken: payFeesIn == PayFeesIn.LINK ? address(_linkToken) : address(0)
        });

        // Get the fee required to send the CCIP message
        uint256 fees = _ccipRouter.getFee(destinationChainSelector, message);

        if (payFeesIn == PayFeesIn.LINK) {
            if (fees > _linkToken.balanceOf(address(this))) {
                revert NotEnoughBalanceForFees(_linkToken.balanceOf(address(this)), fees);
            }

            // Approve the Router to transfer LINK tokens on contract's behalf. It will spend the fees in LINK
            _linkToken.approve(address(_ccipRouter), fees);

            // Send the message through the router and store the returned message ID
            messageId = _ccipRouter.ccipSend(destinationChainSelector, message);
        } else {
            if (fees > address(this).balance) {
                revert NotEnoughBalanceForFees(address(this).balance, fees);
            }

            // Send the message through the router and store the returned message ID
            messageId = _ccipRouter.ccipSend{value: fees}(destinationChainSelector, message);
        }

        return messageId;
    }

    /// @inheritdoc IAny2EVMMessageReceiver
    function ccipReceive(
        Client.Any2EVMMessage calldata message
    )
        external
        virtual
        override
        onlyRouter
        nonReentrant
        onlyEnabledChain(message.sourceChainSelector)
        onlyEnabledSender(message.sourceChainSelector, abi.decode(message.sender, (address)))
    {
        uint64 sourceChainSelector = message.sourceChainSelector;
        AssetData memory assetData = abi.decode(message.data, (AssetData));

        // Based on asset type, call the appropriate creation function
        if (assetData.assetType == AssetType.App) {
            AppData memory appData = abi.decode(assetData.data, (AppData));

            // Check if the app already exists
            address predictedAppAddress = address(
                appRegistry.predictApp(
                    appData.owner,
                    appData.name,
                    appData.appType,
                    appData.multiaddr,
                    appData.checksum,
                    appData.mrEnclave
                )
            );

            // Only create if not already deployed
            if (!lockedAssets[predictedAppAddress]) {
                IAppRegistry(appRegistry).createApp(
                    appData.owner,
                    appData.name,
                    appData.appType,
                    appData.multiaddr,
                    appData.checksum,
                    appData.mrEnclave
                );
            } else {
                // Unlock + transfer asset to owner
                IERC721(address(appRegistry)).safeTransferFrom(
                    address(this),
                    msg.sender,
                    uint256(uint160(predictedAppAddress))
                );
            }
        } else if (assetData.assetType == AssetType.Dataset) {
            DatasetData memory datasetData = abi.decode(assetData.data, (DatasetData));

            // Check if the dataset already exists
            address predictedDatasetAddress = address(
                datasetRegistry.predictDataset(
                    datasetData.owner,
                    datasetData.name,
                    datasetData.multiaddr,
                    datasetData.checksum
                )
            );

            // Only create if not already deployed
            if (!lockedAssets[predictedDatasetAddress]) {
                IDatasetRegistry(datasetRegistry).createDataset(
                    datasetData.owner,
                    datasetData.name,
                    datasetData.multiaddr,
                    datasetData.checksum
                );
            } else {
                // Unlock + transfer asset to owner
                IERC721(address(datasetRegistry)).safeTransferFrom(
                    address(this),
                    msg.sender,
                    uint256(uint160(predictedDatasetAddress))
                );
            }
        } else if (assetData.assetType == AssetType.Workerpool) {
            WorkerpoolData memory workerpoolData = abi.decode(assetData.data, (WorkerpoolData));

            // Check if the workerpool already exists
            address predictedWorkerpoolAddress = address(
                workerpoolRegistry.predictWorkerpool(
                    workerpoolData.owner,
                    workerpoolData.description
                )
            );

            // Only create if not already deployed
            if (!lockedAssets[predictedWorkerpoolAddress]) {
                IWorkerpoolRegistry(workerpoolRegistry).createWorkerpool(
                    workerpoolData.owner,
                    workerpoolData.description
                );
            } else {
                // Unlock + transfer asset to owner
                IERC721(address(workerpoolRegistry)).safeTransferFrom(
                    address(this),
                    msg.sender,
                    uint256(uint160(predictedWorkerpoolAddress))
                );
            }
        } else {
            revert InvalidAssetType();
        }

        emit CrossChainReceived(sourceChainSelector, assetData.assetType);
    }

    // Helper functions to get asset data (these would be implemented based on your iExec contract structure)
    function getAppData(IApp app) internal view returns (AppData memory) {
        return
            AppData({
                owner: msg.sender,
                name: app.m_appName(),
                appType: app.m_appType(),
                multiaddr: app.m_appMultiaddr(),
                checksum: app.m_appChecksum(),
                mrEnclave: app.m_appMREnclave()
            });
    }

    function getDatasetData(IDataset dataset) internal view returns (DatasetData memory) {
        // Placeholder implementation
        return
            DatasetData({
                owner: msg.sender,
                name: dataset.m_datasetName(),
                multiaddr: dataset.m_datasetMultiaddr(),
                checksum: dataset.m_datasetChecksum()
            });
    }

    function getWorkerpoolData(
        IWorkerpool workerpool
    ) internal view returns (WorkerpoolData memory) {
        // Placeholder implementation
        return
            WorkerpoolData({owner: msg.sender, description: workerpool.m_workerpoolDescription()});
    }

    function withdraw(address _beneficiary) public onlyOwner {
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToWithdraw();
        (bool sent, ) = _beneficiary.call{value: amount}("");
        if (!sent) revert FailedToWithdrawEth(msg.sender, _beneficiary, amount);
    }

    function withdrawToken(address _beneficiary, address _token) public onlyOwner {
        uint256 amount = IERC20(_token).balanceOf(address(this));
        if (amount == 0) revert NothingToWithdraw();
        IERC20(_token).safeTransfer(_beneficiary, amount);
    }

    // Call by the CCIP router on receive
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return
            interfaceId == type(IAny2EVMMessageReceiver).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    // Function to receive Ether
    receive() external payable {}
}
