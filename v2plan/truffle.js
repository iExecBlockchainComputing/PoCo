
module.exports = {
  networks: {
    docker: {
        host: "iexec-geth-local",
        port: 8545,
        network_id: "*", // Match any network id,
        gas: 44000000,
        gasPrice: 22000000000,
    },
    development: {
      host: "localhost",
      port: 8545,
      network_id: "*", // Match any network id,
      gas: 5900000,
      gasPrice: 22000000000,
    },
  }
};
