# Backup and recovery

## Targets

- **RPO:** no more than 24 hours of accepted data loss.
- **RTO:** restore essential application data within 4 hours.

## Backup policy

- Use the Supabase plan's managed daily backups where available. If the selected plan does not provide a 24-hour recovery point, schedule a daily encrypted `pg_dump` through an owner-controlled secret store and retain 35 days.
- Backups are encrypted at rest, accessible only to the production owner, and exclude application secrets (which are managed separately by Vercel/Supabase/Upstash).
- Record successful backup time, size, checksum and storage location in the operations log.

## Quarterly restore drill

1. Provision an isolated Supabase project; never restore into production.
2. Restore the latest backup and run schema/RLS checks plus a representative import, quiz and shared-set smoke test.
3. Verify the recovered timestamp meets the RPO and measure elapsed time against the RTO.
4. Destroy the isolated drill environment and record results, failures and remediation.

## Emergency restore

Freeze production writes where feasible, notify users, restore the approved recovery point to a replacement project, rotate credentials, run the smoke matrix, then repoint production only after the owner approves.
