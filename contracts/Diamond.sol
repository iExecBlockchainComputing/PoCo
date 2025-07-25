// SPDX-FileCopyrightText: 2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

//*************************************************************************************\
//* Adapted from Nick Mudge <nick@perfectabstractions.com> (https://twitter.com/mudgen)
//* EIP-2535 Diamonds: https://eips.ethereum.org/EIPS/eip-2535
//*
//* Implementation of a diamond.
//*************************************************************************************/

// Diamond proxy implementation adapted from Mudgen's to redirect
// `receive` and `fallback` calls to the implementations in facets.
// See diff at: https://github.com/iExecBlockchainComputing/PoCo/pull/223/commits/0562f982

import {LibDiamond} from "@mudgen/diamond-1/contracts/libraries/LibDiamond.sol";
import {IDiamondCut} from "@mudgen/diamond-1/contracts/interfaces/IDiamondCut.sol";
import {IDiamondLoupe} from "@mudgen/diamond-1/contracts/interfaces/IDiamondLoupe.sol";
import {IERC173} from "@mudgen/diamond-1/contracts/interfaces/IERC173.sol";
import {IERC165} from "@mudgen/diamond-1/contracts/interfaces/IERC165.sol";

// When no function exists for function called
error FunctionNotFound(bytes4 _functionSelector);

// This is used in diamond constructor
// more arguments are added to this struct
// this avoids stack too deep errors
struct DiamondArgs {
    address owner;
    address init;
    bytes initCalldata;
}

contract Diamond {
    constructor(IDiamondCut.FacetCut[] memory _diamondCut, DiamondArgs memory _args) payable {
        LibDiamond.setContractOwner(_args.owner);
        LibDiamond.diamondCut(_diamondCut, _args.init, _args.initCalldata);

        // Code can be added here to perform actions and set state variables.
    }

    /**
     * `fallback` function must be added to the diamond with selector `0xffffffff`.
     * The function is defined in IexecEscrow(Native/Token) facet.
     */
    fallback() external payable {
        _fallback();
    }

    /**
     * `receive` function must be added to the diamond with selector `0x00000000`.
     * The function is defined in IexecEscrow(Native/Token) facet.
     */
    receive() external payable {
        _fallback();
    }

    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    function _fallback() internal {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = ds.facetAddressAndSelectorPosition[msg.sig].facetAddress;
        if (facet == address(0)) {
            facet = ds.facetAddressAndSelectorPosition[0xffffffff].facetAddress;
        }
        if (facet == address(0)) {
            revert FunctionNotFound(msg.sig);
        }
        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }
}
