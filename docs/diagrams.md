# Diagrams

## Actors diagram
[![Contracts and Actors Architecture](https://tinyurl.com/2l3942fk)](https://tinyurl.com/2l3942fk)<!--![Contracts and Actors Architecture](./uml/architecture-ODB.puml)-->

## Task statuses

Possible workflows:
- Nominal
- ContributeAndFinalize
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
## Contribution statuses

Possible workflows:
- Nominal
- ContributeAndFinalize
- Boost => **No contributions statuses in Boost flow**

```mermaid
flowchart TB
    UNSET --> |if active task and contribute| CONTRIBUTED
    CONTRIBUTED --> |if not part of the consensus| REJECTED
    CONTRIBUTED --> |if inside consensus| PROVED
    UNSET --> |if trust = 1 and contributeAndFinalize| PROVED
    linkStyle 3 stroke:orange
```

## Sequence diagrams of different workflows

### Nominal
[![Nominal workflow sequence](https://tinyurl.com/2nb5oau3)](https://tinyurl.com/2nb5oau3)<!--![Nominal workflow sequence](./uml/nominalworkflow-ODB.puml)-->

### Nominal+TEE
[![Nominal workflow sequence w/ TEE](https://tinyurl.com/2jwzqrgx)](https://tinyurl.com/2jwzqrgx)<!--![Nominal workflow sequence w/ TEE](./uml/nominalworkflow-ODB+TEE.puml)-->

### Boost
[![Boost workflow sequence](https://tinyurl.com/2oofk7yf)](https://tinyurl.com/2oofk7yf)<!--![Boost workflow sequence](./uml/boost-workflow-ODB.puml)-->

### Nominal vs Boost vs Nominal TEE: From Match to Finalize

Nominal:

[![Nominal](https://tinyurl.com/2o4xu745)](https://tinyurl.com/2o4xu745)<!--![Nominal](./uml/workflow-ODB-2a-match2finalize-nominal.puml)-->

Boost:

[![Boost](https://tinyurl.com/2mmsokrr)](https://tinyurl.com/2mmsokrr)<!--![Boost](./uml/workflow-ODB-2b-match2finalize-boost.puml)-->

Nominal TEE:

[![Nominal TEE](https://tinyurl.com/2zubyfvw)](https://tinyurl.com/2zubyfvw)<!--![Nominal TEE](./uml/workflow-ODB-2c-match2finalize-nominal-tee.puml)-->
