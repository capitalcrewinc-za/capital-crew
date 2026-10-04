const C=window.CAPITAL_CREW_CONFIG||{};
const hasConfig=C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&!C.SUPABASE_URL.includes("YOUR-PROJECT")&&!C.SUPABASE_ANON_KEY.includes("YOUR_PUBLIC");
const sb=hasConfig?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
let staff=null, profiles=[], payments=[], kyc=[], withdrawals=[], audit=[];

function money(v){return "R"+Number(v||0).toLocaleString("en-ZA",{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3000)}
function fmt(v){return v?new Date(v).toLocaleString("en-ZA"):"—"}
function initials(v){return (v||"A").split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()}
function section(name){
  $$(".section").forEach(x=>x.classList.toggle("active",x.id===name));
  $$(".nav").forEach(x=>x.classList.toggle("active",x.dataset.section===name));
  $("#sectionTitle").textContent=name[0].toUpperCase()+name.slice(1);
  $("#sidebar").classList.remove("open");
  if(name==="overview")loadOverview();
  if(name==="members")renderMembers();
  if(name==="kyc")loadKyc();
  if(name==="payments")renderPayments();
  if(name==="withdrawals")loadWithdrawals();
  if(name==="audit")loadAudit();
}
$$(".nav").forEach(x=>x.addEventListener("click",()=>section(x.dataset.section)));
$$("[data-go]").forEach(x=>x.addEventListener("click",()=>section(x.dataset.go)));
$("#hamb").onclick=()=>$("#sidebar").classList.toggle("open");
$("#refresh").onclick=()=>loadAll();

async function requireStaff(){
  if(!sb){
    $("#authMessage").textContent="Connect Supabase first: edit supabase/public-config.js with your project URL and public anon key.";
    return false;
  }
  const {data:{session}}=await sb.auth.getSession();
  if(!session)return false;
  const {data:role,error}=await sb.from("staff_roles").select("role,active").eq("user_id",session.user.id).maybeSingle();
  if(error||!role?.active){
    await sb.auth.signOut();
    $("#authMessage").textContent="This account is not authorised for the Capital Crew staff workspace.";
    return false;
  }
  staff={...session.user,...role};
  $("#staffEmail").textContent=session.user.email||"Staff";
  $("#staffAvatar").textContent=initials(session.user.email);
  $("#staffRole").textContent=role.role.toUpperCase();
  $("#staffName").textContent=(session.user.email||"Admin").split("@")[0]+".";
  $("#roleBadge").textContent=role.role.toUpperCase();
  return true;
}
async function login(e){
  e.preventDefault();
  if(!sb){$("#authMessage").textContent="Supabase is not configured yet.";return}
  $("#authMessage").textContent="";
  const {error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
  if(error){$("#authMessage").textContent=error.message;return}
  if(await requireStaff())openApp(); else await sb.auth.signOut();
}
$("#loginForm").addEventListener("submit",login);

function openApp(){$("#auth").classList.add("hidden");$("#app").classList.remove("hidden");loadAll()}
async function signOut(){if(sb)await sb.auth.signOut();location.reload()}
$("#logout").onclick=signOut;

async function loadAll(){
  if(!staff)return;
  await Promise.all([loadProfiles(),loadKyc(),loadPayments(),loadWithdrawals(),loadAudit()]);
  loadOverview();renderMembers();renderPayments();
}
async function loadProfiles(){
  const {data,error}=await sb.from("profiles").select("id,full_name,phone,email,kyc_status,created_at,updated_at").order("created_at",{ascending:false});
  if(error){toast(error.message);return} profiles=data||[];
  const ids=profiles.map(x=>x.id);
  // Wallets are read separately so a missing wallet row does not hide a member.
  const {data:ws}=ids.length?await sb.from("wallets").select("user_id,available_balance,pending_balance").in("user_id",ids):{data:[]};
  const wm=new Map((ws||[]).map(x=>[x.user_id,x]));
  profiles=profiles.map(p=>({...p,wallet:wm.get(p.id)||{available_balance:0,pending_balance:0}}));
}
async function loadKyc(){
  const {data,error}=await sb.from("kyc_documents").select("id,user_id,document_type,status,rejection_reason,reviewed_at,created_at").eq("status","pending").order("created_at",{ascending:true});
  if(error){toast(error.message);return} kyc=data||[];$("#kycCount").textContent=kyc.length;
}
async function loadPayments(){
  const {data,error}=await sb.from("payments").select("id,user_id,provider,method,external_reference,amount,currency,status,created_at,updated_at").order("created_at",{ascending:false}).limit(500);
  if(error){toast(error.message);return} payments=data||[];
}
async function loadWithdrawals(){
  const {data,error}=await sb.from("withdrawals").select("id,user_id,amount,status,bank_reference,created_at,updated_at").order("created_at",{ascending:true}).limit(500);
  if(error){toast(error.message);return} withdrawals=data||[];$("#withdrawCount").textContent=withdrawals.filter(x=>x.status==="requested").length;
}
async function loadAudit(){
  const {data,error}=await sb.from("audit_log").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").order("created_at",{ascending:false}).limit(300);
  if(error){toast(error.message);return} audit=data||[];
}

function member(id){return profiles.find(x=>x.id===id)||{}}
function loadOverview(){
  $("#mMembers").textContent=profiles.length.toLocaleString("en-ZA");
  $("#mBalance").textContent=money(profiles.reduce((s,p)=>s+Number(p.wallet?.available_balance||0),0));
  $("#mKyc").textContent=kyc.length;
  $("#mWithdraw").textContent=withdrawals.filter(x=>x.status==="requested").length;
  const a=$("#attention");
  const items=[];
  if(kyc.length)items.push(`<div class="record"><div><h3>${kyc.length} KYC submission${kyc.length===1?"":"s"} waiting</h3><p>Identity documents require staff review before deposits can be enabled.</p></div><div class="actions"><button class="smallbtn primary" data-go="kyc">Review KYC</button></div></div>`);
  const wr=withdrawals.filter(x=>x.status==="requested");
  if(wr.length)items.push(`<div class="record"><div><h3>${wr.length} withdrawal request${wr.length===1?"":"s"} waiting</h3><p>Check eligibility and approve/reject through the protected review action.</p></div><div class="actions"><button class="smallbtn primary" data-go="withdrawals">Review payouts</button></div></div>`);
  a.innerHTML=items.length?items.join(""):`<div class="empty">No pending operational actions.</div>`;
  a.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>section(b.dataset.go));
}
function renderMembers(){
  const q=($("#memberSearch")?.value||"").toLowerCase(), k=$("#memberKyc")?.value||"";
  const rows=profiles.filter(p=>(!k||p.kyc_status===k)&&`${p.full_name||""} ${p.email||""} ${p.phone||""}`.toLowerCase().includes(q));
  $("#membersBody").innerHTML=rows.length?rows.map(p=>`<tr><td><b>${esc(p.full_name||"Unnamed")}</b><br><span class="tag">${esc(p.id.slice(0,8))}</span></td><td>${esc(p.email||"—")}</td><td><span class="status ${esc(p.kyc_status)}">${esc(p.kyc_status)}</span></td><td>${fmt(p.created_at)}</td><td><button class="smallbtn" data-member="${p.id}">View</button></td></tr>`).join(""):`<tr><td colspan="5"><div class="empty">No matching members.</div></td></tr>`;
  $$("#membersBody [data-member]").forEach(b=>b.onclick=()=>showMember(b.dataset.member));
}
function showMember(id){
  const p=member(id);
  alert(`Member\\n\\nName: ${p.full_name||"—"}\\nEmail: ${p.email||"—"}\\nPhone: ${p.phone||"—"}\\nKYC: ${p.kyc_status||"—"}\\nAvailable: ${money(p.wallet?.available_balance)}\\nPending: ${money(p.wallet?.pending_balance)}`);
}
$("#memberSearch").oninput=renderMembers;$("#memberKyc").onchange=renderMembers;

async function loadKyc(){
  const {data,error}=await sb.from("kyc_documents").select("id,user_id,document_type,status,rejection_reason,reviewed_at,created_at").eq("status","pending").order("created_at",{ascending:true});
  if(error){toast(error.message);return} kyc=data||[];$("#kycCount").textContent=kyc.length;
  renderKyc();
}
function renderKyc(){
  const el=$("#kycList");
  el.innerHTML=kyc.length?kyc.map(d=>{const p=member(d.user_id);return `<div class="record"><div><h3>${esc(p.full_name||"Unnamed member")} <span class="tag">${esc(d.document_type)}</span></h3><p>${esc(p.email||"")} · Submitted ${fmt(d.created_at)}</p><p>Document ID: ${esc(d.id)}</p></div><div class="actions"><button class="smallbtn primary" data-approve="${d.id}">Approve</button><button class="smallbtn danger" data-reject="${d.id}">Reject</button></div></div>`}).join(""):`<div class="empty">KYC queue is clear.</div>`;
  el.querySelectorAll("[data-approve]").forEach(b=>b.onclick=()=>reviewKyc(b.dataset.approve,"approved"));
  el.querySelectorAll("[data-reject]").forEach(b=>b.onclick=()=>reviewKyc(b.dataset.reject,"rejected"));
}
async function reviewKyc(id,decision){
  let reason=null;
  if(decision==="rejected"){reason=prompt("Reason for rejection (shown to the member):","Please upload a clear, valid identity document.");if(reason===null)return}
  const {error}=await sb.rpc("review_kyc",{p_document_id:id,p_decision:decision,p_reason:reason});
  if(error){toast(error.message);return}
  toast("KYC "+decision+".");await loadAll();section("kyc");
}

function renderPayments(){
  const q=($("#paymentSearch")?.value||"").toLowerCase(), s=$("#paymentStatus")?.value||"";
  const rows=payments.filter(x=>(!s||x.status===s)&&`${x.id} ${x.user_id} ${x.external_reference||""} ${x.provider||""}`.toLowerCase().includes(q));
  $("#paymentsBody").innerHTML=rows.length?rows.map(x=>{const p=member(x.user_id);return `<tr><td>${fmt(x.created_at)}</td><td>${esc(p.full_name||p.email||x.user_id?.slice(0,8))}</td><td>${esc(x.provider)}</td><td>${esc(x.method)}</td><td>${money(x.amount)} ${esc(x.currency)}</td><td><span class="status ${esc(x.status)}">${esc(x.status)}</span></td><td>${esc(x.external_reference||"—")}</td></tr>`}).join(""):`<tr><td colspan="7"><div class="empty">No payments found.</div></td></tr>`;
}
$("#paymentSearch").oninput=renderPayments;$("#paymentStatus").onchange=renderPayments;

async function loadWithdrawals(){
  const {data,error}=await sb.from("withdrawals").select("id,user_id,amount,status,bank_reference,created_at,updated_at").order("created_at",{ascending:true}).limit(500);
  if(error){toast(error.message);return} withdrawals=data||[];$("#withdrawCount").textContent=withdrawals.filter(x=>x.status==="requested").length;renderWithdrawals();
}
function renderWithdrawals(){
  const pending=withdrawals.filter(x=>x.status==="requested"), el=$("#withdrawalsList");
  el.innerHTML=pending.length?pending.map(w=>{const p=member(w.user_id);return `<div class="record"><div><h3>${esc(p.full_name||"Unnamed member")} · ${money(w.amount)}</h3><p>${esc(p.email||"")} · Requested ${fmt(w.created_at)}</p><p>Withdrawal ID: ${esc(w.id)}</p></div><div class="actions"><button class="smallbtn primary" data-wapprove="${w.id}">Approve</button><button class="smallbtn danger" data-wreject="${w.id}">Reject</button></div></div>`}).join(""):`<div class="empty">No withdrawal requests are waiting.</div>`;
  el.querySelectorAll("[data-wapprove]").forEach(b=>b.onclick=()=>reviewWithdrawal(b.dataset.wapprove,"approved"));
  el.querySelectorAll("[data-wreject]").forEach(b=>b.onclick=()=>reviewWithdrawal(b.dataset.wreject,"rejected"));
}
async function reviewWithdrawal(id,decision){
  let ref=null;
  if(decision==="approved"){ref=prompt("Settlement/bank reference (optional until the provider returns one):","");if(ref===null)return}
  const {error}=await sb.rpc("review_withdrawal",{p_withdrawal_id:id,p_decision:decision,p_bank_reference:ref});
  if(error){toast(error.message);return}
  toast("Withdrawal "+decision+".");await loadAll();section("withdrawals");
}

function renderAudit(){
  $("#auditBody").innerHTML=audit.length?audit.map(x=>`<tr><td>${fmt(x.created_at)}</td><td>${esc(x.actor_id?.slice(0,8)||"system")}</td><td><b>${esc(x.action)}</b></td><td>${esc(x.entity_type||"—")}<br>${esc(x.entity_id||"")}</td><td>${esc(JSON.stringify(x.metadata||{}))}</td></tr>`).join(""):`<tr><td colspan="5"><div class="empty">No audit events.</div></td></tr>`;
}
async function loadAudit(){const {data,error}=await sb.from("audit_log").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").order("created_at",{ascending:false}).limit(300);if(error){toast(error.message);return}audit=data||[];renderAudit()}

function showConnection(){
  $("#connection").innerHTML=hasConfig
    ? `<div class="tag">CONNECTED</div><p class="muted">Supabase project configured. Staff role checks are active for this workspace.</p>`
    : `<div class="tag">NOT CONNECTED</div><p class="muted">Edit <code>supabase/public-config.js</code> with the public Supabase URL and anon key, then redeploy.</p>`;
}
$("#refresh").addEventListener("click",loadAll);
showConnection();

(async()=>{
  if(hasConfig){
    const ok=await requireStaff();
    if(ok)openApp();
  }else{
    $("#authMessage").textContent="Supabase is not configured. The admin workspace is intentionally locked until a real database/auth connection is added.";
  }
})();
