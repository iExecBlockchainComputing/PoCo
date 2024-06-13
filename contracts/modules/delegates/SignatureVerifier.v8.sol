// SPDX-FileCopyrightText: 2024 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import {IERC1271} from "@openzeppelin/contracts-v5/interfaces/IERC1271.sol";
import {ECDSA} from "@openzeppelin/contracts-v5/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts-v5/utils/cryptography/MessageHashUtils.sol";

import {IERC734} from "../../external/interfaces/IERC734.sol";
import {IexecLibCore_v5} from "../../libs/IexecLibCore_v5.sol";
import {IexecLibOrders_v5} from "../../libs/IexecLibOrders_v5.sol";
import {DelegateBase} from "../DelegateBase.v8.sol";

contract SignatureVerifier is DelegateBase {
    using ECDSA for bytes32;

    /**
     * Hash a Typed Data using the configured domain.
     * @param structHash The original structure hash.
     */
    function _toTypedDataHash(bytes32 structHash) internal view returns (bytes32) {
        return MessageHashUtils.toTypedDataHash(EIP712DOMAIN_SEPARATOR, structHash);
    }

    /**
     * @notice Verify that an Ethereum Signed Message is signed by a particular account.
     * @param account The expected signer account.
     * @param message The original message that was signed.
     * @param signature The signature to be verified.
     */
    function _verifySignatureOfEthSignedMessage(
        address account,
        bytes memory message,
        bytes calldata signature
    ) internal view returns (bool) {
        return
            _verifySignature(
                account,
                MessageHashUtils.toEthSignedMessageHash(keccak256(message)),
                signature
            );
    }

    /**
     * @notice Verify that a message is signed by an EOA or an ERC1271 smart contract.
     *
     * It supports short signatures.
     * See https://eips.ethereum.org/EIPS/eip-2098[EIP-2098 short signatures]
     * & https://github.com/OpenZeppelin/openzeppelin-contracts/pull/4915
     * https://github.com/OpenZeppelin/openzeppelin-contracts/blob/v5.0.0/contracts/utils/cryptography/ECDSA.sol#L112
     *
     * @param account The expected signer account.
     * @param messageHash The message hash that was signed.
     * @param signature The signature to be verified.
     */
    function _verifySignature(
        address account,
        bytes32 messageHash,
        bytes calldata signature
    ) internal view returns (bool) {
        address recoveredAddress = address(0); // Initialize local variable
        if (signature.length == 65) {
            //slither-disable-next-line unused-return
            (recoveredAddress, , ) = messageHash.tryRecover(signature);
        } else if (signature.length == 64) {
            //slither-disable-next-line unused-return
            (recoveredAddress, , ) = messageHash.tryRecover( // short signature
                    bytes32(signature[:32]),
                    bytes32(signature[32:])
                );
        } else {
            revert("invalid-signature-format");
        }
        if (recoveredAddress == account) {
            return true;
        }
        if (account.code.length > 0) {
            try IERC1271(account).isValidSignature(messageHash, signature) returns (bytes4 result) {
                return result == IERC1271.isValidSignature.selector;
            } catch {}
        }
        return false;
    }

    /**
     * @notice Verify that a message hash is presigned by a particular account.
     * @param account The expected presigner account.
     * @param messageHash The message hash that was presigned.
     */
    function _verifyPresignature(
        address account,
        bytes32 messageHash
    ) internal view returns (bool) {
        return account != address(0) && account == m_presigned[messageHash];
    }

    /**
     * @notice Verify that a message hash is signed or presigned by a particular account.
     * @param account The expected signer or presigner account.
     * @param messageHash The message hash that was signed or presigned.
     * @param signature The signature to be verified. Not required for a presignature.
     */
    function _verifySignatureOrPresignature(
        address account,
        bytes32 messageHash,
        bytes calldata signature
    ) internal view returns (bool) {
        return
            _verifyPresignature(account, messageHash) ||
            _verifySignature(account, messageHash, signature);
    }

    /**
     * @notice
     * This function makes an external call to an untrusted contract. It has to
     * be carefully called to avoid creating re-entrancy vulnerabilities. Calls to this function
     * has to be done before updating state variables.
     *
     * @notice Verify that an account is authorized based on a given restriction.
     * The given restriction can be:
     * (1) `0x`: No restriction, accept any address;
     * (2) `0x<same-address-than-restriction>`: Only accept the exact same address;
     * (3) `0x<ERC734-contract-address>`: Accept any address in a group (having
     * the given `GROUPMEMBER` purpose) inside an ERC734 Key Manager identity
     * contract.
     * @param restriction A simple address or an ERC734 identity contract
     * that might whitelist a given address in a group.
     * @param account An address to be checked.
     */
    function _isAccountAuthorizedByRestriction(
        address restriction,
        address account
    ) internal view returns (bool) {
        if (
            restriction == address(0) || // No restriction
            restriction == account // Simple address restriction
        ) {
            return true;
        }
        if (restriction.code.length > 0) {
            try
                IERC734(restriction).keyHasPurpose( // ERC734 identity contract restriction
                        bytes32(uint256(uint160(account))),
                        GROUPMEMBER_PURPOSE
                    )
            returns (bool success) {
                return success;
            } catch {}
        }
        return false;
    }
}
