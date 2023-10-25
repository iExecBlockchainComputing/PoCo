// SPDX-FileCopyrightText: 2023 IEXEC BLOCKCHAIN TECH

const { TruffleDeployer: Deployer } = require('../../utils/FactoryDeployer');

/*****************************************************************************
 *                                   Tools                                   *
 *****************************************************************************/
function getSerializedObject(entry) {
    return (entry.type == 'tuple')
        ? `(${entry.components.map(getSerializedObject).join(',')})`
        : entry.type;
}
function getFunctionSignatures(abi) {
    return [
        ...abi
            .filter(entry => entry.type == 'receive')
            .map(entry => 'receive;'),
        ...abi
            .filter(entry => entry.type == 'fallback')
            .map(entry => 'fallback;'),
        ...abi
            .filter(entry => entry.type == 'function')
            .map(entry => `${entry.name}(${entry.inputs.map(getSerializedObject).join(',')});`),
    ].filter(Boolean).join('');
}
exports.getFunctionSignatures = getFunctionSignatures;
