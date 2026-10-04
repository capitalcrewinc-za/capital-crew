// Supabase Edge Function starter: payment-webhook/index.ts
// Deploy server-side. Put provider secrets in Supabase Edge Function secrets.
// This is intentionally a provider-neutral skeleton; each gateway's signature
// verification and event format must be implemented from its official docs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", {status:405});

  const body = await req.text();

  // TODO: verify the payment provider's webhook signature here.
  // TODO: parse the provider-specific event and reject unverified events.

  const event = JSON.parse(body);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // TODO: map the provider reference to a Capital Crew payment.
  // TODO: use an idempotency check so the same webhook cannot credit twice.
  // TODO: only after verified success:
  // 1. mark payments.status = 'completed'
  // 2. insert a ledger_entries contribution
  // 3. update the wallet in one transaction/RPC
  // 4. write audit_log
  //
  // Never trust amount/user_id/payment status supplied by the browser.

  return new Response(JSON.stringify({ok:true}), {
    headers: {"content-type":"application/json"}
  });
});
