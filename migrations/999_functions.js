// SPDX-FileCopyrightText: 2020 IEXEC BLOCKCHAIN TECH <contact@iex.ec>
// SPDX-License-Identifier: Apache-2.0

// ERC1538 core & delegates
var ERC1538Proxy = artifacts.require('@iexec/solidity/ERC1538Proxy');
var ERC1538Query = artifacts.require('@iexec/solidity/ERC1538QueryDelegate');

/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async function () {
    const ERC1538QueryInstace = await ERC1538Query.at((await ERC1538Proxy.deployed()).address);
    const functionCount = await ERC1538QueryInstace.totalFunctions();

    console.log(`The deployed ERC1538Proxy supports ${functionCount} functions:`);
    (
        await Promise.all(
            Array(functionCount.toNumber())
                .fill()
                .map((_, i) => ERC1538QueryInstace.functionByIndex(i)),
        )
    ).forEach((details, i) => console.log(`[${i}] ${details.delegate} ${details.signature}`));
};
