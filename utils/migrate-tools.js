const { basename } = require('path');

/*
Since truffle v5.7.0, the ABI resolve algorithm has changed.
- Before v5.7.0, the last valid ABI json file was selected
- Since v5.7.0, the first valid ABI json file is selected 

See changes here:
Old version:
https://github.com/trufflesuite/truffle/blob/28d00b8946b7e8d792f87bfe35c94af6cedc401b/packages/resolver/lib/resolver.ts#L64
New version:
https://github.com/trufflesuite/truffle/blob/c984fe37b740ee075ba93f2ebfd59b7cae4f0183/packages/resolver/lib/resolver.ts#L61

Calling artifacts.require(<NPM path>) now throws an error when 
deploying any new contract (RLC, ERLCTokenSwap, ERC1538Proxy etc.)

Consequently, to keep the exact same behaviour and avoid any error thrown at migration time, 
we must force truffle to select the last compiled ABI located in the truffle build directory
instead of the NPM directory.
 
For example, in the case of the RLC.json ABI:
instead of executing : 
    var RLC = artifacts.require('rlc-faucet-contract/RLC');
 
first look for RLC.json in the build directory, then in the NPM directory : 
    var RLC = artifacts.require('RLC');
    if (!RLC) {
        RLC = artifacts.require('rlc-faucet-contract/RLC');
    }
*/

function artifactsRequireFSThenNPM(contractPath) 
{
    const name = basename(contractPath);
    let contract;
    try 
    {
        // ex: if contractPath == 'rlc-faucet-contract/RLC'
        // executes: artifacts.require('RLC') to force the truffle 
        // resolver to pick './build/contracts/RLC.json' instead of 
        // './node_modules/rlc-faucet-contract/RLC.json'
        contract = artifacts.require(name);
    } 
    catch (err) 
    {
        // ex: contractPath == 'RLC' : nothing else to do
        if (name == contractPath) {
            throw err;
        }
        // ex: if contractPath == 'rlc-faucet-contract/RLC'
        // At this stage, the truffle resolver did not find the
        // './build/contracts/RLC.json' ABI file, consequently
        // we force the resolver to pick instead
        // './node_modules/rlc-faucet-contract/RLC.json'
        contract = artifacts.require(contractPath);
    }
    return contract;
}

module.exports = {
    artifactsRequireFSThenNPM
}