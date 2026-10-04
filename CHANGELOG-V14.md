# Capital Crew v14 — Contact & Bank Transfer Update

## Updated
- Replaced previous Kuda/Maya support contacts with:
  - Briana Smith
  - +27 68 028 9070
  - capitalcrew.inc@gmail.com
- Added a dedicated **Bank Transfer** payment method.
- Bank transfer destination shown in checkout:
  - Bank: TymeBank
  - Account name: Capital Crew Inc
  - Account number: 51042322891
  - Currency: ZAR
- Added bank-transfer reference field and pending-payment transaction flow.
- Added responsive mobile styling for the bank-transfer panel.
- Updated support wording in the Help Centre and documentation.
- Kept the Owner Control console visually separate from the member portal.

## Important production note
The bank-transfer button creates a local pending transaction in this package. It does **not** verify a bank payment or move money. For a live deployment, server-side reconciliation/webhook or authorised payment-provider integration must verify settlement before any member balance is credited.
