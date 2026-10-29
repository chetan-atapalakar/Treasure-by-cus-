# Deploy the delete-account function

Status: required for the "Delete account" button in Settings.

## Using the Supabase dashboard (no terminal needed)
1. Open your Supabase project > Edge Functions > Create a new function.
2. Name it exactly: `delete-account`
3. Paste the full contents of `supabase/functions/delete-account/index.ts` and deploy.
4. Leave "Verify JWT" ON. The function also checks the caller's token itself.

Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`
to Edge Functions automatically. You do NOT add the service-role key anywhere in Vercel
or in the app.

## Verify
Create a throwaway test account, add a transaction, delete the account from Settings,
then confirm in Authentication > Users and in the Table Editor that the user and all
their rows are gone.

## Not yet covered
- No audit log of deletions (the audit_logs table is planned for a later batch).
- Backups taken by Supabase may retain data for their retention period. Describe this
  in your privacy policy.