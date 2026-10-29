# Setup for calendar, AI, billing, referrals and admin

## 1. Database
Run `supabase/migrations/0004_platform.sql` in the Supabase SQL Editor.

## 2. Make yourself an admin (optional)
Sign in once, then in Authentication > Users copy your User UID and run:
`insert into public.admin_users (user_id) values ('PASTE-YOUR-UID');`

## 3. Deploy three Edge Functions (Supabase dashboard > Edge Functions)
Create each with the exact name and paste the file contents:
| Name | File | Verify JWT |
| --- | --- | --- |
| assistant | supabase/functions/assistant/index.ts | ON |
| create-checkout | supabase/functions/create-checkout/index.ts | ON |
| payment-webhook | supabase/functions/payment-webhook/index.ts | **OFF** (the provider has no login token; the signature check protects it) |

## 4. Secrets (Edge Functions > Secrets). Never put these in Vercel or VITE_ variables.
| Name | Used by | Where it comes from |
| --- | --- | --- |
| AI_PROVIDER_API_KEY | assistant | Your Anthropic API key |
| AI_MODEL | assistant (optional) | Defaults to claude-sonnet-5-5 |
| AI_DAILY_LIMIT_FREE / AI_DAILY_LIMIT_PREMIUM | assistant (optional) | Daily request limits (default 10 / 50) |
| RAZORPAY_KEY_ID | create-checkout | Razorpay dashboard > API keys |
| PAYMENT_PROVIDER_SECRET | create-checkout | Razorpay key secret |
| RAZORPAY_PLAN_ID | create-checkout | Create a monthly plan of ₹20 in Razorpay > Subscriptions > Plans |
| PAYMENT_WEBHOOK_SECRET | payment-webhook | The secret you type when creating the webhook in Razorpay |

## 5. Razorpay webhook
Razorpay > Webhooks > add the URL `https://YOUR-PROJECT.supabase.co/functions/v1/payment-webhook`
with the same secret as PAYMENT_WEBHOOK_SECRET. Enable subscription events
(activated, charged, cancelled, halted, pending, completed). Use Razorpay TEST mode first.
Confirm that your Razorpay account supports the payment methods you need for recurring billing in India.

## 6. Known limits
- Assistant replies arrive whole (no streaming) and cannot be cancelled server-side.
- No refund tracking, billing history or in-app cancellation yet.
- Scheduled reminder jobs are not built.