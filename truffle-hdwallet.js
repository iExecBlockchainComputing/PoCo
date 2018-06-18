
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
        ... 0x5697151589061e21d3dced8191c942092f0365a17ccdc3014104f0888b0b5648
        Migrations: 0x922c8fb7b70ff0e42919f623a53887ef31cf4e91
      Saving successful migration to network...
        ... 0x47efd00e07bb74aa3eab46800c0ea8cb60b30b945abd44e3b0f5f2e63fe6a5cd
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xbcb71fdaeffca3c751bd7348662f5c3ee6e5389e7df6b645b695e4a3bd2190a5
        WorkerPoolHub: 0x01bfbda0f357bf06eb2f802e3a82bba55b05fe61
      WorkerPoolHub deployed at address: 0x01bfbda0f357bf06eb2f802e3a82bba55b05fe61
        Deploying AppHub...
        ... 0x788d168f1a7f0ec25a5d941431848fa56374485fc46ff3dad27e8147af933016
        AppHub: 0xc61868aa0b3faefeb4ff741cfbf0911657707d09
      AppHub deployed at address: 0xc61868aa0b3faefeb4ff741cfbf0911657707d09
        Deploying DatasetHub...
        ... 0xc27db0fa2a75105be1ea4a7b96ca7be52eaadc64f672dd8445f474873c27619b
        DatasetHub: 0xfe6a941ddfbfc6924ea64dc2e576de3b5be3e3a5
      DatasetHub deployed at address: 0xfe6a941ddfbfc6924ea64dc2e576de3b5be3e3a5
        Deploying IexecHub...
        ... 0xe8daef1530474edbf097305edfca2a3707146c1fa4e53fd75004f3e438e76e33
        IexecHub: 0x63d3215027dfaeab233d8feeddc660724c6b921b
      IexecHub deployed at address: 0x63d3215027dfaeab233d8feeddc660724c6b921b
        ... 0xcb8e074c105c2dfde7bf285006b18124b1a55d13c1cb01b66fed51aa781c2222
      setImmutableOwnership of WorkerPoolHub to IexecHub
        ... 0x99933445984869d3659351552d22602506b63fd7192db4acdcb5622912e6c7a0
      setImmutableOwnership of AppHub to IexecHub
        ... 0x743237d0baf5035258b2560e7780f7f7ecd662c11c190fe8defa5fe7ff9dfe37
      setImmutableOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0xde895aefba06d9434bf2cbf98596555819dae2a66c469d740139aa9afa71e08f
        Marketplace: 0xc65b1643b8a6a2ba8fe70310be82689f8563917e
      Marketplace deployed at address: 0xc65b1643b8a6a2ba8fe70310be82689f8563917e
        ... 0xfa9aa2ec3330c473e7ceb803f799ea18a4f58cf7928d9aca7e077248d4f58505
      attach Contracts to IexecHub done
        ... 0xbf75ac804951c9f00063235b19d5c8c5dcc9746c9f10f45c6749b9ccad070346
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : 1
        ... 0x5dc71ebb92b2cdd313070ca58d5130c94dbe176167cf2610a0143637888dc9cf
      create category : 2
        ... 0x87b3d8d58b804ddd58e41428fd08bf4e416c703bcced86abab9bdbdd294b17ed
      create category : 3
        ... 0x2181891553996cd893e999f2d64c1dfef9de51a905b74575118fd9e08ca2edc6
      create category : 4
        ... 0x1441f1ae4e0326d9a49150756667c5f2cd82a75b11166740c9594a7f32f65f90
      create category : 5
        ... 0xacfc26def6be2743b7fd24caba756181289563ac5eec1a38f4fea04f17185b37
      m_categoriesCount is now: 5
      Saving successful migration to network...
        ... 0x1621e13d6d61ff88a318f1f2587a6456b64311a45b78d0da4413ae2578bb53dc
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
      Running migration: 1_initial_migration.js                                                                                                                                                    [65/1824]
        Deploying Migrations...
        ... 0x99d7823ba70acc52b559b5b640a33fb49f1145e99c065c3a32dab39bb501a118
        Migrations: 0x4d4f1096e353b288b7f815a3c0bb878b3e0fa930
      Saving successful migration to network...
        ... 0xc729532fb1eaa991bcd85900c22311148406f495f75921e4256241016522fac7
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xcc0424367839e17c43c85a7cb3aa574d19e00706856e70b0a4e4d0c02dc8c6a7
        WorkerPoolHub: 0x6d7d0371923f655a35169c1a0cb1675ac0129c12
      WorkerPoolHub deployed at address: 0x6d7d0371923f655a35169c1a0cb1675ac0129c12
        Deploying AppHub...
        ... 0xeae9779434ff91703753957267437557c6d2e277011e4defb2a78e9f4f425eef
        AppHub: 0x61896fb3107d31f18d18b931e95aad89d93b8b67
      AppHub deployed at address: 0x61896fb3107d31f18d18b931e95aad89d93b8b67
        Deploying DatasetHub...
        ... 0x21d2603c066bfb6ad6de46f4f3256465afb4fd7b302a278204f67660b8246650
        DatasetHub: 0x82f858f32c8ee88772e296650667a838e5d1b961
      DatasetHub deployed at address: 0x82f858f32c8ee88772e296650667a838e5d1b961
        Deploying IexecHub...
        ... 0x9dcaa4ee834a66bb877998c176364dc03496aaced0f751df4edc459c680d98a1
        IexecHub: 0x32aedc290604f7a674781b232143b837a358d711
      IexecHub deployed at address: 0x32aedc290604f7a674781b232143b837a358d711
        ... 0x2c26785813c190041974745fca710e65661124ce761b3a4594716b8f8f1e7382
      setImmutableOwnership of WorkerPoolHub to IexecHub
        ... 0xc723707759dacf42cc335bab74413343f5707317a19a0dee00ac72f9aa32d92e
      setImmutableOwnership of AppHub to IexecHub
        ... 0x517182ea321de25a5ecbc7f7abd3f63e8245fb21943bf3e3fa11cf9c1b5afe87
      setImmutableOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0xa86b5228523abde4c9c7e7c94efb8e7bf3f5be7e54235ba59e028dc2f4c76206
        Marketplace: 0x2a6a5a0516add25dda891e4afdfc15cbcdf21643
      Marketplace deployed at address: 0x2a6a5a0516add25dda891e4afdfc15cbcdf21643
        ... 0xc3880fb31fefd3a02fb7fdcfeb95785d1ea2c95eb8d24b3890c1cc097927152b
      attach Contracts to IexecHub done
        ... 0x3ab364ce8b2f916c3a88e81d30e7f2e620b0d1a34ebb8378c44c6edb180aa54d
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : 1
        ... 0x2e928f5aa781b39b336765d0356385fe1c65e5a180c004379d6b390edaca84e8
      create category : 2
        ... 0x82714b55c35dde776b688dd30ee6266fb929fe7092693e42ef4118b8be158b2d
      create category : 3
        ... 0xc0c744830400662719ca6fd387c7947dfbf60f9d5666dec6cd0422001aa57170
      create category : 4
        ... 0xa04a41789cbc2145c5d4f6aec906d969f9f8594c9f108103dfe007d8a4b4980d
      create category : 5
        ... 0x0cace8766bf1955de8bc9925c12886d502f53974985c7d1d07a4e28e62b1b156
      m_categoriesCount is now: 5
      Saving successful migration to network...
        ... 0xdb235aba8443702ebb18eb9a086a0966e475278495ef44d27e35489ed642e2ae
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
        ... 0x9a0a926bde88a7e07eee256f0b6ca5ff4bf47b090bf1893c6baabc662b2977c0
        Migrations: 0x9a1eb11bcbc6cf50fda67519568bec2da3f8cad0
      Saving successful migration to network...
        ... 0x0e1f3e5ac6bae9966fcfcd4078b8170f1c939718d4bf6d9b987a1be1fa69f7b8
      Saving artifacts...
      Running migration: 2_deploy_contracts.js
        Deploying WorkerPoolHub...
        ... 0xf2468a671436eff3c5b9988d4f89c4bac98e7ed9537f822951684f480d77e014
        WorkerPoolHub: 0x6fbb19d1e0c43a46bdf6b5087207b1ea1744dfb3
      WorkerPoolHub deployed at address: 0x6fbb19d1e0c43a46bdf6b5087207b1ea1744dfb3
        Deploying AppHub...
        ... 0x8715c22e75f25c47236d6b109c4ef50be3c9d1c81f78803a529ec0b6dca15bb0
        AppHub: 0x90c7154bc5e77a0ff535bd9ac1ecd9cc14718f08
      AppHub deployed at address: 0x90c7154bc5e77a0ff535bd9ac1ecd9cc14718f08
        Deploying DatasetHub...
        ... 0xa8bf388244ce05017d4370878c8b1bcece8019f8c527668db213e473edad0cf9
        DatasetHub: 0xdee768d9a781658503445cbe79e463bcf90538d5
      DatasetHub deployed at address: 0xdee768d9a781658503445cbe79e463bcf90538d5
        Deploying IexecHub...
        ... 0xa1dbdbf6f34fe166b0e9d5eb68d3995b435717866dd50829a852cde33218c0f4
        IexecHub: 0x12b92a17b1ca4bb10b861386446b8b2716e58c9b
      IexecHub deployed at address: 0x12b92a17b1ca4bb10b861386446b8b2716e58c9b
        ... 0x0b5fb4d833b2f2c3b789b43fdd70b01b91f280e543d7a2af79edcb291dc75457
      setImmutableOwnership of WorkerPoolHub to IexecHub
        ... 0x80fa17abc33e861ce4d1dd94db8f00fc70b58fe255a3011e08d21cd2395fba2a
      setImmutableOwnership of AppHub to IexecHub
        ... 0xf5d11cbac2aa8aac0cb7e28f3c787fe078de97d2ef59a33040dbd4ef80ee4b72
      setImmutableOwnership of DatasetHub to IexecHub
        Deploying Marketplace...
        ... 0x5ce96b9a7361cb6f557b9ff631cea6df2f6b4d11012682b27a7e814fac20feb9
        Marketplace: 0x9315a6ae9a9842bcb5ad8f5d43a4271d297088e2
      Marketplace deployed at address: 0x9315a6ae9a9842bcb5ad8f5d43a4271d297088e2
        ... 0x1da146b4c9300eab0494f115bcaf3cf925e324786696480f7a69a2edb6d720bf
      attach Contracts to IexecHub done
        ... 0x11868d7b248d3b5713a3064270d5d123713ab9664fb913a8cb1c322114de7080
      setCategoriesCreator to 0xcd7CcF952E0482ca41b46c6BBAd3A1852faD69dC
      create category : 1
        ... 0x99ed04cedf159dd68d7491feeeebdd7ddf00c9fd88d7b751b94349eb4ba4e589
      create category : 2
        ... 0xa71bc127550662d8a0eca52eae4bc65fd12bfba769e0540003d43cc1746e4aa3
      create category : 3
        ... 0x13743c9620a2c0e03f449b9b147139ea9dd585a1773a8707dc88f9bdec7d043c
      create category : 4
        ... 0xb4ad06f77964045442cf70307e506e95706e176d93e5db3fa11b95c47d42d07c
      create category : 5
        ... 0xbab877691bf4180d64d1bc04540b12c00cb0787ce6ad5fa2a9a246f676b3326b
      m_categoriesCount is now: 5
      Saving successful migration to network...
        ... 0xe3e58afdf8c4e45d5ab8c77715b2f84b37e4d169f901937707f93cb6c96cc4ab
      Saving artifacts...
      */


    },/*
    mainnet: {
        provider: new HDWalletProvider(mnemonic, "https://mainnet.infura.io/berv5GTB5cSdOJPPnqOq"),
        network_id: "1",
        gas: 4400000,
        gasPrice: 22000000000,
    },
    Using network 'mainnet'.

    Running migration: 1_initial_migration.js
      Deploying Migrations...
      ... 0xa961d67e562c2252d195c1f2d99e37a68768f173fccbe65e36217acd04d1a8f8
      Migrations: 0x016dffb35cf40f8723417e5aa2c0bd7adb8a9a62
    Saving successful migration to network...
      ... 0x0655be0e98854e2029fcbdbb2af6b40f20a1511537216f142a65d64c0463893a
    Saving artifacts...
    Running migration: 2_deploy_contracts.js
    sleeping...
      Deploying WorkerPoolHub...
      ... 0xd7c68a10d9c0666b2b10130808138c7fa113287b3b302c6af656753838bae29f
      WorkerPoolHub: 0x897dc0cca9bb43f7601e477e721ef4dea4453f07
    WorkerPoolHub deployed at address: 0x897dc0cca9bb43f7601e477e721ef4dea4453f07
    sleeping...
      Deploying AppHub...
      ... 0xfea5e3122cea6830157eb8c4b28319e62d65a64c53c4546160d31aadfb5d6ff6
      AppHub: 0xb4f226150bdc6cf901c15e4ed1caeda7ea5c512c
    AppHub deployed at address: 0xb4f226150bdc6cf901c15e4ed1caeda7ea5c512c
    sleeping...
      Deploying DatasetHub...
      ... 0x32e88b373ae05c173eb3d743879f98acbbccde8192a7056ce4a44e7a03cc2896
      DatasetHub: 0xd0bb45fd58e357c9b3a5e7a36a5c6b6b5d1cf9b2
    DatasetHub deployed at address: 0xd0bb45fd58e357c9b3a5e7a36a5c6b6b5d1cf9b2
    sleeping...
      Deploying IexecHub...
      ... 0x931349936f3b358dc84c873e30d76258cf67ac64c953d11335211234b5ceee43
      IexecHub: 0x0d5ef019ca4c5cc413ee892ced89d7107c5f424d
    IexecHub deployed at address: 0x0d5ef019ca4c5cc413ee892ced89d7107c5f424d
    sleeping...
      ... 0xd4e5b2df39b43534823c9ab01f651dc8ffdd91bce4918405954972d8a64ba86e
    setImmutableOwnership of WorkerPoolHub to IexecHub
    sleeping...
      ... 0xe895f549a93b68c9d8ff978b3312b67212d87470a68968b7c80563fdaa656508
    setImmutableOwnership of AppHub to IexecHub
    sleeping...
      ... 0x60b03139251d363495ba2601eda1f2d1ec71ed2f86b5db57ea925159ec4ededb
    setImmutableOwnership of DatasetHub to IexecHub
    sleeping...
      Deploying Marketplace...
      ... 0xc0c911f0899002e7216f2c99730813e30c4764988b3cb8fcbab0e625afec5f56
      Marketplace: 0xfb7703c74f14930f8871c34056d5db6693e5a00b
    Marketplace deployed at address: 0xfb7703c74f14930f8871c34056d5db6693e5a00b
    sleeping...
      ... 0xb16e055845689dd5163487bc6cc0fa3763887c1351bc6fc19914ceb6e5a02a1d
    attach Contracts to IexecHub done
    sleeping...
      ... 0xd14a326d01fabda89e64630f6da88ddb9048f1915ac31da905e64792bff18919
    setCategoriesCreator to 0xfDd76d2aFe65a4aB85943b6E0e1c22eDf4e8B548
    create category : 1
    sleeping...
      ... 0xc384a4ec42139498873d7a241aa4f96d97a77d477bc5438f9d9216c8580a7cf9
    create category : 2
    sleeping...
      ... 0xef1f2cec252e6857a4606e2b1d6c28cf2f5d77bd54c1810664bda3f04d22933b
    create category : 3
    sleeping...
      ... 0xad749e6a5ca9e80e01c90b5effbfd1b2f745e8e820ff68c43b0347b03dbc9395
    create category : 4
    sleeping...
      ... 0x3bf7642f5d44ba762d3090d93d0d5ca62a9a41e3c87d399011b4a04dd499e4e6
    create category : 5
    sleeping...
      ... 0x3f644cf27044f8ac76b1d3bbe469a5db98161bbffacdf58d36858c247137f424
    m_categoriesCount is now: 5
    Saving successful migration to network...
      ... 0xa233c95039e3638a3a9933b4ec87c2e16cc3e4c5cb98a6155571180ec4a7d67b
    Saving artifacts...





    */
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
