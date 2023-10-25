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
