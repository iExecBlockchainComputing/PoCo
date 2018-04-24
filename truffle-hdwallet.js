
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

      Running migration: 1_initial_migration.js
        Deploying Migrations...
        ... 0x13171ebc1d23e5e5033c536e69021e6d56418cbd472f0cc66f796a6478bcf8b4
        Migrations: 0x45cbd2d0e9a913f17669f226727b1849ff7bfcb7
      Saving successful migration to network...
        ... 0x22585c3899a99ad6547c48d109621fb73fbea1006f72c5eb22bcc323286f31e6
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0x3db74ce812efda0e43c9bb3105c59116f116f9797e55d3231e0a8cf4d86fbddb
        WorkerPoolHub: 0xce72d26a3bf413c76254e6d6af9745ff11383135
      WorkerPoolHub deployed at address: 0xce72d26a3bf413c76254e6d6af9745ff11383135
        Deploying AppHub...
        ... 0xae81343bafb8a275a59f84a6d20221364b9d37100f450a49792c1c0fc5bbd7f3
        AppHub: 0x71cb68b0d9bf2b4a03c2caa6ea54773ba413163f
      AppHub deployed at address: 0x71cb68b0d9bf2b4a03c2caa6ea54773ba413163f
        Deploying DatasetHub...
        ... 0xbb70e28561843a385dc2afdf2baa81da69769e46f536ec9f1fd72dd34373bc98
        DatasetHub: 0x07e12c896a86c54ad0a068fca5f0d0cd9e02aba0
      DatasetHub deployed at address: 0x07e12c896a86c54ad0a068fca5f0d0cd9e02aba0
        Deploying IexecHub...
        ... 0x84a1182aa50da0649342b54ad837bf37dcb9c46ccd7d6547391e4a5daee77638
        IexecHub: 0x0439c512222d00c0e197d9b4f8bce6198a9902e4
      IexecHub deployed at address: 0x0439c512222d00c0e197d9b4f8bce6198a9902e4
        ... 0xcf672d6dcac0ec9105ea0a324a90f30b8229e34883b02a834ec72c4c16cce33d
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0x6547118e2fc0be1f2d8c44a8c1f335a9293100f814ddd66a1584580b9bf1af48
      transferOwnership of AppHub to IexecHub
        ... 0x12d9d882199d0a67a24085ccaace9bbe821021ab55ec051fc951615925b854a5
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0xf33d9f86bd2ad148266888584474820ca71fc78176aaad827428e5579a1d2421
        Marketplace: 0xfdb29ec352ad5efea3fad3cf1eeb6f9e61a1c1c7
      Marketplace deployed at address: 0xfdb29ec352ad5efea3fad3cf1eeb6f9e61a1c1c7
        ... 0x64a2ea020d7c63d9f1cc32fececa6385256542631ecc275dd1641fd0eef900dd
      attach Contracts to IexecHub done
        ... 0x7d4e46de74449f36a5c067a2730eff136f162c27f363318987ee098608408f7a
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : 1
        ... 0xb26231545fa9c49491bb9e264abe07e7db1dfa7649ee6a99dba30d6ca538f81d
      create category : 2
        ... 0x1e252ff8857710990be91fef28088ac220008f3c810642753759b63cea912a20
      create category : 3
        ... 0x25b1d2e75350e1ae19d25d828efe140e464eb67bd73fa63e966f11af1c77aa05
      create category : 4
        ... 0x81cbc28d564675748defa7c5425e827a51b80a0cd2755d2920d8e1b958af90ad
      create category : 5
        ... 0x9ac6b88e1a345a2e21c71cf1f8740c0f06644df14e3d80be6b6b93ec8f2632e4
      m_categoriesCount is now: 5
      Saving successful migration to network...
        ... 0x043526e478270f90fdb2c949de758d2d33f322b7833ac0d8020087e31b319193
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

      Running migration: 1_initial_migration.js
        Deploying Migrations...
        ... 0xba892965edfbf968f96a19b1de8796241791cd8851f151da53d1cffb61c9e0be
        Migrations: 0x76b8c862234eb74aaa030c68f01c8d4baaeee5ee
      Saving successful migration to network...
        ... 0xc5d72ca17f82ec08696e349ad6ef5f244e6d2d7458b4cd519176e1915764ba86
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xcfe9554fa8a29889afd7a25dd50a308549f7512b9706f18a6abe0361946abe19
        WorkerPoolHub: 0x09e045d87158a06035d0204d13cc9199779a233d
      WorkerPoolHub deployed at address: 0x09e045d87158a06035d0204d13cc9199779a233d
        Deploying AppHub...
        ... 0x1b49c194175d9debed9c88760e6994f0026d2fc302efdadf0bf7729f9b0464a1
        AppHub: 0xab9f3c7737caa21421046f0d453ef792c9d9667c
      AppHub deployed at address: 0xab9f3c7737caa21421046f0d453ef792c9d9667c
        Deploying DatasetHub...
        ... 0xbfb5913f0a958aa892366bffb12a12ea9da5a69a1448d6db093ee829b73d336e
        DatasetHub: 0x4d4f1096e353b288b7f815a3c0bb878b3e0fa930
      DatasetHub deployed at address: 0x4d4f1096e353b288b7f815a3c0bb878b3e0fa930
        Deploying IexecHub...
        ... 0x53392c4d4a16a723751578c32e9045e466a37a894e8c964375d53a7104922f85
        IexecHub: 0xd6fac685e694fcfb60738fa50bac7cd4c0bad7db
      IexecHub deployed at address: 0xd6fac685e694fcfb60738fa50bac7cd4c0bad7db
        ... 0x449e1e8454492b5a30dce570bd2df29a2d4a888f443af4b7906babdfaf638f22
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0x27e926baf1d3bcbc0de60a2762f0ef6499eda7a7d89084df1a03fd9f71c3c255
      transferOwnership of AppHub to IexecHub
        ... 0x3559b3c8a96d9e8a95efda24f515d7c4b2562a4419dd7d244de406025c06f061
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0xa13fbf77364049cc20126a520dd578fbc6d774eeb2a05c53b66fb0c64a9e45a2
        Marketplace: 0x32aedc290604f7a674781b232143b837a358d711
      Marketplace deployed at address: 0x32aedc290604f7a674781b232143b837a358d711
        ... 0xb66225b86ec8c181307144bb832fe3a18a92133939fcb3bc16817e66aabb0072
      attach Contracts to IexecHub done
        ... 0x855c7f5b8dba04b4818a08b512e850313f2451233df7a7b73d0f6ad52a1efd9a
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : 1
        ... 0xf7d35be5c6028761ad4c47a4fd8d4a5ed97bcd573c81d9ffe965b4d4cf9defba
      create category : 2
        ... 0x3c2e1987d78201a7b3ed96bebea5ea67aa97d4cdf38d0a53ffcda94900659a02
      create category : 3
        ... 0x8a0a60b793a41c422037adbf48aac74dea09b367f51a7ffb0466b08f70981daf
      create category : 4
        ... 0x1c9bfc3d2a117293bfcc60766ea3c7c8b610a6d624fadc1d713ded994694b319
      create category : 5
        ... 0xf07396c4bd2400567b8d0d1f9ca13677d52002ec2293862dc06bfe9ac3ba2c2e
      m_categoriesCount is now: 5
      Saving successful migration to network...
        ... 0xba462b16c8f8573b2b8764d53c30460b13a0f8a9720829f8447411b54acfddd9
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
