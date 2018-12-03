
var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "12 words";
//0x486A5986f795D323555C0321d655f1Eb78d68381

module.exports = {
  networks: {
    kovan: {
      provider: new HDWalletProvider(mnemonic, "https://kovan.infura.io/berv5GTB5cSdOJPPnqOq"),
      network_id: "42",
      gas: 6721975,
      gasPrice: 100000000000,
      /*
    Running migration: 1_initial_migration.js
  Deploying Migrations...
  ... 0x2b843803217f4819e1346ea5196e4a1b8e18f8d8dc8de34124aaf456544cef6e
  Migrations: 0xc9219af80e49d569577b588e1289e6ea4218168a
Saving successful migration to network...
  ... 0x097e4d3f7f399e830de578f65ca80623e5ced0eb8698193dbd2777fd5ffa0f57
Saving artifacts...
Running migration: 2_deploy_contracts.js
  Deploying IexecAPI...
  ... 0x67bea329fb03e3037352f13f193f6d9a4c54d1403bab701bb9207e25607e8198
  IexecAPI: 0xf1b2550e4ea1c4ffae1dfb790948c895614e4457
IexecAPI deployed at address: 0xf1b2550e4ea1c4ffae1dfb790948c895614e4457
Saving successful migration to network...
  ... 0x9f681eb3164aac5de69150e6844a578fff9ed0dd3e80c09db4b89747964a4d69
Saving artifacts...
      */
    },
  },
    solc: {
        optimizer: {
            enabled: true,
            runs: 200
        }
    },
    mocha: {
        enableTimeouts: false
    }
};
