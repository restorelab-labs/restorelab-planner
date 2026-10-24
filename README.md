# RestoreLab dependency planner

Build a recovery readiness runbook from an explicit inventory. Entries are topologically ordered; cycles, unknown dependencies and duplicate identities are rejected. A blocked prerequisite propagates to its dependants.

## Decisions

Live entries covering the horizon: OBSERVE. Entries expiring inside it: EXTEND_TTL (simulate first). Persistent/instance/code entries reported archived or whose recorded TTL has elapsed: SIMULATE_RESTORE, a candidate for fresh invocation simulation. Expired temporary entries: RECREATE. Missing entries: INVESTIGATE, never inferred archived. Stale observations: REFRESH, blocking the whole assessment.

Ledger horizons are ledger counts, not time estimates. The current ledger is inclusive: an entry live through the current ledger has zero remaining ledgers and is considered live. Imported archive references are claims, not authenticated proof. This engine neither builds nor signs transactions.

Run `node --test test.mjs`. Exported `plan(input)` and `demo` need no packages. Input schema: version 1, testnet/synthetic, currentLedger, observedLedger, horizonLedgers, maxAgeLedgers and 1–100 entries. Each entry has id, label, kind, state and dependsOn. Live entries need liveUntilLedger; archived entries need evidenceRef and cannot be temporary. Optional keyXdr values must be unique.

## Reference

[Stellar state archival](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival) · [RPC live entry lookup](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods/getLedgerEntries)
