/******************************************************************************
 * Copyright 2020 IEXEC BLOCKCHAIN TECH                                       *
 *                                                                            *
 * Licensed under the Apache License, Version 2.0 (the "License");            *
 * you may not use this file except in compliance with the License.           *
 * You may obtain a copy of the License at                                    *
 *                                                                            *
 *     http://www.apache.org/licenses/LICENSE-2.0                             *
 *                                                                            *
 * Unless required by applicable law or agreed to in writing, software        *
 * distributed under the License is distributed on an "AS IS" BASIS,          *
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.   *
 * See the License for the specific language governing permissions and        *
 * limitations under the License.                                             *
 ******************************************************************************/

// ERC1538 core & delegates
var ERC1538Proxy = artifacts.require('@iexec/solidity/ERC1538Proxy')
var ERC1538Query = artifacts.require('@iexec/solidity/ERC1538QueryDelegate')

/*****************************************************************************
 *                                   Main                                    *
 *****************************************************************************/
module.exports = async function(deployer, network, accounts)
{
	const ERC1538QueryInstace = await ERC1538Query.at((await ERC1538Proxy.deployed()).address);
	const functionCount = await ERC1538QueryInstace.totalFunctions();

	console.log(`The deployed ERC1538Proxy supports ${functionCount} functions:`);
	(await Promise.all(
		Array(functionCount.toNumber()).fill().map((_, i) => ERC1538QueryInstace.functionByIndex(i))
	))
	.forEach((details, i) => console.log(`[${i}] ${details.delegate} ${details.signature}`));
};
