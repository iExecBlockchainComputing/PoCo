var Migrations = artifacts.require("./tools/Migrations.sol");

module.exports = function(deployer) {
  deployer.deploy(Migrations, {gas: 500000});
};

