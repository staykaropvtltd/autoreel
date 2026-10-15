# Backend utilities

## Check the configured PostgreSQL connection

This is an intentional live integration check and is not part of pytest. From
the backend directory, run:

```powershell
python -m app.core.check_db_connection
```

It reads `DATABASE_URL` from `backend/.env` and executes `SELECT 1`. Run it only
when you intend to contact the configured database.

## Per-user private templates

Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`SUPABASE_TEMPLATE_BUCKET=templates` in `backend/.env`. Create the `templates`
Storage bucket in Supabase and keep it **private**. The service-role/secret key
is server-only and must never be copied into a frontend environment.

The SQLAlchemy `templates` table is additive. Apply it with the repository's
safe create-missing-tables mechanism from the backend directory:

```powershell
python -m app.core.init_db
```

Existing local files under `../storage/templates` have no reliable owner
metadata. Do not expose them to all users. To migrate only files with known
owners, prepare a JSON object mapping each template UUID to an existing integer
`users.id`, then run:

```powershell
python -m scripts.migrate_local_templates --owner-map path\to\owners.json
```

Unmapped files are skipped and reported. The script preserves UUIDs and local
source files and can be rerun; it never assigns an owner automatically.
