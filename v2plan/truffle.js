
module.exports = {
  networks: {
    docker: {
        host: "iexec-geth-local",
        port: 8545,
        network_id: "*", // Match any network id,
        gas: 4400000,
        gasPrice: 22000000000,
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id,
      gas: 4400000,
      gasPrice: 22000000000,
    },
  }
};
