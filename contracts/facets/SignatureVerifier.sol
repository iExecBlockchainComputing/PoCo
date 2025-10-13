// SPDX-FileCopyrightText: 2020-2025 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC1271} from "@openzeppelin/contracts-v5/interfaces/IERC1271.sol";
import {MessageHashUtils} from "@openzeppelin/contracts-v5/utils/cryptography/MessageHashUtils.sol";
import {FacetBase} from "./FacetBase.sol";
import {IERC734} from "../external/interfaces/IERC734.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
// import "@iexec/solidity/contracts/ERC1654/IERC1654.sol";
import {PocoStorageLib} from "../libs/PocoStorageLib.sol";
import {FacetBase} from "./FacetBase.sol";

// TODO uncomment and fix file
contract SignatureVerifier is FacetBase {
    /**
     * Prepare message/structure predicat used for signing
     */
    function _toEthSignedMessage(bytes32 _msgHash) internal pure returns (bytes memory) {
        return abi.encodePacked("\x19Ethereum Signed Message:\n32", _msgHash);
    }

    function _toEthTypedStruct(
        bytes32 _structHash,
        bytes32 _domainHash
    ) internal pure returns (bytes memory) {
        return abi.encodePacked("\x19\x01", _domainHash, _structHash);
    }

    /**
     * recover EOA signature (support both 65 bytes traditional and 64 bytes format EIP2098 format)
     */
    function _recover(bytes32 _hash, bytes memory _sign) internal pure returns (address) {
        bytes32 r;
        bytes32 s;
        uint8 v;

        if (_sign.length == 65) // 65bytes: (r,s,v) form
        {
            assembly {
                r := mload(add(_sign, 0x20))
                s := mload(add(_sign, 0x40))
                v := byte(0, mload(add(_sign, 0x60)))
            }
        } else if (_sign.length == 64) // 64bytes: (r,vs) form → see EIP2098
        {
            assembly {
                r := mload(add(_sign, 0x20))
                s := and(
                    mload(add(_sign, 0x40)),
                    0x7fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff
                )
                v := shr(7, byte(0, mload(add(_sign, 0x40))))
            }
        } else {
            revert("invalid-signature-format");
        }

        if (v < 27) v += 27;
        require(v == 27 || v == 28, "invalid-signature-v");
        return ecrecover(_hash, v, r, s);
    }

    /**
     * Check if contract exist, otherwize assumed to be EOA
     */
    function _isContract(address account) internal view returns (bool) {
        // According to EIP-1052, 0x0 is the value returned for not-yet created accounts
        // and 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470 is returned
        // for accounts without code, i.e. `keccak256('')`
        bytes32 codehash;
        bytes32 accountHash = 0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            codehash := extcodehash(account)
        }
        return (codehash != accountHash && codehash != 0x0);
    }

    /**
     * Address to bytes32 casting to ERC734
     */
    function _addrToKey(address _addr) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(_addr)));
    }

    /**
     * Identity verification
     */
    function _checkIdentity(
        address _identity,
        address _candidate,
        uint256 _purpose
    ) internal view returns (bool valid) {
        return
            _identity == _candidate ||
            IERC734(_identity).keyHasPurpose(_addrToKey(_candidate), _purpose); // Simple address || ERC 734 identity contract
    }

    function _checkPresignature(address _identity, bytes32 _hash) internal view returns (bool) {
        PocoStorageLib.PocoStorage storage $ = PocoStorageLib.getPocoStorage();
        return _identity != address(0) && _identity == $.m_presigned[_hash];
    }

    function _checkSignature(
        address _identity,
        bytes32 _hash,
        bytes memory _signature
    ) internal view returns (bool) {
        if (_isContract(_identity)) {
            // try address(0)(_identity).isValidSignature(_hash, _signature) returns (bytes4 value) {
            //     return value == address(0)(address(0)).isValidSignature.selector;
            // } catch (bytes memory /*lowLevelData*/) {}

            return false;
        } else {
            return _recover(_hash, _signature) == _identity;
        }
    }

    function _checkSignature(
        address _identity,
        bytes memory _predicat,
        bytes memory _signature
    ) internal view returns (bool) {
        if (_isContract(_identity)) {
            // try IERC1271(_identity).isValidSignature(_predicat, _signature) returns (bytes4 value) {
            //     return value == IERC1271(address(0)).isValidSignature.selector;
            // } catch (bytes memory /*lowLevelData*/) {}

            // try IERC1654(_identity).isValidSignature(keccak256(_predicat), _signature) returns (
            //     bytes4 value
            // ) {
            //     return value == IERC1654(0).isValidSignature.selector;
            // } catch (bytes memory /*lowLevelData*/) {}

            return false;
        } else {
            return _recover(keccak256(_predicat), _signature) == _identity;
        }
    }

    function _checkPresignatureOrSignature(
        address _identity,
        bytes32 _hash,
        bytes memory _signature
    ) internal view returns (bool) {
        return
            _checkPresignature(_identity, _hash) || _checkSignature(_identity, _hash, _signature);
    }

    function _checkPresignatureOrSignature(
        address _identity,
        bytes memory _predicat,
        bytes memory _signature
    ) internal view returns (bool) {
        return
            _checkPresignature(_identity, keccak256(_predicat)) ||
            _checkSignature(_identity, _predicat, _signature);
    }
}
