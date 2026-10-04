const C=window.CAPITAL_CREW_CONFIG||{};
const sb=(C.SUPABASE_URL&&C.SUPABASE_ANON_KEY&&!C.SUPABASE_URL.includes('YOUR-PROJECT')&&!C.SUPABASE_ANON_KEY.includes('YOUR_PUBLIC')&&window.supabase)?window.supabase.createClient(C.SUPABASE_URL,C.SUPABASE_ANON_KEY):null;

const state={plan:'Starter',amount:150,fee:5,tx:[],contributed:0,balance:0,refReward:0};
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const PROFILE_KEY='cc_profile';
let selectedPaymentMethod='Payfast/Card';

function money(n){return 'R'+Number(n||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}
function toast(msg){const t=$('#toast');if(!t)return;t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
function initials(name){return (name||'Member').split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'M'}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))}
function getProfile(){return JSON.parse(localStorage.getItem(PROFILE_KEY)||'{}')}
function setAvatar(el,profile){if(!el)return;if(profile.photo)el.innerHTML=`<img src="${esc(profile.photo)}" alt="Profile picture">`;else el.textContent=initials(profile.name||'Member')}

async function ensureProfile(user){
  if(!sb||!user)return null;
  const {data,error}=await sb.from('profiles').select('*').eq('id',user.id).maybeSingle();
  if(error) throw error;
  if(data)return data;
  const profile={id:user.id,full_name:user.user_metadata?.full_name||user.email?.split('@')[0]||'Member',email:user.email||null,terms_version:null};
  const {data:created,error:createError}=await sb.from('profiles').insert(profile).select('*').single();
  if(createError) throw createError;
  return created;
}

async function loadMemberData(){
  if(!sb)return;
  const {data:{user}}=await sb.auth.getUser();
  if(!user)return;
  try{
    const profile=await ensureProfile(user);
    localStorage.setItem(PROFILE_KEY,JSON.stringify({name:profile.full_name||'',phone:profile.phone||'',email:profile.email||user.email||'',address:profile.address||'',photo:profile.profile_picture_url||''}));
    const [{data:wallet},{data:ledger}]=await Promise.all([
      sb.from('wallets').select('available_balance,pending_balance,currency').eq('user_id',user.id).maybeSingle(),
      sb.from('ledger_entries').select('type,amount,currency,status,external_reference,provider,description,created_at').eq('user_id',user.id).order('created_at',{ascending:false}).limit(100)
    ]);
    state.balance=Number(wallet?.available_balance||0);
    state.contributed=(ledger||[]).filter(x=>x.type==='contribution'&&x.status!=='reversed').reduce((s,x)=>s+Number(x.amount||0),0);
    state.refReward=(ledger||[]).filter(x=>x.type==='earning').reduce((s,x)=>s+Number(x.amount||0),0);
    state.tx=(ledger||[]).map(x=>({date:x.created_at?new Date(x.created_at).toLocaleDateString('en-ZA'):'—',ref:x.external_reference||'—',plan:x.description||x.type,amount:money(x.amount),status:(x.status||'pending').replace(/^./,c=>c.toUpperCase())}));
    if(!state.tx.length)state.tx=[{date:'—',ref:'No transactions yet',plan:'—',amount:'R0.00',status:'Pending'}];
    renderDashboard();renderTx();loadProfileUI();
  }catch(e){console.error(e);toast('Could not load your account data: '+e.message)}
}

function updateKycUI(statusOverride){
  const status=statusOverride||'unverified',verified=status==='verified',pending=status==='pending',rejected=status==='rejected';
  const gate=$('#depositGate');
  if(gate){gate.classList.toggle('hidden',verified);gate.classList.toggle('verified',verified);gate.querySelector('strong').textContent=verified?'Account verified — deposits enabled':'Verification required before depositing';gate.querySelector('p').textContent=verified?'Your identity verification has been approved. You can continue to secure payment.':'Complete account verification before you can create a contribution/payment session.'}
  ['kycStatus','kycInlineStatus'].forEach(id=>{const el=$('#'+id);if(!el)return;el.className='kyc-status '+(verified?'verified':pending?'pending':rejected?'rejected':'');el.textContent=verified?'● Verified':pending?'● Verification pending':rejected?'● Verification rejected':'● Verification required'});
  const submit=$('#submitKyc'),notice=$('#kycNotice'),doc=$('#kycDocument');
  if(submit){submit.disabled=verified||pending;submit.textContent=verified?'Account verified':pending?'Verification under review':'Submit verification for review'}
  if(notice)notice.textContent=verified?'Your account is verified and deposits are enabled.':pending?'Your verification is under review. Deposits remain disabled until approval.':rejected?'Your verification was rejected. Upload a corrected document and resubmit.':'Your account remains unable to deposit until verification is approved.';
  if(doc)doc.disabled=verified||pending;
}

async function loadProfileUI(){
  const u=getProfile();
  $('#profileDisplayName')?.replaceChildren(document.createTextNode(u.name||'Member Account'));
  setAvatar($('#profileAvatar'),u);setAvatar($('#topAvatar'),u);
  ['name','phone','email','address'].forEach(k=>{const el=$('#profile'+k[0].toUpperCase()+k.slice(1));if(el)el.value=u[k]||''});
  if(sb){const {data:{user}}=await sb.auth.getUser();if(user){const {data:p}=await sb.from('profiles').select('kyc_status').eq('id',user.id).maybeSingle();updateKycUI(p?.kyc_status||'unverified')}}
}

function show(view){$$('.view').forEach(v=>v.classList.remove('active'));const el=$('#'+view);if(el)el.classList.add('active');$$('.side-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));if($('#viewTitle'))$('#viewTitle').textContent=view==='overview'?'Overview':view[0].toUpperCase()+view.slice(1);$('#sidebar')?.classList.remove('open');window.scrollTo({top:0,behavior:'smooth'})}
$$('[data-view]').forEach(el=>el.addEventListener('click',e=>{e.preventDefault();show(el.dataset.view)}));
$('#hamb')?.addEventListener('click',()=>$('#sidebar')?.classList.toggle('open'));
$('#notif')?.addEventListener('click',()=>toast('You have no new notifications.'));

function renderCheckout(){$('#cPlan').textContent=state.plan;$('#cAmount').textContent=money(state.amount);$('#cFee').textContent=money(state.fee);$('#cTotal').textContent=money(state.amount+state.fee)+' ZAR';$('#payAmount').textContent=money(state.amount+state.fee)+' ZAR';const label=selectedPaymentMethod==='Payfast/Card'?'Card':selectedPaymentMethod;if($('#cMethod'))$('#cMethod').textContent=label;if($('#methodStatus'))$('#methodStatus').textContent='Selected: '+label;$$('.plan').forEach(x=>x.classList.toggle('selected-plan',x.dataset.plan===state.plan))}
function selectPlan(card,scroll=true){const p=card.closest('.plan')||card;state.plan=p.dataset.plan;state.amount=+p.dataset.amount;state.fee=+p.dataset.fee;renderCheckout();if(scroll)$('#checkoutCard')?.scrollIntoView({behavior:'smooth',block:'start'});toast(state.plan+' selected.')}
$$('.plan').forEach(card=>card.addEventListener('click',e=>selectPlan(card,!!e.target.closest('.choose'))));

function renderDashboard(){$('#balance').textContent=money(state.balance);$('#contributed').textContent=money(state.contributed);$('#activePlan').textContent=state.plan;$('#activePlanMeta').textContent=state.contributed?money(state.contributed)+' contributed':'No live contribution';$('#refReward').textContent=money(state.refReward);$('#refBig').textContent=money(state.refReward);const pct=Math.min(100,Math.round((state.contributed/1000)*100));$('#progressPct').textContent=pct+'%';if($('.ring'))$('.ring').style.background=`conic-gradient(#078640 ${pct*3.6}deg,#e7efe9 0deg)`;$('#progressTitle').textContent=state.contributed?"You're building momentum":'Build your first balance'}
function renderTx(){const q=($('#searchTx')?.value||'').toLowerCase(),f=$('#statusFilter')?.value||'All statuses';const rows=state.tx.filter(x=>(f==='All statuses'||x.status===f)&&Object.values(x).join(' ').toLowerCase().includes(q));if($('#txBody'))$('#txBody').innerHTML=rows.map(x=>`<tr><td>${esc(x.date)}</td><td>${esc(x.ref)}</td><td>${esc(x.plan)}</td><td>${esc(x.amount)}</td><td><span class="status-pill ${esc(x.status.toLowerCase())}">${esc(x.status)}</span></td></tr>`).join('');if($('#recentActivity'))$('#recentActivity').innerHTML=state.tx.slice(0,4).map(x=>`<div class="item"><div class="act-icon">↗</div><div><b>${x.plan==='—'?'No activity yet':esc(x.plan)}</b><small>${esc(x.date)} · ${esc(x.ref)}</small></div><span class="amount">${esc(x.amount)}</span></div>`).join('')}
$('#searchTx')?.addEventListener('input',renderTx);$('#statusFilter')?.addEventListener('change',renderTx);
$('#copyRef')?.addEventListener('click',async()=>{const link=location.origin+'/r/CAPITAL-KR72';try{await navigator.clipboard.writeText(link)}catch{}toast('Referral link copied.')});
$('#exportCsv')?.addEventListener('click',()=>{const rows=[['Date','Reference','Plan','Amount','Status'],...state.tx.map(x=>[x.date,x.ref,x.plan,x.amount,x.status])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download='capital-crew-transactions.csv';a.click();URL.revokeObjectURL(a.href)});

$('#checkoutForm')?.addEventListener('submit',async e=>{e.preventDefault();if(!sb){toast('Supabase is not configured.');return}const {data:{user}}=await sb.auth.getUser();if(!user){toast('Please sign in first.');return}const {data:p}=await sb.from('profiles').select('kyc_status').eq('id',user.id).maybeSingle();if(p?.kyc_status!=='verified'){toast('Verification is required before you can deposit. Please complete Profile & KYC.');show('profile');return}toast('Payment setup is ready, but payment confirmation must come from the authorised provider/server. No balance is credited by this browser.');});

const moneyOptions=[[60,10],[100,15],[250,30],[500,60],[750,90],[1000,120],[1500,180],[2000,240],[3000,360],[4000,480],[5000,600],[6000,720],[7500,900],[8000,960],[9000,1080],[10000,1200]];
function renderMoneyList(){const grid=$('#moneyGrid');if(!grid)return;grid.innerHTML=moneyOptions.map(([amount,daily])=>`<article class="money-card"><small>CONTRIBUTION</small><div class="contribution">${money(amount)}</div><div class="daily">${money(daily)} / day</div><small>Illustrative daily-share amount</small><button class="choose-money" data-money="${amount}">Choose ${money(amount)} →</button></article>`).join('');$$('.choose-money').forEach(btn=>btn.addEventListener('click',()=>{const amount=+btn.dataset.money;state.plan='Custom';state.amount=amount;state.fee=amount<1000?5:amount<5000?10:15;renderCheckout();show('invest');$('#checkoutCard')?.scrollIntoView({behavior:'smooth'});toast(`${money(amount)} option selected. Daily share shown is illustrative.`)}))}

async function enterApp(user){
  const profile=await ensureProfile(user);
  const name=profile?.full_name||user.user_metadata?.full_name||user.email?.split('@')[0]||'Member';
  $('#authShell').style.display='none';$('#appShell').style.display='flex';
  const first=name.split(' ')[0];if($('.welcome h1'))$('.welcome h1').innerHTML=`Good morning, <span>${esc(first)}.</span>`;
  await loadMemberData();
}

async function login(e){e.preventDefault();if(!sb){toast('Supabase is not configured.');return}const email=$('#loginEmail').value.trim(),password=$('#loginPassword').value;const {data,error}=await sb.auth.signInWithPassword({email,password});if(error){toast(error.message);return}await enterApp(data.user);toast('Signed in successfully.')}
async function register(e){e.preventDefault();if(!sb){toast('Supabase is not configured.');return}const name=$('#regName').value.trim(),email=$('#regEmail').value.trim(),password=$('#regPassword').value;if(password.length<6){toast('Password must be at least 6 characters.');return}const {data,error}=await sb.auth.signUp({email,password,options:{data:{full_name:name}}});if(error){toast(error.message);return}if(data.session){await enterApp(data.user);toast('Account created successfully.')}else{toast('Account created. Check your email to confirm the account, then sign in.');$('#registerCard').classList.add('hidden');$('#loginCard').classList.remove('hidden')}}
$('#registerForm')?.addEventListener('submit',register);$('#loginForm')?.addEventListener('submit',login);
$('#showRegister')?.addEventListener('click',()=>{$('#loginCard').classList.add('hidden');$('#registerCard').classList.remove('hidden')});$('#showLogin')?.addEventListener('click',()=>{$('#registerCard').classList.add('hidden');$('#loginCard').classList.remove('hidden')});
$('#logout')?.addEventListener('click',async()=>{if(sb)await sb.auth.signOut();$('#appShell').style.display='none';$('#authShell').style.display='flex';toast('Signed out.')});

const METHOD_NOTES={'Payfast/Card':'Card checkout is routed through the configured payment gateway.','Instant EFT':'Instant EFT requires an enabled provider/gateway account and server-side confirmation.','1Voucher':'1Voucher requires a merchant agreement and Flash API integration; do not collect voucher PINs into your own database.','OTT':'OTT integration depends on the selected OTT merchant/provider API and approval.','Wallet/Other':'Add additional authorised payment providers here.'};
function updateVoucherPanel(){const panel=$('#voucherPanel'),pin=$('#voucherPin'),label=$('#voucherLabel'),help=$('#voucherHelp'),buy1=$('#voucherBuyLink'),buyOtt=$('#ottBuyLink');const is1=selectedPaymentMethod==='1Voucher',isOtt=selectedPaymentMethod==='OTT';if(!panel)return;panel.classList.toggle('hidden',!(is1||isOtt));if(pin){pin.value='';pin.maxLength=is1?16:12;pin.pattern=is1?'[0-9]{16}':'[0-9]{12}';pin.placeholder=is1?'Enter 16-digit 1Voucher PIN':'Enter 12-digit OTT PIN';pin.required=is1||isOtt}if(label)label.firstChild.textContent=is1?'1Voucher PIN':isOtt?'OTT Voucher PIN':'Voucher PIN';if(help)help.textContent=is1?'1Voucher PINs must be sent only to the authorised provider; never store them in Capital Crew.':'OTT Voucher PINs must be sent only to the authorised provider; never store them in Capital Crew.';buy1?.classList.toggle('hidden',!is1);buyOtt?.classList.toggle('hidden',!isOtt)}
$$('.pay-option').forEach(btn=>btn.addEventListener('click',()=>{$$('.pay-option').forEach(x=>x.classList.remove('selected'));btn.classList.add('selected');selectedPaymentMethod=btn.dataset.method;if($('#methodNote'))$('#methodNote').textContent=METHOD_NOTES[selectedPaymentMethod];renderCheckout();updateVoucherPanel();toast((selectedPaymentMethod==='Payfast/Card'?'Card':selectedPaymentMethod)+' selected.') }));

$('#topAvatar')?.addEventListener('click',()=>{show('profile');$('#profileEdit')?.classList.remove('hidden')});$('#editProfileBtn')?.addEventListener('click',()=>{$('#profileEdit').classList.toggle('hidden');loadProfileUI()});
$('#saveProfile')?.addEventListener('click',async()=>{if(!sb){toast('Supabase is not configured.');return}const {data:{user}}=await sb.auth.getUser();if(!user){toast('Please sign in.');return}const payload={full_name:$('#profileName').value.trim(),phone:$('#profilePhone').value.trim(),email:$('#profileEmail').value.trim(),address:$('#profileAddress').value.trim(),updated_at:new Date().toISOString()};const {error}=await sb.from('profiles').update(payload).eq('id',user.id);if(error){toast(error.message);return}localStorage.setItem(PROFILE_KEY,JSON.stringify({...getProfile(),name:payload.full_name,phone:payload.phone,email:payload.email,address:payload.address}));await loadProfileUI();toast('Profile saved.');$('#profileEdit').classList.add('hidden')});
$('#profilePhoto')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(!file)return;if(file.size>2*1024*1024){toast('Profile picture must be 2 MB or smaller.');e.target.value='';return}if(!/^image\/(jpeg|png|webp)$/.test(file.type)){toast('Use JPG, PNG or WebP.');e.target.value='';return}const reader=new FileReader();reader.onload=()=>{const u=getProfile();u.photo=reader.result;localStorage.setItem(PROFILE_KEY,JSON.stringify(u));loadProfileUI();toast('Profile picture updated in this browser. For production, connect Supabase Storage.')};reader.readAsDataURL(file)});
$('#submitKyc')?.addEventListener('click',async()=>{if(!sb){toast('Supabase is not configured.');return}const file=$('#kycDocument')?.files?.[0];if(!file){toast('Choose an identity document first.');return}if(file.size>5*1024*1024){toast('Verification document must be 5 MB or smaller.');return}if(!['application/pdf','image/jpeg','image/png'].includes(file.type)){toast('Use PDF, JPG or PNG.');return}toast('KYC upload requires a private Supabase Storage bucket and server-side submission workflow. No identity document was stored in browser storage.')});
$('#acceptTerms')?.addEventListener('click',async()=>{if(!$('#termsAccept').checked){toast('Please tick the acceptance box first.');return}if(!sb){toast('Supabase is not configured.');return}const {data:{user}}=await sb.auth.getUser();if(!user){toast('Please sign in first.');return}const {error}=await sb.from('profiles').update({terms_version:C.TERMS_VERSION||'1.0',terms_accepted_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',user.id);if(error){toast(error.message);return}toast('Terms accepted and saved to your account.')});

renderCheckout();renderMoneyList();updateVoucherPanel();
(async()=>{if(!sb){toast('Supabase configuration is missing.');return}const {data:{session}}=await sb.auth.getSession();if(session)await enterApp(session.user)})();
