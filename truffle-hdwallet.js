
var HDWalletProvider = require("truffle-hdwallet-provider");
var mnemonic = "12 words";
//0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC

module.exports = {
  networks: {
    ropsten: {
      provider: new HDWalletProvider(mnemonic, "https://ropsten.infura.io/berv5GTB5cSdOJPPnqOq"),
      network_id: "3",
      gas: 4710000,
      gasPrice: 22000000000,
      /*
      Using network 'ropsten'.

Running migration: 1_initial_migration.js
  Deploying Migrations...
  ... 0x1a2c06cad52560461769f84f7cc05504d371f3f90923d75c5188bf8f108e899a
  Migrations: 0x670ed4bb1fd989cfaae1b6e508663f9174e74901
Saving successful migration to network...
  ... 0x943fa1a21592f23c19d0ca46939c366d46a8782346425e600d3ef7acae63a196
Saving artifacts...
Running migration: 2_deploy_contracts.js
  Deploying WorkerPoolHub...
  ... 0x279013f3b1dbd073a8cdd5d1c32c3a37535a450c1e9b78e21a472ace3911c8d9
  WorkerPoolHub: 0x3fb50bb0716e0967c2c76599aad214b62b9b74c8
WorkerPoolHub deployed at address: 0x3fb50bb0716e0967c2c76599aad214b62b9b74c8
  Deploying AppHub...
  ... 0xae025e17048ceff49be9b9f35c0642443c4f6d1d6dd4b42ca638795227e2a789
  AppHub: 0x7f9884f75571e5ace278e71ea9b2f035d71601f3
AppHub deployed at address: 0x7f9884f75571e5ace278e71ea9b2f035d71601f3
  Deploying DatasetHub...
  ... 0x2ee1aeb9027d9420ef79e393815d42333353be2381ffa0c2ec5516bfd3792c14
  DatasetHub: 0x97f2f83bfbf3bf9b9f641204ace4ba6cfe8f3c3e
DatasetHub deployed at address: 0x97f2f83bfbf3bf9b9f641204ace4ba6cfe8f3c3e
  Deploying IexecHub...
  ... 0x6d78bf5941175a90e47bcc48c4ada49012632ec57178a420fb43d59b5810955d
  IexecHub: 0x8bbf09dc4514077b60a45cbd6d8294111534500d
IexecHub deployed at address: 0x8bbf09dc4514077b60a45cbd6d8294111534500d
  ... 0x9cdfccd9c7ce5b1467789fa7aa5f6299bb39ba7ddec31bbde639a33950a94428
transferOwnership of WorkerPoolHub to IexecHub
  ... 0xe986c81943eb28132afe87b57b13f605d2855740f41de119fe2461369e72c7f0
transferOwnership of AppHub to IexecHub
  ... 0x34e87fcfb224f0ef6b39bdd69e4f65f028f6dda920b012f75c50fe0dbc8b5a0e
transferOwnership of DatasetHub to IexecHub
  Deploying Marketplace...
  ... 0x75198166e7e4b6f512154c27238dc5769ddfbc054ba1fa584c5856139042a008
  Marketplace: 0xdc61f092704dc567be178323a951edd59bde4736
Marketplace deployed at address: 0xdc61f092704dc567be178323a951edd59bde4736
  ... 0x5393c4123b07388c8e26abe6961d6f07f7f5293129a2664b71c29e2687c9a989
attach Contracts to IexecHub done
  ... 0x9a1df7c907cd7c4ff6d590b0c159c41a8183974891a82403a4079bc93bc4d620
setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
create category : Mega
  ... 0x3209da0d74e8c7834f2263d81c803c2fd7c6396985db9539c1465db5c464b481
create category : MegaPlus
  ... 0x2a0d51bf9b32f1597b350fb2759405acaac348e5a3822b93a12dbb4f8c2e8bb8
create category : Giga
  ... 0x27929ba3ca9e69bacb7ae0177c1e9ed9a7d51538956927bffa4d2216ec082ce6
create category : GigaPlus
  ... 0x5d7438816bcb2a31d070ddc12f0a861370bacac97fd22abb9d77a504e26ce888
create category : GigaGrande
  ... 0xc248f5f6df634cc2d4212d54fd81115903d59f51170d48b4bbb3227e10f06aaf
create category : GigaMax
  ... 0x7ea52b20d32ce3465a46c64990ee28b8808b0c67272564d9c7b120c309af9cbd
m_categoriesCount is now: 6
Saving successful migration to network...
  ... 0x79f172716e77c86fd7dba8928846d10b46cd4be9079343a6394fcefc9f5a2479
Saving artifacts...

      */
    },
    rinkeby: {
      provider: new HDWalletProvider(mnemonic, "https://rinkeby.infura.io/berv5GTB5cSdOJPPnqOq"),
      network_id: "4",
      gas: 4710000,
      gasPrice: 22000000000,

      /*
      Using network 'rinkeby'.

      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0x643cf135a3d9400426d9be9c7e131e400f07c679caf1caecf3eed769eb702d40
        WorkerPoolHub: 0x24f4c2d90a12939427e18a47702b468729e7b522
      WorkerPoolHub deployed at address: 0x24f4c2d90a12939427e18a47702b468729e7b522
        Deploying AppHub...
        ... 0x5dd318fec365f35d58b3bc98335896bac61064957a8a3a62eea67ea1ab463e69
        AppHub: 0xd59b85ebe967474915ac9d4c4ef58294d713609e
      AppHub deployed at address: 0xd59b85ebe967474915ac9d4c4ef58294d713609e
        Deploying DatasetHub...
        ... 0xacfb98da7a168711e19942bb151e4a1c780dbd19084b432f0e1ca363f360c211
        DatasetHub: 0xf7ef6b1052ad2d7a8400cb2a9bfec1dd5e1eac90
      DatasetHub deployed at address: 0xf7ef6b1052ad2d7a8400cb2a9bfec1dd5e1eac90
        Deploying IexecHub...
        ... 0x09d0a1915e2c7168ebefd6675d5945dc4c96accaa47f05aeb9ebbec4ce0aba93
        IexecHub: 0x745a85b596784dd0883874ac2f38434d604b9331
      IexecHub deployed at address: 0x745a85b596784dd0883874ac2f38434d604b9331
        ... 0x9e3dc4ac6821b3b73bdd4c59a23c0e0af2657525ec1f8714a01b928efb28a9ab
      setImmutableOwnership of WorkerPoolHub to IexecHub
        ... 0x9061206f92b523a4cc837391aa82e0246ba02488df86fab980df93a9c7610a92
      setImmutableOwnership of AppHub to IexecHub
        ... 0xec23009bae74446501f5894916478742b0143ad754c2ee4dcc5f99ed30eb7533
      setImmutableOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0x708fa3d5838eaf3dd1137ad3c32f05f086601a4392f67eec6dff6a04387c7e00
        Marketplace: 0x9ef1031cd9bc4d5d89aee514381b609cf234eab2
      Marketplace deployed at address: 0x9ef1031cd9bc4d5d89aee514381b609cf234eab2
        ... 0x1db6b209ad8ef783c5f1aa5ca36adc59318afb0abaf89b07880cae837a96185a
      attach Contracts to IexecHub done
        ... 0x009a2692a1d22038f3e47e86efb9a3425748b0fd6aae5ed470563be5e2872ca5
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : 1
        ... 0x5ae267c5a52afda83e42d97d22040edfb2815c8145ab852412de76d831f2d613
      create category : 2
        ... 0x63bfe2dd2dec2a0a09dd5ab8d9a78f976fe20486e9a111fc20e9ebba6757d449
      create category : 3
        ... 0xaceae403a13085d61cf21cc57c19a2957e63f56e346c91510dac6d4e0698df10
      create category : 4
        ... 0x2b447a4d45d35b1b4e1fd0ee5987e9ff24035b4dfc3e3e72e00f307f6003dfaa
      create category : 5
        ... 0xd6043dc27e26b30e279818bed273b436918ba4c56f51c4d802894f4752136c0f
      m_categoriesCount is now: 5
      Saving successful migration to network...
        ... 0x7d3fced57dcf9f094a4a6f4fd7330fec2d46a456b82d09fc651bf6a9af7ebf5e
      Saving artifacts...
      */
    },
    kovan: {
      provider: new HDWalletProvider(mnemonic, "https://kovan.infura.io/berv5GTB5cSdOJPPnqOq"),
      network_id: "42",
      gas: 4710000,
      gasPrice: 22000000000,
      /*
      Using network 'kovan'.

      Running migration: 1_initial_migration.js                                                                                                                                               [0/1923]
      Deploying Migrations...
      ... 0x776e7a94bd8bfd25368397fb52f708da383d7e7b6c56025c5cdcd3379e7abc1f
      Migrations: 0x01df6cdb1c9c4fc061e1310331518727468e1ed1
    Saving successful migration to network...
      ... 0x5f6bea9735f873ef3c44bf9f1feae71e5aee0a8a0d69834095dd2703b31c74cf
    Saving artifacts...
    Running migration: 2_deploy_contracts.js
      Deploying WorkerPoolHub...
      ... 0xb5b4edc991a3784537e37c16e580925afe3b074fd90943bade43f35fbfbe273e
      WorkerPoolHub: 0x09890378fca09f564113a163b04f926e3fb1cce3
    WorkerPoolHub deployed at address: 0x09890378fca09f564113a163b04f926e3fb1cce3
      Deploying AppHub...
      ... 0x6a94befac5d5fc228ae374f5915938319b46a4151bfb471094eb28f8a74228d4
      AppHub: 0xaeeded79c9167f1980685eed90bb3a18c3186408
    AppHub deployed at address: 0xaeeded79c9167f1980685eed90bb3a18c3186408
      Deploying DatasetHub...
      ... 0x62a82b8dbf56cf47c4c29d4f84743d1debda942a008e14dc1237b86d7aec26d1
      DatasetHub: 0xf2dfcc63eafc1fcd37c3b92f3263374f7d6c6d56
    DatasetHub deployed at address: 0xf2dfcc63eafc1fcd37c3b92f3263374f7d6c6d56
      Deploying IexecHub...
      ... 0xa6f40c0874dcd149347e4a8a755260a0ade3458fbe359a5811a13139b36f8405
      IexecHub: 0x33229f7f4213b66f85126f06d9239a36da6e3003
    IexecHub deployed at address: 0x33229f7f4213b66f85126f06d9239a36da6e3003
      ... 0x4ca68a22490c148108e0c54e46bbf66dab383ebe4cd972929c071844d2f2bd50
    setImmutableOwnership of WorkerPoolHub to IexecHub
      ... 0xfbf1041bb751c1f88a7b5917a128892ff174500f163183fb09a08d79158177c9
    setImmutableOwnership of AppHub to IexecHub
      ... 0x242b2b1d44df4eec982ebac4f5528447f53a6dc789dbd35bca9ab54a3de35b47
    setImmutableOwnership of DatasetHub to IexecHub
      Deploying Marketplace...
      ... 0xc56ee95a08c3d1a8b7f5ae604d58e1f35aca20967ee53e53b5a244eebd1bed65
      Marketplace: 0x1f4629a34c67c0f483e3fb9da40ac2dd4b7c08e0
    Marketplace deployed at address: 0x1f4629a34c67c0f483e3fb9da40ac2dd4b7c08e0
      ... 0x3fda876fd1ce03a3253ad913d3174f75d5b5587be5d3af8e389faf46e867e7f6
    attach Contracts to IexecHub done
      ... 0xcf78b6608ab2551fbe04d743b6b26e835e7e92f76af382ecddd1dadc74fafe37
    setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
    create category : 1
      ... 0x3e27af69957287b536241745b31c6f61e421084bf1a751a8def62563dee7ee27
    create category : 2
      ... 0xc13369b4554d26f513d56a8a829b0ee2685346f1f4b535235998acbfa64c1345
    create category : 3
      ... 0x90dfb98a3f4064cf8af7788efce0a3b3f7202ac02dec589dc9047f2515e2b11b
    create category : 4
      ... 0x04407b2e5d5e0ca9c8c1539d5b038a6f365707832e9bbbc875f17f0b30c8ebbd
    create category : 5
      ... 0x48278a42902d576c7f27470c039e45155017794b06834a0a5982ac223989cdb3
    m_categoriesCount is now: 5
    Saving successful migration to network...
      ... 0x7048baed63946823e8f0a7b207695dfbb3d7df4bd82f0ff221ede9f8cc51d646
    Saving artifacts...
      */


    },/*
    mainnet: {
        provider: new HDWalletProvider(mnemonic, "https://mainnet.infura.io/berv5GTB5cSdOJPPnqOq"),
        network_id: "1",
        gas: 4400000,
        gasPrice: 22000000000,
    },*/
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
