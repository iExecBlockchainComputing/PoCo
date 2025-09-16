# Add DepositAndMatchOrders functions to proxy

## Local Development with Forked Network

### Start forked node
```bash
ARBITRUM_FORK=true npx hardhat node --no-deploy
```

### Deploy and integrate modules
```bash
export ARBITRUM_FORK=true
npx hardhat run scripts/depositAndMatchOrders/0_deploy-modules.ts --network external-hardhat
npx hardhat run scripts/depositAndMatchOrders/1_add-modules-to-proxy.ts --network external-hardhat
```

## Production Deployment

### 1. Deploy modules
Run the deployment script on the target network:
```bash
npx hardhat run scripts/depositAndMatchOrders/0_deploy-modules.ts --network <network-name>
```

### 2. Add modules to proxy
Run the integration script to add the new functions to the diamond proxy:
```bash
npx hardhat run scripts/depositAndMatchOrders/1_add-modules-to-proxy.ts --network <network-name>
```

**Note**: The script automatically detects the proxy owner and performs the diamond cut operation directly. No timelock scheduling is required.

## About

This folder contains scripts to deploy and integrate the DepositAndMatchOrders facets to the diamond proxy:

- **IexecPocoDepositAndMatchTokenFacet**: For token-based chains (using RLC tokens)
- **IexecPocoDepositAndMatchNativeFacet**: For native chains (using ETH)

The scripts automatically detect the chain type and deploy the appropriate facet.

### Functions added:
- `depositAndMatchOrders()`: Deposit and match orders in a single transaction (requester pays)
- `depositAndSponsorMatchOrders()`: Deposit and sponsor match orders for another requester (caller pays)

These functions significantly improve UX by eliminating the need for separate approve+deposit+match transactions.
