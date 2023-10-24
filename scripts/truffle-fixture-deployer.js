/******************************************************************************
 * Copyright 2023 IEXEC BLOCKCHAIN TECH                                       *
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

const initial_migration = require('../migrations/1_initial_migration.js')
const deploy_token = require('../migrations/3_deploy_token.js')
const deploy_core = require('../migrations/4_deploy_core.js')
const deploy_ens = require('../migrations/5_deploy_ens.js')
const whitelisting = require('../migrations/6_whitelisting.js')
const functions = require('../migrations/999_functions.js')

async function deployAllContracts() {
    console.log("Migrating contracts..")
    await initial_migration()
    const accounts = await web3.eth.getAccounts()
    await deploy_token(accounts)
    await deploy_core(accounts)
    await deploy_ens(accounts)
    await whitelisting(accounts)
    await functions(accounts)
}

module.exports = {
    deployAllContracts
};
