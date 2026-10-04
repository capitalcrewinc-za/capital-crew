# Capital Crew — Member Platform

This package expands the original Capital Crew concept into a complete responsive front-end:
- Member dashboard
- Contribution/investment plans
- Checkout flow
- Transaction history + CSV export
- Referral centre
- Profile/KYC workflow with verification-before-deposit gate and profile-picture upload
- Help centre
- Admin console
- Responsive mobile sidebar
- Green/white 3D/premium visual language
- Capital Crew logo extracted from the supplied reference

## Running it
Open `index.html` in a modern browser.

## Important production work
This is a front-end prototype, not a live financial system. Before accepting money:
1. Connect a licensed/authorised payment gateway through a server-side integration.
2. Never put secret payment credentials in browser JavaScript.
3. Add authentication, MFA, server-side authorisation and audit logs.
4. Add KYC/AML, transaction monitoring, reconciliation and secure data storage as required.
5. Obtain legal/regulatory advice for the actual investment/community-finance model and jurisdiction.
6. Replace all current figures, legal text and placeholder policies with verified company information.
7. Implement real withdrawal/redemption rules only after the underlying product and legal structure are defined.
8. Add a proper admin RBAC system and protect exports and member data.

The South African Reserve Bank states that the national payment system is regulated/overseen under the NPS framework, and that payment participants/providers can have authorisation/registration requirements. See the official SARB Payments & Settlements pages when implementing the real payment layer.


## New features
- Member login and account creation screens
- Session persistence in the browser for the local package
- Four-column Money List on desktop
- Contribution levels from R60 through R10,000
- Daily-share examples, including R60 → R10/day
- One-click selection from the Money List into checkout

The Money List is explicitly marked as illustrative. The daily amounts must be replaced with the real, legally approved product terms before the platform is used for real financial activity.


## Verification-before-deposit

The member interface now blocks the contribution/payment session until the account is marked `verified`. The browser implementation is only a prototype convenience; a production deployment must enforce the same rule server-side using `profiles.kyc_status = 'verified'` before creating a payment session.

KYC submissions should be stored in a private Supabase Storage bucket with a `kyc_documents` database record. Do not store identity documents in `localStorage`, browser-readable public storage, or GitHub. Staff approval should be performed through a protected admin/RBAC workflow and every decision should be written to `audit_log`.

## Profile pictures

The prototype supports JPG, PNG and WebP profile pictures up to 2 MB and displays them in the member profile and top navigation. For production, upload the image to a private/controlled Supabase Storage bucket and store only the resulting storage path/URL in `profiles.profile_picture_url`.


## Connected admin workspace
The package includes a separate `admin.html` workspace. After Supabase is configured and a user is assigned a row in `staff_roles`, authorised staff can monitor members, KYC, payments, withdrawals and audit events using the same database as the member portal. The admin UI is role-checked and financial balance changes remain server-controlled.
