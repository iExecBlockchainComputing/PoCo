## Task statuses 

Flows:
- Nominal
- "Contribute and finalize"
- Boost

```mermaid
flowchart TB
    UNSET --> |if deadline and claim| FAILED
    UNSET --> |if matchOrder and initialize| ACTIVE
    ACTIVE["ACTIVE <br> (waiting for contributions)"] --> |if weigh of contributions > requested trust| REVEALING
    ACTIVE --> |if deadline and claim| FAILED
    REVEALING["REVEALING <br> (waiting for reveals)"] --> |if deadline and claim| FAILED
    REVEALING --> |if deadline and claim| FAILED
    REVEALING --> |if no reveal and reopen| ACTIVE
    REVEALING --> |if enough reveal and after finalize| COMPLETED
    ACTIVE --> |if trust = 1 and contributeAndFinalize| COMPLETED
    linkStyle 8 stroke:orange
    UNSET --> |if trust = 1, boost_matchOrder <br>and boost_pushResult| COMPLETED
    linkStyle 9 stroke:green
```
## Contributions statuses

- Nominal and "contribute and finalize" flows

```mermaid
flowchart TB
    UNSET --> |if active task and contribute| CONTRIBUTED
    CONTRIBUTED --> |if not part of the consensus| REJECTED
    CONTRIBUTED --> |if inside consensus| PROVED
    UNSET --> |if trust = 1 and contributeAndFinalize| PROVED
    linkStyle 3 stroke:orange
```

- Boost flow

No contributions statuses in Boost flow.

## Order flows

```mermaid
flowchart LR
    subgraph Legend
        ONCHAIN:::onchain
        OFFCHAIN:::offchain
    end

    UNSIGNED_ORDER["Unsigned order"]:::offchain
    SIGNED_ORDER["Signed order"]:::offchain
    MARKETPLACE_ORDER["Signed order available \n in offchain marketplace"]:::offchain
    BROADCASTED_ORDER["Signed order available \n in blockchain events \n through eth node RPC"]:::offchain
    SIGNED_SIGNORDEROPERATION["Signed signOrderOperation"]:::offchain
    PRESIGNED_ORDER["Presigned order"]:::onchain
    SIGNED_CLOSEORDEROPERATION["Signed closeOrderOperation"]:::offchain
    CONSUMED_ORDER["Fully \n consumed order"]:::onchain
    PARTIALLY_CONSUMED_ORDER["Partially (or fully) \n consumed order"]:::onchain

    UNSIGNED_ORDER --> |"owner signs order \n with private key"| SIGNED_ORDER
    SIGNED_ORDER --> |"owner publishes \n signed order offchain"| MARKETPLACE_ORDER
    SIGNED_ORDER --> |"owner broadcasts \n signed order onchain"| BROADCASTED_ORDER
    UNSIGNED_ORDER --> |"owner calls \n manageOrder(unsignedOrder,SIGN) \n to presign order onchain"| PRESIGNED_ORDER
    UNSIGNED_ORDER --> |"owner signs \n signOrderOperation \n with private key"| SIGNED_SIGNORDEROPERATION
    SIGNED_SIGNORDEROPERATION --> |"someone calls \n manageOrder(signedSignOrderOperation,SIGN) \n to presign order onchain"| PRESIGNED_ORDER
    PRESIGNED_ORDER --> |"someone calls \n matchOrders(unsignedOrder)"| PARTIALLY_CONSUMED_ORDER
    UNSIGNED_ORDER --> |"owner call \n manageOrder(unsignedOrder,CLOSE) \n to cancel order onchain"| CONSUMED_ORDER
    UNSIGNED_ORDER --> |"owner signs \n closeOrderOperation \n with private key"| SIGNED_CLOSEORDEROPERATION
    SIGNED_CLOSEORDEROPERATION --> |"someone calls \n manageOrder(signedCloseOrderOperation,CLOSE) \n to cancel order onchain"| CONSUMED_ORDER
    SIGNED_ORDER --> |"someone calls \n matchOrders(signedOrder)"| PARTIALLY_CONSUMED_ORDER
    MARKETPLACE_ORDER --> |"someone calls \n matchOrders(signedOrder)"| PARTIALLY_CONSUMED_ORDER
    BROADCASTED_ORDER --> |"someone calls \n matchOrders(signedOrder)"| PARTIALLY_CONSUMED_ORDER

    classDef offchain fill:brown
    classDef onchain fill:CornflowerBlue
```
