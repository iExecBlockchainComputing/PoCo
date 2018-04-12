
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
        ... 0xd9228d595461f2b40484db0e82275a270ad6625f276bf202f8fc78666a4a28d0
        Migrations: 0x9a1eb11bcbc6cf50fda67519568bec2da3f8cad0
      Saving successful migration to network...
        ... 0x0e1f3e5ac6bae9966fcfcd4078b8170f1c939718d4bf6d9b987a1be1fa69f7b8
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0x78939933dd334948d1c91429fa27a8801cf74cbbeb39686a085e24d39ad27c97
        WorkerPoolHub: 0x6fbb19d1e0c43a46bdf6b5087207b1ea1744dfb3
      WorkerPoolHub deployed at address: 0x6fbb19d1e0c43a46bdf6b5087207b1ea1744dfb3
        Deploying AppHub...
        ... 0xcda139edc12205fb09f60fd34faa3dacc82b4f7b8f1fdddec676566ae4194a4d
        AppHub: 0x90c7154bc5e77a0ff535bd9ac1ecd9cc14718f08
      AppHub deployed at address: 0x90c7154bc5e77a0ff535bd9ac1ecd9cc14718f08
        Deploying DatasetHub...
        ... 0x798b04d224257086038b2b1e70a239132ad699c2beadd529cb0a94d9a52d63d4
        DatasetHub: 0xdee768d9a781658503445cbe79e463bcf90538d5
      DatasetHub deployed at address: 0xdee768d9a781658503445cbe79e463bcf90538d5
        Deploying IexecHub...
        ... 0x595fdb692ec5f39bc86f9fa3ef73de84f07d2bfe2fe73eb932e7500ce408726e
        IexecHub: 0x12b92a17b1ca4bb10b861386446b8b2716e58c9b
      IexecHub deployed at address: 0x12b92a17b1ca4bb10b861386446b8b2716e58c9b
        ... 0x366ac6501b1571b0e62247f9fb65f6f5306d4a92312f69e6015c2612aab84295
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0xea2461d4d9d0ccf17decea86548e1e1ba7b30060ea709760c22135ce358f5438
      transferOwnership of AppHub to IexecHub
        ... 0x2ed31318d8c9f3099cdf1de63624e2d9c2aa70894cabdccb0148a1fa16cad8f5
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0x5f28ec7d433c2f21c5e90cae68bded4051817c4a5a589e0e99bea11e98a582e9
        Marketplace: 0x9315a6ae9a9842bcb5ad8f5d43a4271d297088e2
      Marketplace deployed at address: 0x9315a6ae9a9842bcb5ad8f5d43a4271d297088e2
        ... 0xb71b2150962548f87fd03bda00b030770a9afb6300ffd7181c652f76f5f4bae9
      attach Contracts to IexecHub done
        ... 0x11868d7b248d3b5713a3064270d5d123713ab9664fb913a8cb1c322114de7080
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : Mega
      create category : MegaPlus
      create category : Giga
      create category : GigaPlus
      create category : GigaGrande
      create category : GigaMax
        ... 0x167551da8b64bc99c905ffca13c925e130141f7f1fc55f49018d29a1b923037d
        ... 0x5431ce9169dc43c2a9b5cdf6bdfdf50b8e521aeef1102fd57d6a3b8cc8cab97c
        ... 0x9932fcba440f1dd4367f5a0cd067dece1ae4a86c509be553c4a92b02b0cd87a4
        ... 0xd1715be33c9bae078815c09b7c834ef7d1bc74dc2294b53f65864fd6495daa35
        ... 0x8256d14f854f571a5a59fbc266d489e40a3d7a350d3106b7d1ecaf3f4544c65b
        ... 0x30bed86521f1f107a1cdd153089d9d4d31ce120749c152d113d799b90d580436
      m_categoriesCount is now: 6
      Saving successful migration to network...
        ... 0x808191db79549f31415559d8f03d73cd52973a022b860eece1c52f17772f9988
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
        ... 0x606911f71cd4985b547adeba3cc5097ab68ff2605bd520110730216e5defb724
        Migrations: 0x908ad2872339c6156afe3b38c9357c1ca89e67e8
      Saving successful migration to network...
        ... 0xc4645b0ef4b6badbe9639afb89f751fcb2b36d5e07a21cbbef87ca045472b49a
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xa04d7e2c0b3cea1c75d900a8f484387cc5e3056b3fcbec039258115fca1d6689
        WorkerPoolHub: 0x6875a88a10a21041e75265eb7be1b483bab4b638
      WorkerPoolHub deployed at address: 0x6875a88a10a21041e75265eb7be1b483bab4b638
        Deploying AppHub...
        ... 0xed64122a00d94b5845f93c55faa8fa8c9a2d30ba153f2c996571bfb43fb4f139
        AppHub: 0x54adc857dfa34bbc50ee7105dd0d9cb57798d535
      AppHub deployed at address: 0x54adc857dfa34bbc50ee7105dd0d9cb57798d535
        Deploying DatasetHub...
        ... 0xab09a56c148c9c32c3bceedf23083a3c90310ddeed2dc827186a47cf9de5c965
        DatasetHub: 0xd5eb98773f0b113f4691217e0a62bd520198eeb8
      DatasetHub deployed at address: 0xd5eb98773f0b113f4691217e0a62bd520198eeb8
        Deploying IexecHub...
        ... 0x64564fd91ccb0fc964ff27123c4976b8c115f5053836642d912caaf98f1ce062
        IexecHub: 0x94769bf5ee101205886c9518130e3acd71510661
      IexecHub deployed at address: 0x94769bf5ee101205886c9518130e3acd71510661
        ... 0x76d9637a17ae1cafa10687f014faaf9fa165a4cf977e797bad3dc8e4131d3a10
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0xa160b88352119b52642a34a6b3a268e55f7e22fcfc574c6532869dba6914265f
      transferOwnership of AppHub to IexecHub
        ... 0x7124eb4089310109aa4be5b110662957b78a604ed044377a193c6c85a3163f4b
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0xbca4b49df5c16c8ed2d4fccbbb57678e12a4e5b36f377244dbc6029ddf57d5e3
        Marketplace: 0x6d2ec2e6bc2f5d852ea1d7eca05802db00095556
      Marketplace deployed at address: 0x6d2ec2e6bc2f5d852ea1d7eca05802db00095556
        ... 0x81d3121ea6f96eadd07f624b812aac1c9df4e82dd998b04a4f146e68912654d6
      attach Contracts to IexecHub done
        ... 0x1446ccd23b4d2d1c35cf8ec9d6c271c11c7e49b891d1bda0d7c8c89635fecd10
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : Mega
      create category : MegaPlus
      create category : Giga
      create category : GigaPlus
      create category : GigaGrande
      create category : GigaMax
        ... 0x28e9fbeb82f5026e55fd4a54e1d4d9d8c19e1e1e18c3b0640f3b32dff7b2f04d
        ... 0xf297f8b55d944473381ff6992675673d99c2d688f6dc94da35cf3e2212cb8806
        ... 0xb1ca025351c1ed1aae083c1ef8652036a06bbfb42fb89d6bac5d3b0d9aa9d7d5
        ... 0x454988c38db44d8210caa2e9a2f72497ddc7f7004abf1fa635773cc4e796a423
        ... 0x68e3fa87f7fcf375068afabf826a6529f5d54e9924925d1260967711e7e23a76
        ... 0x74f8b03b7c1ad1c96d87682c74c065bde3c21dc5ae6b89cfdb367d766eff1281
      m_categoriesCount is now: 6
      Saving successful migration to network...
        ... 0x730e0bd197c738f0ceff216ed6a7cd480ec465aed6a38a797567e474d9eb77ac
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

      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xa6262fcc125be2711be50f163cb3f22b513048837ee39dd4ac4e8bff3eeb4287
        WorkerPoolHub: 0xbd5bfa55237415d2bc4f8ccb310939d3bdad6674
      WorkerPoolHub deployed at address: 0xbd5bfa55237415d2bc4f8ccb310939d3bdad6674
        Deploying AppHub...
        ... 0x5cc72edfb03a3eb7bc9f2680ce7ddff73493ab029e607e43f18dc14974168fa9
        AppHub: 0xa496debd0690a217fcd5726f902e6944ff2e3b69
      AppHub deployed at address: 0xa496debd0690a217fcd5726f902e6944ff2e3b69
        Deploying DatasetHub...
        ... 0xe1c0ff75681216cd0607ab69fd5c1fb36097de79ec0736ea05e4bf6ff5a47857
        DatasetHub: 0xf9a672e79e6aa6c95d3315085b069452e305a0e1
      DatasetHub deployed at address: 0xf9a672e79e6aa6c95d3315085b069452e305a0e1
        Deploying IexecHub...
        ... 0xcd3ac795cfd3f40bbf2a85dde6d038818c3ed0f4803d1a0d2f35657e2bd17001
        IexecHub: 0x45cbd2d0e9a913f17669f226727b1849ff7bfcb7
      IexecHub deployed at address: 0x45cbd2d0e9a913f17669f226727b1849ff7bfcb7
        ... 0x8595ee165fe7ed61ccc5e86c87d6f4c8c33b95c69a495dbeaf82775513158237
      transferOwnership of WorkerPoolHub to IexecHub
        ... 0x6de629d975f5cf1549fc57178854ca04e1a28f4e56f96ae5619b67d8354aa8b6
      transferOwnership of AppHub to IexecHub
        ... 0x0df16c893f7bb807323463163753b71ba9fbdc53e1469a3451e4aab71570c89d
      transferOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0x0973591b9634133172094a309011287803077d2c9ee9f0c59f41f4ba150f19a9
        Marketplace: 0x07e12c896a86c54ad0a068fca5f0d0cd9e02aba0
      Marketplace deployed at address: 0x07e12c896a86c54ad0a068fca5f0d0cd9e02aba0
        ... 0xa1ab3a88be5e82ef8faf22f4b3f82e4965ca558b8c906d047d5427b14fac76de
      attach Contracts to IexecHub done
        ... 0xc1b68af8ad5798ff5a9578a225a48efc77d592fd47509685143c316afadc58b0
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : Mega
        ... 0x28ae3c798fca42fa7257c00603fe83f2dca1e2137d28ffde793b4e2d6403d21d
      create category : MegaPlus
        ... 0x26e5c7c6c2e439acb8374da8152ddc0775424c02f052f15a8725346ce665bee4
      create category : Giga
        ... 0xbfc67c29b81ebbed899cf30d786cb66b5ef7c500b07e064edc4b282645ffe31c
      create category : GigaPlus
        ... 0x20b572c8eb1e66a90d7709101d932a5829cfd6903b3b4b329f017d2513a45494
      create category : GigaGrande
        ... 0xee8a3176bd39f693487924573d27b2a8e25d87327917fc72117ad7989f3bfc83
      create category : GigaMax
        ... 0x63f7dd20239298358bcc84176ea4fef357fccf0a9028f646e6e2d4eb4134f80a
      m_categoriesCount is now: 6
      Saving successful migration to network...
        ... 0x17a6a167be3f9e7f305ae6e1c0eef5d2ec03f94129d487f4ea6aeaf90e96ed8e
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
