# Capital Crew production deployment guide

## Recommended architecture

Browser / GitHub Pages
        |
        +--> Supabase Auth (users + sessions)
        |
        +--> Supabase Postgres (profiles, payments, wallet ledger)
        |
        +--> Supabase Edge Functions (trusted server logic)
        |
        +--> Payment providers
              - Payfast / Instant EFT / cards
              - 1Voucher / Flash API (merchant integration)
              - OTT provider API (after confirming the exact OTT service)
              - additional approved methods

## How the user's money appears

1. User logs in.
2. User selects an amount.
3. Browser creates a pending payment session through a server function.
4. User is sent to the payment provider.
5. Provider confirms payment to your server webhook.
6. Server verifies the webhook signature and checks the amount/reference.
7. Server marks the payment completed.
8. Server writes a ledger entry.
9. Server updates the user's wallet balance using a protected database transaction/RPC.
10. Dashboard reads the wallet/ledger from Supabase.

The browser must NEVER be allowed to simply say "add R1,000 to my balance".

## Hosting on GitHub

GitHub Pages is suitable for the front-end because it serves static HTML/CSS/JS. It is NOT your database, authentication server, webhook receiver or secure secret store.

Recommended:
- GitHub Pages: website
- Supabase: Auth + database + server functions
- Payment provider(s): actual payment processing

## Setup

1. Create a Supabase project.
2. Run `supabase/schema.sql`.
3. Configure Auth email/password and email verification.
4. Configure RLS policies so users can only read/update their own allowed profile data.
5. Deploy the Edge Function in `supabase/functions/payment-webhook`.
6. Add provider secrets in Supabase secrets, never GitHub/JS.
7. Configure payment provider webhook URLs to the Edge Function.
8. Put the public Supabase URL and ANON key in `public-config.js`.
9. Push the website to GitHub.
10. Enable GitHub Pages using GitHub Actions.
11. Test everything in provider sandbox/test mode.
12. Only then request/enable live payment credentials.

## Tracking every payment

The admin console should read:
- payment ID
- member ID
- provider
- method
- external reference
- amount
- status
- created/updated time
- webhook/event status
- ledger entry
- refund/chargeback state
- staff/admin actions

Use the `audit_log` table so admin actions are traceable.

## Payment methods

1Voucher: 1Voucher says business integrations use its Flash APIs and that merchant settlement/reporting is automated. Obtain a merchant agreement and integration documentation directly from 1Voucher before implementing it.

Instant EFT: Payfast documents Instant EFT as an instantly verified bank-to-bank option and lists supported banks; activate it on the appropriate merchant account.

Cards / other methods: use an authorised payment gateway and let the provider host sensitive payment collection.

OTT: confirm which OTT service you mean and obtain that provider's merchant/API documentation. The UI contains an OTT option, but the actual API cannot be safely invented without the exact provider.

## Production security checklist

- HTTPS
- MFA for admins
- Strong password policy + email verification
- Rate limiting
- Server-side authorisation
- RLS
- Webhook signature verification
- Idempotency
- Immutable/append-only financial ledger
- Daily reconciliation
- Backups
- Audit logs
- No payment secrets in GitHub
- No card data stored by Capital Crew
- KYC/AML and applicable regulatory controls
- Legal review of the investment/return model

### Withdrawal timing rule

The member-facing product should state the withdrawal rule consistently: a withdrawal becomes eligible after **10 full days of investment**, counted from the date the investment is confirmed. After an eligible withdrawal is approved and released for settlement, the target customer-facing timing is **1–3 working days**, depending on the selected payment method/provider. This should be enforced server-side using the confirmed investment timestamp, not by browser JavaScript. The final rule must be reviewed against the actual product structure, payment-provider terms and South African legal/regulatory requirements before launch.


## KYC and profile pictures

Before creating a deposit/payment session, the trusted server must load the authenticated user's profile and require `kyc_status = 'verified'`. Never rely on the browser's hidden buttons or localStorage as the security control.

Recommended production flow:
1. Member creates/authenticates an account.
2. Member uploads identity documentation to a private storage bucket through a controlled server endpoint.
3. Server creates a `kyc_documents` row with `pending` status.
4. Protected compliance/admin workflow reviews the document.
5. Server changes the member profile to `verified` or `rejected`, records reviewer/time/reason, and writes `audit_log`.
6. Only a verified member can create a payment/deposit session.
7. Payment provider confirmation still remains the only trusted source for crediting the member ledger.

Profile pictures should be uploaded to controlled storage and validated server-side. The prototype's local preview is not suitable for storing regulated identity documents.


## Login confirmation code

Each successful password sign-in should create a fresh, short-lived one-time confirmation challenge before the member session is activated. The production flow should be:

1. Authenticate the member with Supabase Auth.
2. Generate a cryptographically secure six-digit code on a trusted server/Edge Function.
3. Store only a hash of the code in `login_challenges`, with a short expiry (for example 10 minutes), an attempt limit, and a consumed timestamp.
4. Deliver the code to the member's verified email address or phone number through the configured provider.
5. Require the submitted code to match before creating/activating the application session.
6. Mark the challenge consumed and write the event to `audit_log`.

The packaged static member interface includes a local login-code screen so the flow can be exercised without a mail/SMS provider. **Do not use the browser-generated code as the security mechanism in production.**

The top-right member avatar is also an account shortcut: clicking it opens **Profile & KYC** directly with the profile editor expanded.

## Owner control area

The site now includes a protected Owner Control console. It is intentionally hidden from ordinary members and should only appear after the authenticated server session establishes an `owner` or `admin` role.

For the live system:
1. Create the owner's Supabase Auth account.
2. After the account is created, set `profiles.role = 'owner'` for that user's UUID using the Supabase SQL editor or a protected onboarding process.
3. Enable MFA for the owner account.
4. Review the RLS policies and protected RPC functions in `schema.sql`.
5. Use the Owner Control console to monitor members, KYC submissions, payment status, withdrawal eligibility and audit events.
6. A payout approval does **not** itself transfer money. The trusted payout Edge Function/provider must execute the actual transfer, and only then should the owner record the provider's payout reference.

Never expose the Supabase service-role key in the website and never give normal members access to owner functions.


## Bank transfer details
For the Capital Crew member interface, the configured manual bank-transfer destination is **TymeBank**, account name **Capital Crew Inc**, account number **51042322891**, currency **ZAR**. Manual transfers must remain pending until the authorised payment/reconciliation workflow verifies the transfer. Do not treat a browser-side confirmation as proof of settlement.
