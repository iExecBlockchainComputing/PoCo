// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
interface ILaPoste {
    //###########################
    // Enums
    //###########################
    enum PayFeesIn {
        Native,
        LINK
    }

    enum AssetType {
        App,
        Dataset,
        Workerpool
    }

    //###########################
    // Errors
    //###########################
    error InvalidRouter(address router);
    error NotEnoughBalanceForFees(uint256 currentBalance, uint256 calculatedFees);
    error NothingToWithdraw();
    error FailedToWithdrawEth(address owner, address target, uint256 value);
    error ChainNotEnabled(uint64 chainSelector);
    error SenderNotEnabled(address sender);
    error OperationNotAllowedOnCurrentChain(uint64 chainSelector);
    error InvalidAssetType();
    error AssetAlreadyDeployed();
    error AssetNotLocked();
    error TransferFailed();

    //###########################
    // Events
    //###########################
    event ChainEnabled(uint64 chainSelector, address bridgeAddress, bytes ccipExtraArgs);
    event ChainDisabled(uint64 chainSelector);
    event AssetLocked(
        address assetAddress,
        address owner,
        AssetType assetType,
        uint64 destinationChainSelector
    );
    event AssetUnlocked(
        address assetAddress,
        address owner,
        AssetType assetType,
        uint64 sourceChainSelector
    );
    event CrossChainSent(bytes32 messageId, uint64 destinationChainSelector, AssetType assetType);
    event CrossChainReceived(uint64 sourceChainSelector, AssetType assetType);

    struct BridgeDetails {
        address bridgeAddress;
        bytes ccipExtraArgsBytes;
    }

    struct AppData {
        address owner;
        string name;
        string appType;
        bytes multiaddr;
        bytes32 checksum;
        bytes mrEnclave;
    }

    struct DatasetData {
        address owner;
        string name;
        bytes multiaddr;
        bytes32 checksum;
    }

    struct WorkerpoolData {
        address owner;
        string description;
    }

    struct AssetData {
        AssetType assetType;
        bytes data;
    }
}
