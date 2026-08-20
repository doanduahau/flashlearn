# Backup and recovery

## Targets

- **RPO:** no more than 24 hours of accepted data loss.
- **RTO:** restore essential application data within 4 hours.

## Backup policy

- Use the Supabase plan's managed daily backups where available. If the selected plan does not provide a 24-hour recovery point, schedule a daily encrypted `pg_dump` through an owner-controlled secret store and retain 35 days.
- Backups are encrypted at rest, accessible only to the production owner, and exclude application secrets (which are managed separately by Vercel/Supabase/Upstash).
- Record successful backup time, size, checksum and storage location in the operations log.

## Local read-only backup (Free Plan)

Free plan does not include a managed daily backup, so the repo provides a read-only
Supabase CLI dump script. It never writes to production and never stores secrets.

### Requirements

- Supabase CLI available via `npm install` (devDependency).
- The production project must be linked locally: `npx supabase link --project-ref rtrllrlilupoesikeypt`.
- No database password or access token is required at runtime: the CLI uses the
  locally stored linked-project credential. The script refuses to run if the linked
  project is not the CapyStudy production project.

### Run

```bash
npm run backup:production
```

The script dumps three separate files into `backups/production/<UTC-timestamp>/`:

| File           | Contents         | CLI invocation                          |
| -------------- | ---------------- | --------------------------------------- |
| `roles-*.sql`  | Cluster roles    | `supabase db dump --linked --role-only` |
| `schema-*.sql` | Schema (no data) | `supabase db dump --linked`             |
| `data-*.sql`   | Data only        | `supabase db dump --linked --data-only` |

Each dump is validated after creation (non-empty, expected SQL markers) and a
`manifest.json` records timestamp, project ref, file size and SHA-256 per file.

- Output is gitignored (`/backups/`). Never commit dumps, user data or secrets.
- Backups older than 35 days are pruned automatically. Override with
  `BACKUP_RETENTION_DAYS` (e.g. `BACKUP_RETENTION_DAYS=7 npm run backup:production`).

### Daily schedule for RPO <= 24h

Run the backup once per day so the recovery point is never older than 24 hours.
On Windows, schedule it with Task Scheduler (run `npm run backup:production`
from the repo root); on Linux/macOS use cron. The scheduled user must be the same
account that linked the project (the CLI credential is per-user).

Verify after each run that `manifest.json` exists, is non-empty and its SHA-256
matches the dumped files.

## Restore (isolated project only)

Never restore into production. Provision a fresh, isolated Supabase project and
restore there for verification or emergency recovery.

1. Provision an isolated Supabase project.
2. Link the CLI to it: `npx supabase link --project-ref <isolated-ref>`.
3. Apply the schema, then the data dump:

   ```bash
   psql "$DATABASE_URL" -f backups/production/<timestamp>/schema-*.sql
   psql "$DATABASE_URL" -f backups/production/<timestamp>/data-*.sql
   ```

   The data dump begins with `SET session_replication_role = replica;` so
   triggers are disabled while rows load, matching the snapshot exactly.

4. Roles are configuration-level; apply them only if the isolated project needs
   the same role settings:

   ```bash
   psql "$DATABASE_URL" -f backups/production/<timestamp>/roles-*.sql
   ```

5. Run schema/RLS checks plus a representative import, quiz and shared-set smoke test.
6. Rotate credentials before any project is used beyond the drill.
7. Destroy the isolated drill environment and record results, failures and remediation.

## Quarterly restore drill

1. Provision an isolated Supabase project; never restore into production.
2. Restore the latest backup and run schema/RLS checks plus a representative import, quiz and shared-set smoke test.
3. Verify the recovered timestamp meets the RPO and measure elapsed time against the RTO.
4. Destroy the isolated drill environment and record results, failures and remediation.

## Emergency restore

Freeze production writes where feasible, notify users, restore the approved recovery point to a replacement project, rotate credentials, run the smoke matrix, then repoint production only after the owner approves.
