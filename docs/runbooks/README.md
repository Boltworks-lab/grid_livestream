# Runbooks

Operational procedures (PROJECT_BRIEF §11). Each is a checklist an on-call engineer
can follow under pressure. Keep them short and current.

| Runbook                                | When                                    |
| -------------------------------------- | --------------------------------------- |
| [deploy.md](deploy.md)                 | Shipping a release                      |
| [rollback.md](rollback.md)             | A release is bad                        |
| [incident.md](incident.md)             | Sev1/Sev2 — outage, data, or money bug  |
| [payout-freeze.md](payout-freeze.md)   | Suspected payout fraud / ledger anomaly |
| [dmca-takedown.md](dmca-takedown.md)   | Valid DMCA / illegal-content report     |
| [backup-restore.md](backup-restore.md) | Backups + the quarterly restore drill   |

**Escalation:** on-call → eng lead → founder. Money/ledger anomalies and CSAM reports
page immediately, any hour.
