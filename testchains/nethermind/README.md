This folder contains a ready to use docker-compose file that starts:
* `poco-chain` service. Accessible on http://localhost:8545/
* `netstats` dashboard to monitor the network status. Accessible on http://localhost:8080.
* `grafana` to display gas usage and other metrics of the chain. Accessible on http://localhost:8081.
* `prometheus` and `pushgateway` used to collect metrics from `poco-chain`.

Note: uncomment Docker volumes in compose file to persist data.
