const state={
 plan:"Starter",amount:150,fee:5,
 tx:[
  {date:"—",ref:"No transactions yet",plan:"—",amount:"R0",status:"Pending"}
 ],
 contributed:0,balance:0,refReward:0
};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const KYC_KEY="cc_kyc";
const USER_KEY="cc_member_user";
const LOGIN_PENDING_KEY="cc_login_pending";
const REGISTER_PENDING_KEY="cc_register_pending";
const CONFIRM_ENDPOINT="/api/send-confirmation-code";
const PROFILE_KEY="cc_profile";
let selectedPaymentMethod="Payfast/Card";
function getKyc(){return localStorage.getItem(KYC_KEY)||"unverified"}
function getProfile(){return JSON.parse(localStorage.getItem(PROFILE_KEY)||"{}")}
function initials(name){return (name||"Member").split(/\\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join("").toUpperCase()||"M"}
function setAvatar(el,profile){
  if(!el)return;
  if(profile.photo){el.innerHTML=`<img src="${profile.photo}" alt="Profile picture">`}
  else el.textContent=initials(profile.name||"Member");
}
function updateKycUI(){
  const status=getKyc(), verified=status==="verified", pending=status==="pending", rejected=status==="rejected";
  const gate=$("#depositGate");
  if(gate){gate.classList.toggle("hidden",verified);gate.classList.toggle("verified",verified);gate.querySelector("strong").textContent=verified?"Account verified — deposits enabled":"Verification required before depositing";gate.querySelector("p").textContent=verified?"Your identity verification has been approved. You can continue to secure payment.":"Complete account verification before you can create a contribution/payment session."}
  ["kycStatus","kycInlineStatus"].forEach(id=>{const el=$("#"+id);if(!el)return;el.className="kyc-status "+(verified?"verified":pending?"pending":rejected?"rejected":"");el.textContent=verified?"● Verified":pending?"● Verification pending":rejected?"● Verification rejected":"● Verification required"});
  const submit=$("#submitKyc"), notice=$("#kycNotice"), doc=$("#kycDocument");
  if(submit){submit.disabled=verified||pending;submit.textContent=verified?"Account verified":pending?"Verification under review":"Submit verification for review"}
  if(notice)notice.textContent=verified?"Your account is verified and deposits are enabled.":pending?"Your verification is under review. Deposits remain disabled until approval.":rejected?"Your verification was rejected. Upload a corrected document and resubmit.":"Your account remains unable to deposit until verification is approved.";
  if(doc)doc.disabled=verified||pending;
}
function loadProfileUI(){
  const u=getProfile(); const session=JSON.parse(localStorage.getItem("cc_session")||"null")||{};
  const profile={...session,...u};
  $("#profileDisplayName")?.replaceChildren(document.createTextNode(profile.name||"Member Account"));
  setAvatar($("#profileAvatar"),profile);setAvatar($("#topAvatar"),profile);
  ["name","phone","email","address"].forEach(k=>{const el=$("#profile"+k[0].toUpperCase()+k.slice(1));if(el)el.value=profile[k]||""});
  updateKycUI();
}
function money(n){return "R"+Number(n).toLocaleString("en-ZA")}
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),3500)}
function show(view){
  $$(".view").forEach(v=>v.classList.remove("active"));
  const el=$("#"+view); if(el) el.classList.add("active");
  $$(".side-link").forEach(b=>b.classList.toggle("active",b.dataset.view===view));
  $("#viewTitle").textContent=view==="overview"?"Overview":view[0].toUpperCase()+view.slice(1);
  $("#sidebar").classList.remove("open");
  window.scrollTo({top:0,behavior:"smooth"});
}
$$("[data-view]").forEach(el=>el.addEventListener("click",e=>{e.preventDefault();show(el.dataset.view)}));
$("#hamb").onclick=()=>$("#sidebar").classList.toggle("open");

$("#notif").onclick=()=>toast("You have no new notifications.");
function renderCheckout(){
 $("#cPlan").textContent=state.plan; $("#cAmount").textContent=money(state.amount); $("#cFee").textContent=money(state.fee);
 $("#cTotal").textContent=money(state.amount+state.fee)+" ZAR"; $("#payAmount").textContent=money(state.amount+state.fee)+" ZAR";
 const methodLabel=selectedPaymentMethod==="Payfast/Card"?"Card":selectedPaymentMethod;
 if($("#cMethod")) $("#cMethod").textContent=methodLabel;
 if($("#methodStatus")) $("#methodStatus").textContent="Selected: "+methodLabel;
 $$(".plan").forEach(x=>x.classList.toggle("selected-plan",x.dataset.plan===state.plan));
}
function selectPlan(card,scroll=true){
 const p=card.closest(".plan")||card;
 state.plan=p.dataset.plan; state.amount=+p.dataset.amount; state.fee=+p.dataset.fee; renderCheckout();
 if(scroll) $("#checkoutCard").scrollIntoView({behavior:"smooth",block:"start"});
 toast(state.plan+" selected.");
}
$$(".plan").forEach(card=>card.addEventListener("click",e=>{
 selectPlan(card,!!e.target.closest(".choose"));
}));
function renderDashboard(){
 $("#balance").textContent=money(state.balance); $("#contributed").textContent=money(state.contributed);
 $("#activePlan").textContent=state.plan; $("#activePlanMeta").textContent=state.contributed?money(state.contributed)+" contributed":"No live contribution";
 $("#refReward").textContent=money(state.refReward); $("#refBig").textContent=money(state.refReward);
 const pct=Math.min(100,Math.round((state.contributed/1000)*100)); $("#progressPct").textContent=pct+"%";
 $(".ring").style.background=`conic-gradient(#078640 ${pct*3.6}deg,#e7efe9 0deg)`;
 $("#progressTitle").textContent=state.contributed?"You're building momentum":"Build your first balance";
}
function renderTx(){
 const q=$("#searchTx").value.toLowerCase(), f=$("#statusFilter").value;
 $("#txBody").innerHTML=state.tx.filter(x=>(f==="All statuses"||x.status===f)&&Object.values(x).join(" ").toLowerCase().includes(q)).map(x=>`<tr><td>${x.date}</td><td>${x.ref}</td><td>${x.plan}</td><td>${x.amount}</td><td><span class="status-pill ${x.status.toLowerCase()}">${x.status}</span></td></tr>`).join("");
 $("#recentActivity").innerHTML=state.tx.slice(0,4).map(x=>`<div class="item"><div class="act-icon">↗</div><div><b>${x.plan==="—"?"No activity yet":x.plan+" contribution"}</b><small>${x.date} · ${x.ref}</small></div><span class="amount">${x.amount}</span></div>`).join("");
}
$("#checkoutForm").addEventListener("submit",e=>{
 e.preventDefault();
 if(getKyc()!=="verified"){toast("Verification is required before you can deposit. Please complete Profile & KYC.");show("profile");return}
 const name=$("#name").value.trim();
 if(selectedPaymentMethod==="Bank Transfer"){
   const bankRef=$("#bankTransferReference")?.value.trim()||"";
   const ref=bankRef||("BT-CC-"+Date.now().toString().slice(-8));
   state.tx.unshift({date:new Date().toLocaleDateString("en-ZA"),ref,plan:state.plan,amount:money(state.amount+state.fee),status:"Pending"});
   state.tx=state.tx.filter(x=>x.ref!=="No transactions yet");
   renderTx();
   if($("#bankTransferReference")) $("#bankTransferReference").value="";
   toast("Bank transfer marked as pending. Keep your transfer confirmation for verification.");
   return;
 }
 if(selectedPaymentMethod==="1Voucher"||selectedPaymentMethod==="OTT"){
   const pin=$("#voucherPin")?.value.trim()||"";
   const valid=(selectedPaymentMethod==="1Voucher" && /^\d{16}$/.test(pin)) || (selectedPaymentMethod==="OTT" && /^\d{12}$/.test(pin));
   if(!valid){toast(selectedPaymentMethod==="1Voucher"?"Enter the 16-digit 1Voucher PIN.":"Enter the 12-digit OTT Voucher PIN.");$("#voucherPin")?.focus();return}
   // Production: POST this PIN directly to the authorised voucher provider/backend for validation.
   // Never email it, place it in localStorage, or expose it to administrators by email.
   toast("Voucher details captured for authorised provider validation. Provider integration is required before this payment can be confirmed.");
   $("#voucherPin").value="";
   return;
 }
 const ref="CC-"+Date.now().toString().slice(-8);
 state.tx.unshift({date:new Date().toLocaleDateString("en-ZA"),ref,plan:state.plan,amount:money(state.amount+state.fee),status:"Pending"});
 state.tx=state.tx.filter(x=>x.ref!=="No transactions yet");
 renderTx();
 toast(`${selectedPaymentMethod==="Payfast/Card"?"Card":selectedPaymentMethod} payment session created for ${name}. Complete payment with the authorised provider.`);
});
$("#searchTx").addEventListener("input",renderTx);$("#statusFilter").addEventListener("change",renderTx);
$("#copyRef").onclick=async()=>{const link="https://capitalcrew.example/r/CAPITAL-KR72";try{await navigator.clipboard.writeText(link)}catch{}toast("Referral link copied.");};
$("#exportCsv").onclick=()=>{
 const rows=[["Date","Reference","Plan","Amount","Status"],...state.tx.map(x=>[x.date,x.ref,x.plan,x.amount,x.status])];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="capital-crew-transactions.csv";a.click();URL.revokeObjectURL(a.href);
};
renderCheckout();renderDashboard();renderTx();

const moneyOptions=[
  [60,10],[100,15],[250,30],[500,60],
  [750,90],[1000,120],[1500,180],[2000,240],
  [3000,360],[4000,480],[5000,600],[6000,720],
  [7500,900],[8000,960],[9000,1080],[10000,1200]
];
function renderMoneyList(){
  const grid=$("#moneyGrid");
  if(!grid)return;
  grid.innerHTML=moneyOptions.map(([amount,daily])=>`
    <article class="money-card">
      <small>CONTRIBUTION</small>
      <div class="contribution">${money(amount)}</div>
      <div class="daily">${money(daily)} / day</div>
      <small>Illustrative daily-share amount</small>
      <button class="choose-money" data-money="${amount}">Choose ${money(amount)} →</button>
    </article>`).join("");
  $$(".choose-money").forEach(btn=>btn.addEventListener("click",()=>{
    const amount=+btn.dataset.money;
    const found=moneyOptions.find(x=>x[0]===amount);
    state.plan="Custom";state.amount=amount;state.fee=amount<1000?5:amount<5000?10:15;
    renderCheckout();show("invest");$("#checkoutCard").scrollIntoView({behavior:"smooth"});
    toast(`${money(amount)} option selected. Daily share shown is illustrative.`);
  }));
}
function enterApp(name,email){
  localStorage.setItem("cc_session",JSON.stringify({name,email}));
  $("#authShell").style.display="none";$("#appShell").style.display="flex";
  const first=(name||"Member").split(" ")[0];
  $(".welcome h1").innerHTML=`Good morning, <span>${first}.</span>`;
  loadProfileUI();
}
function generateLoginCode(){return String(Math.floor(100000+Math.random()*900000));}
async function requestConfirmationCode(payload){
  // Production: the server must generate the code, store only a secure hash,
  // enforce expiry/rate limits, and email the code to payload.email.
  try{
    const res=await fetch(CONFIRM_ENDPOINT,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
    if(res.ok)return {server:true};
  }catch{}
  // Local/offline fallback so the static package remains testable. This must
  // never be used as the production security mechanism.
  return {server:false,code:generateLoginCode()};
}
async function beginConfirmation({name,email,type="login",password=""}){
  const pendingKey=type==="register"?REGISTER_PENDING_KEY:LOGIN_PENDING_KEY;
  const result=await requestConfirmationCode({email,name,type});
  const pending={name,email,type,password,createdAt:Date.now(),code:result.code||null};
  localStorage.setItem(pendingKey,JSON.stringify(pending));
  $("#loginCard").classList.add("hidden");$("#registerCard").classList.add("hidden");$("#confirmCard").classList.remove("hidden");
  $("#confirmEmail").textContent=email;$("#confirmCode").value="";$("#confirmCode").focus();
  $("#loginCodePreview").textContent=result.server?"Confirmation code sent to your email.":`Local test code: ${result.code}`;
  $("#confirmHint").textContent=result.server?"Enter the one-time code sent to your email. The code expires after 10 minutes.":"Local/offline mode: the code is shown here for testing. Production must send and verify the code on the server.";
  toast(result.server?`Confirmation code sent to ${email}.`:`Test confirmation code generated for ${email}.`);
}
function cancelConfirmation(){localStorage.removeItem(LOGIN_PENDING_KEY);localStorage.removeItem(REGISTER_PENDING_KEY);$("#confirmCard").classList.add("hidden");$("#loginCard").classList.remove("hidden");}
function signOut(){localStorage.removeItem("cc_session");$("#appShell").style.display="none";$("#authShell").style.display="flex";cancelConfirmation();}
$("#showRegister").onclick=()=>{$("#loginCard").classList.add("hidden");$("#registerCard").classList.remove("hidden")};
$("#showLogin").onclick=()=>{$("#registerCard").classList.add("hidden");$("#loginCard").classList.remove("hidden")};
$("#registerForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const name=$("#regName").value.trim(),email=$("#regEmail").value.trim(),password=$("#regPassword").value;
  const existing=JSON.parse(localStorage.getItem(USER_KEY)||"null");
  if(existing?.email===email){toast("An account with that email already exists. Sign in instead.");return}
  await beginConfirmation({name,email,password,type:"register"});
});
$("#loginForm").addEventListener("submit",async e=>{
  e.preventDefault();
  const user=JSON.parse(localStorage.getItem(USER_KEY)||"null");
  const email=$("#loginEmail").value.trim(),password=$("#loginPassword").value;
  if(user && user.email===email && user.password===password){await beginConfirmation({name:user.name,email:user.email,type:"login"});}
  else {toast("The email or password is incorrect.");}
});
$("#confirmForm")?.addEventListener("submit",e=>{
  e.preventDefault();
  const loginPending=JSON.parse(localStorage.getItem(LOGIN_PENDING_KEY)||"null");
  const registerPending=JSON.parse(localStorage.getItem(REGISTER_PENDING_KEY)||"null");
  const pending=loginPending||registerPending;
  const entered=$("#confirmCode").value.trim();
  if(!pending){toast("Your confirmation session has expired. Start again.");cancelConfirmation();return}
  if(Date.now()-pending.createdAt>10*60*1000){toast("That confirmation code has expired. Generate a new one.");cancelConfirmation();return}
  if(pending.code && entered!==pending.code){toast("Incorrect confirmation code.");return}
  if(!pending.code){
    // With a production endpoint, the server must verify the code before the
    // client receives a successful response. This local UI path cannot do that.
    toast("Production confirmation verification must be completed by the server.");return;
  }
  if(pending.type==="register"){
    localStorage.setItem(USER_KEY,JSON.stringify({name:pending.name,email:pending.email,password:pending.password,emailVerified:true}));
    localStorage.removeItem(REGISTER_PENDING_KEY);
    enterApp(pending.name,pending.email);toast("Email confirmed and account created.");
  }else{
    localStorage.removeItem(LOGIN_PENDING_KEY);enterApp(pending.name,pending.email);toast("Sign-in confirmed.");
  }
});
$("#resendCode")?.addEventListener("click",async()=>{
  const pending=JSON.parse(localStorage.getItem(REGISTER_PENDING_KEY)||localStorage.getItem(LOGIN_PENDING_KEY)||"null");
  if(pending) await beginConfirmation(pending); else toast("Start again to request a confirmation code.");
});
$("#cancelConfirm")?.addEventListener("click",cancelConfirmation);
$("#logout").onclick=signOut;
const session=JSON.parse(localStorage.getItem("cc_session")||"null");
if(session)enterApp(session.name,session.email);

renderMoneyList();

// ---- Production-ready account/profile + terms + payment selection layer ----
const METHOD_NOTES={
 "Payfast/Card":"Card checkout is routed through the configured payment gateway.",
 "Instant EFT":"Instant EFT requires an enabled provider/gateway account and server-side confirmation.",
 "Bank Transfer":"Transfer the exact total to TymeBank account 51042322891 for Capital Crew Inc. Your payment remains pending until verified.",
 "1Voucher":"1Voucher requires a merchant agreement and Flash API integration; do not collect voucher PINs into your own database.",
 "OTT":"OTT integration depends on the selected OTT merchant/provider API and approval.",
 "Wallet/Other":"Add additional authorised payment providers here."
};
function updateVoucherPanel(){
  const panel=$("#voucherPanel"), pin=$("#voucherPin"), label=$("#voucherLabel"), help=$("#voucherHelp"), buy1=$("#voucherBuyLink"), buyOtt=$("#ottBuyLink");
  const bankPanel=$("#bankTransferPanel");
  const is1=selectedPaymentMethod==="1Voucher", isOtt=selectedPaymentMethod==="OTT";
  if(!panel)return;
  panel.classList.toggle("hidden",!(is1||isOtt));
  bankPanel?.classList.toggle("hidden",selectedPaymentMethod!=="Bank Transfer");
  if(pin){pin.value="";pin.maxLength=is1?16:12;pin.pattern=is1?"[0-9]{16}":"[0-9]{12}";pin.placeholder=is1?"Enter 16-digit 1Voucher PIN":"Enter 12-digit OTT PIN";pin.required=is1||isOtt;}
  if(label)label.firstChild.textContent=is1?"1Voucher PIN":isOtt?"OTT Voucher PIN":"Voucher PIN";
  if(help)help.textContent=is1?"1Voucher uses a 16-digit PIN. The PIN is sent only to the authorised payment provider for validation and is never stored or emailed by Capital Crew.":"OTT Voucher uses a 12-digit PIN. The PIN is sent only to the authorised payment provider for validation and is never stored or emailed by Capital Crew.";
  buy1?.classList.toggle("hidden",!is1); buyOtt?.classList.toggle("hidden",!isOtt);
}
$$('.pay-option').forEach(btn=>btn.addEventListener('click',()=>{
  $$('.pay-option').forEach(x=>x.classList.remove('selected'));
  btn.classList.add('selected');
  selectedPaymentMethod=btn.dataset.method;
  $("#methodNote").textContent=METHOD_NOTES[selectedPaymentMethod];
  renderCheckout();
  updateVoucherPanel();
  toast((selectedPaymentMethod==="Payfast/Card"?"Card":selectedPaymentMethod)+" selected.");
}));
updateVoucherPanel();
$("#topAvatar")?.addEventListener("click",()=>{show("profile");$("#profileEdit")?.classList.remove("hidden");});
$("#editProfileBtn")?.addEventListener("click",()=>{
  $("#profileEdit").classList.toggle("hidden");loadProfileUI();
});
$("#saveProfile")?.addEventListener("click",()=>{
  const old=getProfile();
  const u={...old,name:$("#profileName").value.trim(),phone:$("#profilePhone").value.trim(),email:$("#profileEmail").value.trim(),address:$("#profileAddress").value.trim()};
  localStorage.setItem(PROFILE_KEY,JSON.stringify(u));
  loadProfileUI();toast("Profile saved locally in this prototype.");$("#profileEdit").classList.add("hidden");
});
$("#profilePhoto")?.addEventListener("change",e=>{
  const file=e.target.files?.[0]; if(!file)return;
  if(file.size>2*1024*1024){toast("Profile picture must be 2 MB or smaller.");e.target.value="";return}
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)){toast("Use JPG, PNG or WebP.");e.target.value="";return}
  const reader=new FileReader();
  reader.onload=()=>{const u=getProfile();u.photo=reader.result;localStorage.setItem(PROFILE_KEY,JSON.stringify(u));loadProfileUI();toast("Profile picture updated.")};
  reader.readAsDataURL(file);
});
$("#submitKyc")?.addEventListener("click",()=>{
  const file=$("#kycDocument")?.files?.[0];
  if(!file){toast("Choose an identity document first.");return}
  if(file.size>5*1024*1024){toast("Verification document must be 5 MB or smaller.");return}
  if(!["application/pdf","image/jpeg","image/png"].includes(file.type)){toast("Use PDF, JPG or PNG.");return}
  localStorage.setItem(KYC_KEY,"pending");
  // Prototype only: never store sensitive identity documents in localStorage.
  updateKycUI();toast("Verification submitted for review. An administrator must approve it before deposits are enabled.");
});
$("#acceptTerms")?.addEventListener("click",()=>{
  if(!$("#termsAccept").checked){toast("Please tick the acceptance box first.");return}
  localStorage.setItem("cc_terms_accepted",new Date().toISOString());toast("Terms accepted for this browser session.");
});

loadProfileUI();

// ---- Protected owner control console ----
let adminClient=null;
function getSessionMeta(){return JSON.parse(localStorage.getItem("cc_session")||"null")||{};}
function isOwner(){return getSessionMeta().role==="owner" || getSessionMeta().role==="admin";}
function setOwnerNav(){
  const nav=$("#ownerNav");
  if(nav) nav.classList.toggle("hidden",!isOwner());
}
function adminEsc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
function adminMoney(v){return money(Number(v||0));}
function adminFormatDate(v){if(!v)return "—";const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString("en-ZA");}
function adminMessage(msg){toast(msg);}
async function initAdminClient(){
  const cfg=window.CAPITAL_CREW_CONFIG;
  if(!cfg || !window.supabase || !cfg.SUPABASE_URL || cfg.SUPABASE_URL.includes("YOUR-PROJECT") || !cfg.SUPABASE_ANON_KEY || cfg.SUPABASE_ANON_KEY.includes("YOUR_PUBLIC")) return null;
  try{adminClient=window.supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);return adminClient;}catch(e){return null}
}
async function loadAdminData(){
  if(!isOwner()){show("overview");adminMessage("Owner authorization is required to open this area.");return}
  const client=adminClient||await initAdminClient();
  if(!client){
    ["adminMemberCount","adminVerifiedCount","adminKycCount","adminWithdrawalCount"].forEach(id=>{const el=$("#"+id);if(el)el.textContent="—"});
    $("#adminMembersBody").innerHTML='<tr><td colspan="6" class="admin-empty">Secure database connection is not configured. Add the Supabase URL/anon key and assign your account the owner role.</td></tr>';
    $("#adminKycBody").innerHTML='<tr><td colspan="5" class="admin-empty">Connect the protected Supabase owner workflow to load KYC submissions.</td></tr>';
    $("#adminWithdrawalsBody").innerHTML='<tr><td colspan="6" class="admin-empty">Connect the protected Supabase owner workflow to load withdrawals.</td></tr>';
    return;
  }
  try{
    const [{data:profiles,error:pErr},{data:kyc,error:kErr},{data:withdrawals,error:wErr},{data:payments,error:payErr},{data:audit,error:aErr}]=await Promise.all([
      client.from("profiles").select("id,full_name,email,phone,kyc_status,created_at").order("created_at",{ascending:false}),
      client.from("kyc_documents").select("id,user_id,document_type,status,created_at,profiles(full_name,email)").order("created_at",{ascending:false}),
      client.from("withdrawals").select("id,user_id,amount,status,eligible_at,created_at,payout_reference,profiles(full_name,email)").order("created_at",{ascending:false}),
      client.from("payments").select("id,user_id,provider,method,amount,status,external_reference,created_at,profiles(full_name,email)").order("created_at",{ascending:false}),
      client.from("audit_log").select("id,actor_id,action,entity_type,entity_id,metadata,created_at").order("created_at",{ascending:false}).limit(100)
    ]);
    if(pErr||kErr||wErr||payErr||aErr) throw (pErr||kErr||wErr||payErr||aErr);
    const memberIds=(profiles||[]).map(x=>x.id);
    let balances={};
    if(memberIds.length){
      const {data:wallets}=await client.from("wallets").select("user_id,available_balance").in("user_id",memberIds);
      (wallets||[]).forEach(w=>balances[w.user_id]=w.available_balance);
    }
    const verified=(profiles||[]).filter(x=>x.kyc_status==="verified").length;
    const pendingKyc=(profiles||[]).filter(x=>x.kyc_status==="pending").length+(kyc||[]).filter(x=>x.status==="pending").length;
    const pendingWithdrawals=(withdrawals||[]).filter(x=>["requested","approved","processing"].includes(x.status)).length;
    $("#adminMemberCount").textContent=profiles?.length??0;
    $("#adminVerifiedCount").textContent=verified;
    $("#adminKycCount").textContent=pendingKyc;
    $("#adminWithdrawalCount").textContent=pendingWithdrawals;
    renderAdminMembers(profiles||[],balances);
    renderAdminKyc(kyc||[]);
    renderAdminWithdrawals(withdrawals||[]);
    renderAdminPayments(payments||[]);
    renderAdminAudit(audit||[]);
  }catch(err){
    console.error(err);adminMessage("Owner data could not be loaded. Check your owner role and RLS policies.");
  }
}
function renderAdminMembers(rows,balances){
  const body=$("#adminMembersBody");if(!body)return;
  const q=($("#adminMemberSearch")?.value||"").toLowerCase();const status=$("#adminMemberStatus")?.value||"all";
  const filtered=rows.filter(x=>(status==="all"||x.kyc_status===status)&&(`${x.full_name||""} ${x.email||""}`.toLowerCase().includes(q)));
  body.innerHTML=filtered.length?filtered.map(x=>`<tr><td><b>${adminEsc(x.full_name||"Member")}</b><small>${adminEsc(x.phone||"")}</small></td><td>${adminEsc(x.email||"—")}</td><td><span class="admin-status ${adminEsc(x.kyc_status)}">${adminEsc(x.kyc_status||"unverified")}</span></td><td>${adminMoney(balances[x.id]||0)}</td><td>${adminFormatDate(x.created_at)}</td><td><button class="admin-action" data-admin-member="${adminEsc(x.id)}">View</button></td></tr>`).join(""):'<tr><td colspan="6" class="admin-empty">No members match the current filter.</td></tr>';
  body.querySelectorAll("[data-admin-member]").forEach(btn=>btn.addEventListener("click",()=>adminMessage("Member detail is available through the protected server workflow. Add a member-detail RPC before exposing sensitive KYC documents.")));
}
function renderAdminKyc(rows){
  const body=$("#adminKycBody");if(!body)return;
  body.innerHTML=rows.length?rows.map(x=>`<tr><td><b>${adminEsc(x.profiles?.full_name||"Member")}</b><small>${adminEsc(x.profiles?.email||"")}</small></td><td>${adminEsc(x.document_type)}</td><td>${adminFormatDate(x.created_at)}</td><td><span class="admin-status ${adminEsc(x.status)}">${adminEsc(x.status)}</span></td><td>${x.status==="pending"?`<button class="admin-action primary-action" data-kyc-action="approve" data-kyc-id="${adminEsc(x.id)}">Approve</button> <button class="admin-action danger" data-kyc-action="reject" data-kyc-id="${adminEsc(x.id)}">Reject</button>`:"—"}</td></tr>`).join(""):'<tr><td colspan="5" class="admin-empty">No KYC submissions.</td></tr>';
  body.querySelectorAll("[data-kyc-action]").forEach(btn=>btn.addEventListener("click",()=>adminKycAction(btn.dataset.kycId,btn.dataset.kycAction)));
}
async function adminKycAction(id,action){
  if(!adminClient)return adminMessage("Connect the secure Supabase owner workflow first.");
  if(action==="reject" && !confirm("Reject this verification submission?"))return;
  const fn=action==="approve"?"admin_approve_kyc":"admin_reject_kyc";
  const args=action==="approve"?{p_document_id:id}:{p_document_id:id,p_reason:"Rejected by owner review"};
  const {error}=await adminClient.rpc(fn,args);
  if(error){adminMessage("KYC action failed: "+error.message);return}
  adminMessage(action==="approve"?"KYC approved.":"KYC rejected.");loadAdminData();
}
function renderAdminWithdrawals(rows){
  const body=$("#adminWithdrawalsBody");if(!body)return;
  body.innerHTML=rows.length?rows.map(x=>{const canApprove=x.status==="requested"&&x.eligible_at&&new Date(x.eligible_at)<=new Date();const canPay=x.status==="approved"||x.status==="processing";return `<tr><td><b>${adminEsc(x.profiles?.full_name||"Member")}</b><small>${adminEsc(x.profiles?.email||"")}</small></td><td>${adminMoney(x.amount)}</td><td>${adminFormatDate(x.eligible_at)}</td><td><span class="admin-status ${adminEsc(x.status)}">${adminEsc(x.status)}</span></td><td>${adminEsc(x.payout_reference||"—")}</td><td>${canApprove?`<button class="admin-action primary-action" data-w-action="approve" data-w-id="${adminEsc(x.id)}">Approve</button>`:""} ${canPay?`<button class="admin-action" data-w-action="paid" data-w-id="${adminEsc(x.id)}">Record payout</button>`:""}${!canApprove&&!canPay?"—":""}</td></tr>`}).join(""):'<tr><td colspan="6" class="admin-empty">No withdrawal requests.</td></tr>';
  body.querySelectorAll("[data-w-action]").forEach(btn=>btn.addEventListener("click",()=>adminWithdrawalAction(btn.dataset.wId,btn.dataset.wAction)));
}
async function adminWithdrawalAction(id,action){
  if(!adminClient)return adminMessage("Connect the secure Supabase owner workflow first.");
  if(action==="approve"){
    if(!confirm("Approve this eligible withdrawal and queue it for payout?"))return;
    const {error}=await adminClient.rpc("admin_approve_withdrawal",{p_withdrawal_id:id});
    if(error){adminMessage("Approval failed: "+error.message);return}
    adminMessage("Withdrawal approved and queued for payout.");
  }else{
    const ref=prompt("Enter the payment provider/bank payout reference:");if(!ref)return;
    const {error}=await adminClient.rpc("admin_mark_withdrawal_paid",{p_withdrawal_id:id,p_payout_reference:ref});
    if(error){adminMessage("Payout record failed: "+error.message);return}
    adminMessage("Payout recorded with reference "+ref+".");
  }
  loadAdminData();
}
function renderAdminPayments(rows){
  const body=$("#adminPaymentsBody");if(!body)return;
  body.innerHTML=rows.length?rows.map(x=>`<tr><td>${adminEsc(x.profiles?.full_name||"Member")}</td><td>${adminEsc(x.provider)}</td><td>${adminEsc(x.method)}</td><td>${adminMoney(x.amount)}</td><td><span class="admin-status ${adminEsc(x.status)}">${adminEsc(x.status)}</span></td><td>${adminEsc(x.external_reference||"—")}</td></tr>`).join(""):'<tr><td colspan="6" class="admin-empty">No payment records.</td></tr>';
}
function renderAdminAudit(rows){
  const body=$("#adminAuditBody");if(!body)return;
  body.innerHTML=rows.length?rows.map(x=>`<tr><td>${adminFormatDate(x.created_at)}</td><td>${adminEsc(x.actor_id||"—")}</td><td>${adminEsc(x.action)}</td><td>${adminEsc((x.entity_type||"")+" "+(x.entity_id||""))}</td><td>${adminEsc(JSON.stringify(x.metadata||{}))}</td></tr>`).join(""):'<tr><td colspan="5" class="admin-empty">No audit records.</td></tr>';
}
$$('[data-admin-tab]').forEach(btn=>btn.addEventListener('click',()=>{
  $$('[data-admin-tab]').forEach(x=>x.classList.remove('active'));btn.classList.add('active');
  $$('.admin-pane').forEach(x=>x.classList.remove('active'));
  const map={members:'adminMembers',kyc:'adminKyc',withdrawals:'adminWithdrawals',payments:'adminPayments',audit:'adminAudit'};
  $("#"+map[btn.dataset.adminTab])?.classList.add('active');
}));
["adminMemberSearch","adminMemberStatus"].forEach(id=>$("#"+id)?.addEventListener(id.includes("Search")?"input":"change",loadAdminData));
["refreshAdminKyc","refreshAdminWithdrawals","refreshAdminPayments","refreshAdminAudit"].forEach(id=>$("#"+id)?.addEventListener("click",loadAdminData));
const originalShow=show;
show=function(view){
  if(view==="admin"&&!isOwner()){adminMessage("Owner authorization is required to open the Owner Control area.");return originalShow("overview");}
  document.body.classList.toggle("admin-mode", view==="admin");
  const title=$("#viewTitle");
  if(title) title.textContent=view==="admin"?"Owner Control":"";
  originalShow(view);
  if(view==="admin")loadAdminData();
};
const originalEnterApp=enterApp;
enterApp=function(name,email,role){
  originalEnterApp(name,email);
  const s=JSON.parse(localStorage.getItem("cc_session")||"{}");if(role)s.role=role;localStorage.setItem("cc_session",JSON.stringify(s));setOwnerNav();
};
setOwnerNav();
