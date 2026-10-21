# AGENTS.md

Solidity implementation of iExec's Proof of Contribution (PoCo) protocol: Hardhat 2 + TypeScript, deployed behind an ERC-2535 Diamond proxy, shipped as the `@iexec/poco` npm package. Live on Arbitrum One (42161) and Arbitrum Sepolia (421614).

## Read when relevant

| When you are…                                                                              | Read                              |
| ------------------------------------------------------------------------------------------ | --------------------------------- |
| creating or editing any file, committing, or opening a PR                                  | `.agents/context/conventions.md`  |
| changing contracts, storage, facets, deployment, chain config, orders or registries        | `.agents/context/architecture.md` |
| running a command beyond `package.json#scripts`, or reasoning about CI and generated files | `.agents/context/commands.md`     |
| writing or debugging tests, or using the test helpers                                      | `.agents/context/testing.md`      |
| scripting or executing a facet upgrade                                                     | `.agents/context/upgrades.md`     |
