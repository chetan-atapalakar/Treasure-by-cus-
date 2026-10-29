# Connect CüS Treasure to Supabase (phone OTP)

Status: required for real sign-in. Nothing here is configured automatically.

## 1. Create the project
1. Sign in at supabase.com and create a new project. Save the database password somewhere safe.
2. Open Project Settings > API. Copy the Project URL and the `anon` public key.
   Never copy the `service_role` key into this app.

## 2. Create the database
1. Open SQL Editor > New query.
2. Paste the full contents of `supabase/migrations/0001_init.sql` and click Run.
3. Open Table Editor and confirm these tables exist and show "RLS enabled":
   profiles, financial_accounts, categories, transactions, budgets,
   financial_goals, goal_contributions, notifications.

## 3. Turn on phone sign-in
1. Authentication > Providers > Phone: enable it.
2. Choose an SMS provider (for example Twilio, MessageBird or Vonage) and paste its credentials.
3. India: SMS delivery to Indian numbers typically requires the sender and message
   template to be registered under TRAI's DLT rules. Ask your SMS provider what they
   need before expecting real SMS to arrive. SMS also costs money per message.
4. Set OTP expiry and length (6 digits) under the phone provider settings.
5. Authentication > Rate Limits: keep the SMS limits conservative to prevent abuse.

### Test mode (clearly NOT real SMS)
Supabase lets you list test phone numbers with fixed codes in the phone provider
settings. Use them only while developing, and remove them before launch.

## 4. Allow your site URL
Authentication > URL Configuration: set Site URL to your Vercel address.

## 5. Add environment variables in Vercel
Project > Settings > Environment Variables:

| Name | Value |
| --- | --- |
| VITE_SUPABASE_URL | your Project URL |
| VITE_SUPABASE_ANON_KEY | your anon public key |
| VITE_DEMO_PREVIEW | `true` only while previewing with sample data; remove for real users |

Then redeploy. The anon key is public by design; Row Level Security is what protects
each user's data.

## 6. Verify isolation (do this before real users)
Create two test users, add a row for user A, then confirm user B cannot read it.