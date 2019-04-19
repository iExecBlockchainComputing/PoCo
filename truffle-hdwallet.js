
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
        ... 0xad6d3e61ba7c2fc335f14644f0285d3cb966b201981335ab1cd9211851882842
        Migrations: 0x5c5de6b1b80eee8e1431824e3931f853d0fedc0b
      Saving successful migration to network...
        ... 0x95fafef424840b34950beef3c8074bfaccb8c1ccb2a47391cac08c6a655f3e1a
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xf058caf372d72302d3efb70a9ac323f803d8b80087f352bd1fdb0b6f0718c64c
        WorkerPoolHub: 0x201d5e5bb4e865be7f9a84ff0f12a1ca1980dcbd
      WorkerPoolHub deployed at address: 0x201d5e5bb4e865be7f9a84ff0f12a1ca1980dcbd
        Deploying AppHub...
        ... 0x06fa7774178e9297bf510c524714fcd999ab7790c44965dfaf744e9b0ebccb64
        AppHub: 0x700425c7684e069c27ec3b3784a22025f95c6057
      AppHub deployed at address: 0x700425c7684e069c27ec3b3784a22025f95c6057
        Deploying DatasetHub...
        ... 0x5cf4c4c290a0b88f8e568c0bb9869b07f37ec9c8aff5b2d5a6b58d1385d97493
        DatasetHub: 0xc6ce0a9928ac8da11e34c7f8ac174af058162295
      DatasetHub deployed at address: 0xc6ce0a9928ac8da11e34c7f8ac174af058162295
        Deploying IexecHub...
        ... 0xf5247ed94fa4ae172b9a9f830aac8ca799b94af3f8bc185bc3fd2117ead1f50f
        IexecHub: 0x374bb77dd977716f813b820f5737cfc9a7a7aa05
      IexecHub deployed at address: 0x374bb77dd977716f813b820f5737cfc9a7a7aa05
        ... 0x94ad95c7e80f69a4c4f7762811a0467e961cafd9f4f41e4c3185a41fd14e5693
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0x2c205da845a051c60bbefdc3895959a4886ad2a7290280a67257f0319c1c58a7
      transferOwnership of AppHub to IexecHub
        ... 0x233a9bb5c643b0b1e471d5e1b04b07284aefd30b6ab14acc0fb04986e839f02f
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0x1a0a2f0e05e969cd0887a8d4113c6824f602e3bc55613307c95cc48bdd35a494
        Marketplace: 0x446ff67e20cdffcd427946cc3b6fa9ec411bf5c3
      Marketplace deployed at address: 0x446ff67e20cdffcd427946cc3b6fa9ec411bf5c3
        ... 0xdcc1f194ec32690756f2e998c597fb7eee7468c22fd887cf2719ef911e056660
      attach Contracts to IexecHub done
        ... 0x589a1ef5e1029d39719680cf708e2bf188b27d7ecf7f708adac602ec398b415a
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : Mega
        ... 0xf8ef1e7f49b3bded46ba07a6544852c656d6e62b65236b219a306362ea323ae4
      create category : MegaPlus
        ... 0x8631d4430758979c18583dfaae4827f4d354276fea0b5ac1de7a87c48b4b1dd8
      create category : Giga
        ... 0x7b85bbab7a6892d160e52bea9b54f1b471cfdfac8874fb1d7e12e3cf095be418
      create category : GigaPlus
        ... 0x7206e94cc1f929305bbe2ef29cc863f32ba5018545f497ddb40ae27995ff6478
      create category : GigaGrande
        ... 0x21fe3027d572b13d999b8f6e863a4f33040871d3438455328a13f18f8ce3b157
      create category : GigaMax
        ... 0xe2db7a9faedb4abcd87bd011f4314462e5b7714d9e3550f151f93209c3ab3b8d
      m_categoriesCount is now: 6
      Saving successful migration to network...
        ... 0xac25b2960c1c3d4e67dc6ab133e81bf1e5ba694deb93dd0a41f821a1d043c8ab
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
        ... 0x361324899f441d4cc6ebcee0e207231f373bd658633ab28923c7370afd4859b0
        Migrations: 0x6a6446fd53ff278e8e08ea97d6f85802bc0061fd
      Saving successful migration to network...
        ... 0x98d93a02a5940cf863407a3997542c1983c9f21f2634aca6ac47df93a7b83a67
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0x04097a44fd9a1078aeb9f182bc91b42c0b799373f7593afc92e8c3a532d794bb
        WorkerPoolHub: 0x4f9aaf6f6244cdee53c8147eb2839aeae548a207
      WorkerPoolHub deployed at address: 0x4f9aaf6f6244cdee53c8147eb2839aeae548a207
        Deploying AppHub...
        ... 0x222fbb484370bea62e90bdc12a1c12ed107e0135588f87851be74c9445d52d48
        AppHub: 0x2a3827b9f8d5aaf187eb2aeaa60b3bf2e1306475
      AppHub deployed at address: 0x2a3827b9f8d5aaf187eb2aeaa60b3bf2e1306475
        Deploying DatasetHub...
        ... 0x72cd7fbf9a9c4863ef96c2806e159befc6c72806b832e0aff675f977691d2bdc
        DatasetHub: 0x9542f1373ff375f5c6213a761e97c3ea6eb91cad
      DatasetHub deployed at address: 0x9542f1373ff375f5c6213a761e97c3ea6eb91cad
        Deploying IexecHub...
        ... 0x8f48edb65d695eff021a68bdb3f4d8834d79d0ad0a1564902ad9105f6c908306
        IexecHub: 0xb6c77a4a16cc3373a46f1d143c67f09127a6a086
      IexecHub deployed at address: 0xb6c77a4a16cc3373a46f1d143c67f09127a6a086
        ... 0xc70c2a19fe626f65ba2e7791c95c1642ff1f0cb3de2d580d2bedc99ba054bbac
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0x3fc321c6195173a2c3bff680078c0552862741e6401229029218d3536c4afb8d
      transferOwnership of AppHub to IexecHub
        ... 0xde64493dc7aadb9113d5f499133a515118badabdd8d3284631bf2f13294afa6b
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0x3ee5152dc2ba18cbadfb33ad8845277718e755c685b07de4229b0fb3600097c7
        Marketplace: 0xf7ef6b1052ad2d7a8400cb2a9bfec1dd5e1eac90
      Marketplace deployed at address: 0xf7ef6b1052ad2d7a8400cb2a9bfec1dd5e1eac90
        ... 0x649460043b755ba2276c0c1f59b45fddf1ff56c48b95658a41ed584de57da69c
      attach Contracts to IexecHub done
        ... 0x230ceff4f9dd1d28eafae45b791f2331927b5f2f12a8d49d3f0691874be280fa
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : Mega
        ... 0xc5de531b190cb15bf6431bc9aa0f53152d79149e2501f1007481fcf718da8d93
      create category : MegaPlus
        ... 0xcb5fcfdf69c00b7e8a8f4cdf148011a03e12f30ba7c4fb4653b16957f03a03f4
      create category : Giga
        ... 0x1b6f6573ba822e067cb1a002e8d133d6c33c1d89cfd3839ea80c73e298396a7b
      create category : GigaPlus
        ... 0xf4d7633ef7cd21abf5110bb40e2a6a07e87090b189e31daf4e89765e707677fd
      create category : GigaGrande
        ... 0x476f8f4c1039e6c8854528588a09016d17a342c726a729596fcc9acc30b0cb31
      create category : GigaMax
        ... 0x700a302c41d08582740a8bfdf1ead75f13b05d3f78af642795fcb1eed60f3179
      m_categoriesCount is now: 6
      Saving successful migration to network...
        ... 0x0fa7f2a735ebce0f11e61b70247875562895795e56cd089bd7c8d1310c88e36d
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
        version: "0.5.7",
        optimizer: {
            enabled: true,
            runs: 200
        }
    },
    mocha: {
        enableTimeouts: false
    }
};
