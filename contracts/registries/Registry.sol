// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "./proxy/InitializableUpgradeabilityProxy.sol";
import {Ownable} from "@openzeppelin/contracts-v5/access/Ownable.sol";
import {ERC721} from "@openzeppelin/contracts-v5/token/ERC721/ERC721.sol";
import {Create2} from "@openzeppelin/contracts-v5/utils/Create2.sol";
import {IRegistry} from "./IRegistry.sol";
import {ERC721Enumerable} from "@openzeppelin/contracts-v5/token/ERC721/extensions/ERC721Enumerable.sol";

abstract contract Registry is IRegistry, ERC721Enumerable, Ownable {
    address public master;
    bytes public proxyCode;
    bytes32 public proxyCodeHash;
    IRegistry public previous;
    bool public initialized;
    string private _baseUri;

    constructor(
        address _master,
        string memory _name,
        string memory _symbol
    ) ERC721(_name, _symbol) Ownable(msg.sender) {
        master = _master;
        proxyCode = type(InitializableUpgradeabilityProxy).creationCode;
        proxyCodeHash = keccak256(proxyCode);
    }

    // TEMPORARY MIGRATION FIX: Override _checkOwner to catch custom errors and throw string errors for backward compatibility
    // TODO: Remove this override in the next major version
    function _checkOwner() internal view override {
        if (owner() != _msgSender()) {
            revert("Ownable: caller is not the owner");
        }
    }

    function initialize(address _previous) external onlyOwner {
        require(!initialized);
        initialized = true;
        previous = IRegistry(_previous);
    }

    function setBaseURI(string calldata baseUri) external onlyOwner {
        _baseUri = baseUri;
    }

    /**
     * @dev Added for retrocompatibility!
     *
     * @dev Returns the base URI set via {setBaseURI}. This will be
     * automatically added as a prefix in {tokenURI} to each token's ID.
     */
    function baseURI() public view returns (string memory) {
        return _baseURI();
    }

    /* Interface */
    function isRegistered(address _entry) external view override returns (bool) {
        return
            _ownerOf(uint256(uint160(_entry))) != address(0) ||
            (address(previous) != address(0) && previous.isRegistered(_entry));
    }

    /**
     * Sets the reverse registration name for a registry contract.
     * @dev This functionality is supported only on Bellecour Sidechain, calls on other chains
     * will revert. The function is kept as nonpayable to maintain retrocompatibility with the
     * iExec SDK.
     */
    // TODO remove this function when Bellecour is deprecated.
    function setName(address /* _ens */, string calldata /* _name */) external {
        initialized = initialized; // Remove solidity state mutability warning.
        revert("Operation not supported on this chain");
    }

    /* Factory */
    function _mintCreate(address _owner, bytes memory _args) internal returns (address) {
        // Create entry (proxy)
        address entry = Create2.deploy(0, keccak256(abi.encodePacked(_args, _owner)), proxyCode);
        InitializableUpgradeabilityProxy(payable(entry)).initialize(master, _args);
        // Mint corresponding token
        _mint(_owner, uint256(uint160(entry)));
        return entry;
    }

    function _mintPredict(address _owner, bytes memory _args) internal view returns (address) {
        address entry = Create2.computeAddress(
            keccak256(abi.encodePacked(_args, _owner)),
            proxyCodeHash
        );
        return entry;
    }

    /**
     * Overridden to use `_baseUri`.
     * @dev See {ERC721-_baseURI}.
     */
    function _baseURI() internal view override returns (string memory) {
        return _baseUri;
    }
}
