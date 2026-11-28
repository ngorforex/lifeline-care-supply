const body=document.body;
const title=document.getElementById("page-title");
const crumb=document.getElementById("crumb");
const isAdmin=body.dataset.portal==="admin";
const titles={overview:isAdmin?"Administrator overview":"Dashboard",investments:"My Investments",packages:"Investment Plans",wallet:"Wallet",earnings:"Earnings",transactions:"History",referrals:"Referral",profile:"Profile",investors:"Individual investors",deposits:"Deposit management",withdrawals:"Withdrawal management",reports:"Reports",staff:"Staff & permissions",audit:"Audit log","all-deposits":"All deposits","successful-deposits":"Successful deposits","all-withdrawals":"All withdrawals","successful-withdrawals":"Successful withdrawals","active-customers":"Active customers"};
function activateTab(tab){
 const panel=document.getElementById("panel-"+tab);if(!panel)return;
 document.querySelectorAll(".tab-panel").forEach(item=>item.classList.remove("active"));
 panel.classList.add("active");
 document.querySelectorAll("a[data-tab]").forEach(item=>item.classList.toggle("active",item.dataset.tab===tab));
 if(title)title.textContent=titles[tab]||"Workspace";
 if(crumb)crumb.textContent=titles[tab]||"Workspace";
}
document.querySelectorAll("[data-tab]").forEach(link=>link.addEventListener("click",event=>{
 const tab=link.dataset.tab;if(!document.getElementById("panel-"+tab))return;
 event.preventDefault();activateTab(tab);history.replaceState(null,"","#"+tab);
}));
const initialTab=location.hash.slice(1);if(initialTab&&document.getElementById("panel-"+initialTab))activateTab(initialTab);
document.querySelectorAll(".year").forEach(item=>item.textContent=String(new Date().getFullYear()));
function setText(selector,value){document.querySelectorAll(selector).forEach(el=>{el.textContent=value??"—";});}
function statusKey(value){
 const raw=String(value??"").trim().toLowerCase().replace(/[\\s-]+/g,"_");
 const aliases={success:"success",successful:"success",complete:"success",completed:"success",paid:"success",settled:"success",active:"active",approved:"success",pending:"pending",processing:"processing",queued:"processing",initiated:"processing",awaiting_payment:"pending",awaiting_confirmation:"pending",failed:"failed",failure:"failed",rejected:"rejected",cancelled:"cancelled",canceled:"cancelled",expired:"expired",inactive:"inactive",suspended:"inactive",blocked:"blocked",refunded:"refunded",reversed:"refunded"};
 return aliases[raw]||"neutral";
}
function statusLabel(value){
 const key=statusKey(value);if(key==="neutral")return String(value??"—").replaceAll("_"," ").replace(/\\b\\w/g,ch=>ch.toUpperCase());
 const labels={success:"Successful",active:"Active",pending:"Pending",processing:"Processing",failed:"Failed",rejected:"Rejected",cancelled:"Cancelled",expired:"Expired",inactive:"Inactive",blocked:"Blocked",refunded:"Refunded"};
 return labels[key]||String(value);
}
function statusBadge(value){
 const badge=document.createElement("span");badge.className="status-badge status-"+statusKey(value);badge.textContent=statusLabel(value);return badge;
}
function cell(row,value){
 const td=document.createElement("td");
 if(statusKey(value)!=="neutral")td.append(statusBadge(value));
 else td.textContent=value??"—";
 row.append(td);
}
function dateEAT(value){
 if(!value)return "—";
 const date=new Date(value);if(Number.isNaN(date.getTime()))return "—";
 return new Intl.DateTimeFormat("en-UG",{timeZone:"Africa/Kampala",year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(date);
}
function amountMinor(value,currency){const code=currency||"UGX";const n=Number(value);const scale=code==="UGX"?1:100;return Number.isFinite(n)?new Intl.NumberFormat("en-UG",{style:"currency",currency:code,maximumFractionDigits:code==="UGX"?0:2}).format(n/scale):"—";}
function fillTable(selector,items,columns,emptyText){
 const target=document.querySelector(selector);if(!target)return;
 target.replaceChildren();
 if(!items?.length){const row=document.createElement("tr");const td=document.createElement("td");td.colSpan=columns.length;td.className="empty-cell";td.textContent=emptyText;row.append(td);target.append(row);return;}
 for(const item of items){const row=document.createElement("tr");for(const col of columns)cell(row,col(item));target.append(row);}
}
function renderDashboard(data){
 const profile=data.profile||{};const metrics=data.metrics||{};
 document.querySelectorAll("[data-metric]").forEach(el=>{el.textContent=String(metrics[el.dataset.metric]??0);});
 const status=profile.status||"unknown";
 setText("[data-account-status]",status.toUpperCase());setText("[data-profile-status]",status.toUpperCase());
 const name=profile.displayName||"Investor";
 if(title&&(!location.hash||location.hash==="#overview"))title.textContent="Dashboard";
 if(crumb&&(!location.hash||location.hash==="#overview"))crumb.textContent="Dashboard";
 const avatar=document.querySelector("[data-top-profile-avatar]");if(avatar&&!avatar.classList.contains("has-photo"))avatar.textContent=name.slice(0,1).toUpperCase();
 setText("[data-profile-name]",name);setText("[data-profile-phone]",profile.phone||"—");
 setText("[data-profile-created]",dateEAT(profile.createdAt));
 
 const initial=document.querySelector("[data-profile-initial]");if(initial)initial.textContent=name.slice(0,1).toUpperCase();
 const investments=data.investments||[];
 const active=investments.filter(item=>item.status==="active");
 const totalInvested=investments.filter(item=>!["cancelled","rejected"].includes(item.status)).reduce((sum,item)=>sum+(Number.parseFloat(String(item.principal_amount).replace(/[^0-9.]/g,""))||0),0);
 const currency=investments[0]?.currency||"UGX";
 const formatMajor=value=>new Intl.NumberFormat("en-UG",{style:"currency",currency,maximumFractionDigits:0}).format(value);
 setText('[data-metric="totalInvested"]',formatMajor(totalInvested));
 setText('[data-metric="totalEarnings"]',amountMinor(metrics.totalEarningsMinor||0,"UGX"));
 setText('[data-referral-rewards]',amountMinor(metrics.referralEarningsMinor||0,"UGX"));
 setText("[data-total-earnings]",amountMinor(metrics.totalEarningsMinor||0,"UGX"));
 setText("[data-next-earnings]",amountMinor(metrics.nextEarningsMinor||0,"UGX"));
 const walletCurrency=metrics.walletCurrency||"UGX";
 const walletBalance=amountMinor(metrics.walletBalanceMinor||0,walletCurrency);
 setText('[data-metric="availableBalance"]',walletBalance);
 setText("[data-home-wallet-balance]",walletBalance);
 setText("[data-wallet-balance]",walletBalance);
 setText("[data-home-today-earnings]",amountMinor(metrics.todayEarningsMinor||0,"UGX"));
 setText('[data-metric="portfolioValue"]',"Not available");
 setText("[data-portfolio-note]","Portfolio valuation will appear when ledger reporting is configured.");
 const activeTarget=document.querySelector("[data-active-investments]");
 if(activeTarget){
  activeTarget.replaceChildren();
  if(!active.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="You do not have any active investments yet.";activeTarget.append(empty);}
  else for(const item of active){
   const card=document.createElement("article");card.className="investment-card";
   const head=document.createElement("div");head.style.display="flex";head.style.justifyContent="space-between";head.style.alignItems="center";head.style.gap="10px";
   const h=document.createElement("h4");h.textContent=item.package_name||"Investment package";
   const status=document.createElement("span");status.className="status-chip";status.textContent=item.status;
   head.append(h,status);
   const p=document.createElement("p");p.textContent="Principal: "+(item.principal_amount||"—")+" "+(item.currency||"");
   const meta=document.createElement("div");meta.className="investment-meta";
   const started=document.createElement("span");started.textContent="Started: "+dateEAT(item.started_at);
   const matures=document.createElement("span");matures.textContent="Matures: "+dateEAT(item.matures_at);
   meta.append(started,matures);card.append(head,p,meta);activeTarget.append(card);
  }
 }

 fillTable("[data-investments]",data.investments||[],[x=>x.reference,x=>x.package_name||"—",x=>String(x.principal_amount||"—")+" "+(x.currency||""),x=>x.status,x=>dateEAT(x.started_at)],"No investment records yet.");
 fillTable("[data-wallet-activity]",data.transactions||[],[x=>x.reference,x=>x.type,x=>amountMinor(x.amountMinor,x.currency),x=>x.status,x=>dateEAT(x.createdAt)],"No wallet transactions have been recorded yet.");
 fillTable("[data-transactions]",data.transactions||[],[x=>x.reference,x=>x.type,x=>dateEAT(x.createdAt),x=>amountMinor(x.amountMinor,x.currency),x=>x.status],"No transactions have been recorded.");
 fillTable("[data-referrals]",data.referrals||[],[x=>x.phone_e164,x=>dateEAT(x.registered_at),x=>x.status],"No referrals are linked to this account.");
 fillTable("[data-earnings]",data.earnings||[],[x=>x.earning_date,x=>String(x.investment_id||"").slice(0,8),x=>amountMinor(x.amount_minor,"UGX")],"No daily earnings have been posted yet.");
 fillTable("[data-referral-commissions]",data.referralCommissions||[],[x=>"Level "+x.level,x=>amountMinor(x.amount_minor,"UGX"),x=>dateEAT(x.created_at)],"No referral commissions have been posted yet.");
 const link=document.querySelector("[data-referral-link]");const refStatus=document.querySelector("[data-referral-status]");
 const copyButton=document.querySelector("[data-copy-referral]");
 const inviteUrl=data.referralCode?.code&&data.referralCode.is_active?new URL("/register/?ref="+encodeURIComponent(data.referralCode.code),location.origin).href:"";
 if(inviteUrl){
  if(link){link.href=inviteUrl;link.textContent=inviteUrl;}
  if(refStatus)refStatus.textContent="Your invite link is active";
  if(copyButton){copyButton.disabled=false;copyButton.dataset.url=inviteUrl;}
 }else{
  if(link){link.removeAttribute("href");link.textContent="Your personal invite link is not available yet";}
  if(refStatus)refStatus.textContent="Invite link not issued";
  if(copyButton)copyButton.disabled=true;
 }
 const packages=document.querySelector("[data-packages]");
 const productImageByCode={
  THERMOMETER:"/product-01.jpg","BP-MONITOR":"/product-02.jpg","PULSE-OXIMETER":"/product-03.jpg",
  NEBULIZER:"/product-04.jpg",GLUCOMETER:"/product-05.jpg","ECG-MACHINE":"/product-06.jpg",
  "PATIENT-MONITOR":"/product-07.jpg",MICROSCOPE:"/product-08.jpg",
  "OXYGEN-CONCENTRATOR":"/product-09.jpg","ULTRASOUND-SCANNER":"/product-10.jpg"
 };
 const productNameByCode={
  THERMOMETER:"Digital Thermometer","BP-MONITOR":"Blood Pressure Monitor",
  "PULSE-OXIMETER":"Pulse Oximeter",NEBULIZER:"Nebulizer",GLUCOMETER:"Glucometer",
  "ECG-MACHINE":"ECG Machine","PATIENT-MONITOR":"Patient Monitor",MICROSCOPE:"Microscope",
  "OXYGEN-CONCENTRATOR":"Oxygen Concentrator","ULTRASOUND-SCANNER":"Ultrasound Scanner"
 };
 const approvedProductCodes=new Set(Object.keys(productNameByCode));
 if(packages){
  packages.replaceChildren();
  // Only show the ten original, image-matched catalogue records. Ignore any legacy/appended rows.
  const items=(Array.isArray(data.packages)?data.packages:[]).filter(p=>approvedProductCodes.has(p.code));
  if(!items.length){
   const empty=document.createElement("div");empty.className="empty-state";
   const symbol=document.createElement("span");symbol.className="empty-symbol";symbol.textContent="◇";
   const heading=document.createElement("b");heading.textContent="Investment packages are being prepared";
   const message=document.createElement("p");message.textContent="No packages are currently available. Please check again later.";
   empty.append(symbol,heading,message);packages.append(empty);
  }
  for(const p of items){
   let terms={};try{terms=JSON.parse(p.return_structure||"{}");}catch{}
   const price=Number(p.investment_amount);
   const daily=Number(terms.daily_income_ugx||0);
   const total=Number(terms.total_return_ugx||0);
   const card=document.createElement("article");card.className="package-card panel";
   const image=document.createElement("img");image.className="package-image";image.src=productImageByCode[p.code]||"/product-01.jpg";image.alt=productNameByCode[p.code];image.loading="lazy";image.decoding="async";
   const body=document.createElement("div");body.className="package-card-body";
   const heading=document.createElement("h3");heading.textContent=productNameByCode[p.code];
   const status=document.createElement("span");status.className="package-status";status.textContent="Available";
   const details=document.createElement("div");details.className="package-details";
   const fields=[["Investment amount",price],["Duration",Number(p.duration_days||0)+" days"],["Daily income",daily],["Total projected return",total]];
   for(const [label,value] of fields){const item=document.createElement("div");item.className="package-detail";const caption=document.createElement("span");caption.textContent=label;const amount=document.createElement("b");amount.textContent=typeof value==="number"?new Intl.NumberFormat("en-UG").format(value)+" UGX":value;item.append(caption,amount);details.append(item);}
   body.append(heading,status,details);
   const buy=document.createElement("button");buy.type="button";buy.className="primary-button package-invest-button";buy.textContent="Invest now";
   buy.addEventListener("click",()=>openPackagePurchase(p));body.append(buy);
   card.append(image,body);packages.append(card);
  }
 }
 const purchaseDialog=document.createElement("dialog");purchaseDialog.className="payment-dialog";
 purchaseDialog.innerHTML='<form method="dialog" class="payment-dialog-form"><button class="dialog-close" type="button" aria-label="Close dialog">×</button><span class="kicker">INVESTMENT CONFIRMATION</span><h2 data-package-title>Investment package</h2><div data-package-terms></div><button class="primary-button" type="submit" data-package-submit>Confirm investment</button><p class="payment-result" role="status" data-package-result></p></form>';
 document.body.append(purchaseDialog);
 purchaseDialog.querySelector(".dialog-close").addEventListener("click",()=>{if(purchaseDialog.open)purchaseDialog.close("cancel");selectedPackage=null;});
 purchaseDialog.addEventListener("click",event=>{if(event.target===purchaseDialog){purchaseDialog.close("cancel");selectedPackage=null;}});
 purchaseDialog.addEventListener("cancel",()=>{selectedPackage=null;});
 const purchaseForm=purchaseDialog.querySelector("form");
 let selectedPackage=null;
 function openPackagePurchase(pkg){
  selectedPackage=pkg;
  purchaseDialog.querySelector("[data-package-title]").textContent=pkg.name||"Investment package";
  let terms={};try{terms=JSON.parse(pkg.return_structure||"{}");}catch{}
  const host=purchaseDialog.querySelector("[data-package-terms]");host.replaceChildren();
  const rows=[["Investment amount",Number(pkg.investment_amount)],["Duration",Number(pkg.duration_days)+" days"],["Daily income",Number(terms.daily_income_ugx||0)],["Total projected return",Number(terms.total_return_ugx||0)]];
  for(const [label,value] of rows){const line=document.createElement("p");line.textContent=label+": "+(typeof value==="number"?new Intl.NumberFormat("en-UG").format(value)+" UGX":value);host.append(line);}
  purchaseDialog.querySelector("[data-package-result]").textContent="";
  const submit=purchaseDialog.querySelector("[data-package-submit]");submit.disabled=false;submit.textContent="Confirm investment";
  purchaseDialog.showModal();
 }
 purchaseForm.addEventListener("submit",async event=>{
  event.preventDefault();if(!selectedPackage)return;
  const submit=purchaseDialog.querySelector("[data-package-submit]"),result=purchaseDialog.querySelector("[data-package-result]");
  submit.disabled=true;submit.textContent="Processing…";result.textContent="";
  try{
   const response=await fetch("/api/investor/investments",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({packageId:selectedPackage.id,termsVersion:selectedPackage.terms_version,acceptTerms:true})});
   const data=await response.json().catch(()=>({error:"The server returned an invalid response."}));
   if(!response.ok)throw new Error(data.error||"Investment could not be completed.");
   result.textContent="Investment successful. Reference: "+data.reference;
   submit.textContent="Investment completed";
   setTimeout(()=>location.reload(),1400);
  }catch(error){result.textContent=error.message||"Investment could not be completed.";submit.disabled=false;submit.textContent="Confirm investment";}
 });
 const recent=document.querySelector("[data-recent-activity]");
 if(recent){recent.replaceChildren();const span=document.createElement("span");span.textContent="⌁";const b=document.createElement("b");b.textContent=data.investments?.length?data.investments.length+" investment record(s)":"No investment activity yet";const small=document.createElement("small");small.textContent="Account records are up to date";recent.append(span,b,small);}
 const recentTx=document.querySelector("[data-recent-transactions]");
 if(recentTx){
  recentTx.replaceChildren();
  const recentItems=(data.transactions||[]).slice(0,5);
  if(!recentItems.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="No transaction activity has been recorded yet.";recentTx.append(empty);}
  else for(const item of recentItems){
   const row=document.createElement("div");row.className="recent-transaction";
   const info=document.createElement("div");const label=document.createElement("b");label.textContent=item.type||"Transaction";const status=statusBadge(item.status||"pending");status.classList.add("recent-status-badge");
   const date=document.createElement("small");date.textContent=dateEAT(item.createdAt);info.append(label,status,date);
   const amount=document.createElement("strong");amount.textContent=amountMinor(item.amountMinor,item.currency);row.append(info,amount);recentTx.append(row);
  }
 }
}
if(isAdmin){
 const adminError=message=>{
  const content=document.querySelector(".content");if(!content)return;
  let note=document.querySelector("[data-admin-error]");
  if(!note){note=document.createElement("div");note.className="notice";note.dataset.adminError="true";content.prepend(note);}
  note.textContent=message;
 };
 const adminDate=value=>dateEAT(value);
 const adminMoney=(value,currency="UGX")=>amountMinor(value,currency);
 const columns={
  investors:[["PHONE",x=>x.phone_e164],["INVESTOR",x=>[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")],["STATUS",x=>x.status],["REGISTERED (EAT)",x=>adminDate(x.created_at)]],
  packages:[["CODE",x=>x.code],["PACKAGE",x=>x.name],["PRICE",x=>adminMoney(Number(x.investment_amount),x.currency)],["DURATION",x=>String(x.duration_days||"—")+" days"],["STATUS",x=>x.status]],
  investments:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["PACKAGE",x=>x.package_name],["PRINCIPAL",x=>adminMoney(Number(x.principal_amount),x.currency)],["STATUS",x=>x.status],["STARTED (EAT)",x=>adminDate(x.started_at)]],
  deposits:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["AMOUNT",x=>adminMoney(x.amount_minor,x.currency)],["PROVIDER",x=>x.payment_method],["PROVIDER REF",x=>x.provider_reference],["STATUS",x=>x.status],["CREATED (EAT)",x=>adminDate(x.created_at)]],
  all_deposits:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["AMOUNT",x=>adminMoney(x.amount_minor,x.currency)],["PROVIDER REF",x=>x.provider_reference],["STATUS",x=>x.status],["CREATED (EAT)",x=>adminDate(x.created_at)]],
  successful_deposits:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["AMOUNT",x=>adminMoney(x.amount_minor,x.currency)],["PROVIDER REF",x=>x.provider_reference],["STATUS",x=>x.status],["COMPLETED (EAT)",x=>adminDate(x.updated_at)]],
  active_customers:[["PHONE",x=>x.phone_e164],["INVESTOR",x=>[x.first_name,x.middle_name,x.last_name].filter(Boolean).join(" ")],["STATUS",x=>x.status],["REGISTERED (EAT)",x=>adminDate(x.created_at)]],
  withdrawals:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["GROSS",x=>adminMoney(x.amount_minor,x.currency)],["TAX",x=>adminMoney(x.tax_amount_minor||0,x.currency)],["NET PAYOUT",x=>adminMoney(x.payout_amount_minor??x.amount_minor,x.currency)],["PAYOUT TO",x=>x.payout_phone_e164],["STATUS",x=>x.status],["CREATED (EAT)",x=>adminDate(x.created_at)]],
  all_withdrawals:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["AMOUNT",x=>adminMoney(x.amount_minor,x.currency)],["PAYOUT TO",x=>x.payout_phone_e164],["STATUS",x=>x.status],["CREATED (EAT)",x=>adminDate(x.created_at)]],
  successful_withdrawals:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["AMOUNT",x=>adminMoney(x.amount_minor,x.currency)],["PAYOUT TO",x=>x.payout_phone_e164],["STATUS",x=>x.status],["COMPLETED (EAT)",x=>adminDate(x.updated_at)]],
  referrals:[["REFERRER",x=>x.referrer_phone],["REFERRED INVESTOR",x=>x.referred_phone],["REGISTERED (EAT)",x=>adminDate(x.registered_at)],["STATUS",x=>x.status],["QUALIFIED (EAT)",x=>adminDate(x.qualified_at)]],
  audit:[["TIME (EAT)",x=>adminDate(x.created_at)],["ACTOR",x=>x.admin_email||x.investor_phone],["ACTION",x=>x.action],["RECORD",x=>(x.entity_type||"")+" / "+(x.entity_id||"")],["DETAILS",x=>x.reason||x.metadata]]
 };
 const renderAdminTable=(tab,records)=>{
  const panel=document.getElementById("panel-"+tab);if(!panel)return;
  let table=panel.querySelector("table");
  if(!table){
   const host=panel.querySelector(".panel")||panel;
   const scroll=document.createElement("div");scroll.className="table-scroll";
   table=document.createElement("table");scroll.append(table);host.append(scroll);
  }
  let thead=table.querySelector("thead");if(!thead){thead=document.createElement("thead");table.append(thead);}
  let tbody=table.querySelector("tbody");if(!tbody){tbody=document.createElement("tbody");table.append(tbody);}
  const columnKey=tab.replaceAll("-","_");
  const defs=columns[tab]||columns[columnKey]||[];
  const hasActions=["withdrawals","all_withdrawals","packages"].includes(columnKey);const headRow=document.createElement("tr");defs.forEach(([label])=>{const th=document.createElement("th");th.textContent=label;headRow.append(th);});if(hasActions){const th=document.createElement("th");th.textContent="ACTIONS";headRow.append(th);}thead.replaceChildren(headRow);
  tbody.replaceChildren();
  if(!records?.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=(defs.length||1)+(hasActions?1:0);td.className="empty-cell";td.textContent="No records found.";tr.append(td);tbody.append(tr);return;}
  for(const item of records){
   const tr=document.createElement("tr");
   for(const [label,get] of defs){const td=document.createElement("td");const value=get(item);if(label==="STATUS")td.append(statusBadge(value));else td.textContent=String(value??"—");tr.append(td);}
   if(hasActions){
    const td=document.createElement("td");
    const addAction=(label,url)=>{const b=document.createElement("button");b.type="button";b.className="admin-row-action";b.textContent=label;b.addEventListener("click",async()=>{b.disabled=true;try{const response=await fetch(url,{method:"POST",credentials:"same-origin",headers:{"Accept":"application/json"}});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Action failed.");loadAdminSection(location.hash.slice(1)||"overview");}catch(error){adminError(error.message);}finally{b.disabled=false;}});td.append(b);};
    if((columnKey==="withdrawals"||columnKey==="all_withdrawals")&&item.status==="pending"){
      const paused=document.createElement("span");paused.className="admin-status-note";paused.textContent="Payout processing paused";td.append(paused);
      addAction("Reject","/api/admin/withdrawals/"+encodeURIComponent(item.id)+"/reject");
    }
    
    tr.append(td);
   }
   tbody.append(tr);
  }
 };
 const loadAdminSection=async tab=>{
  const section=tab==="overview"?"overview":tab==="packages"?"packages":tab==="investors"?"investors":tab==="investments"?"investments":tab==="deposits"?"deposits":tab==="withdrawals"?"withdrawals":tab==="all-deposits"?"all_deposits":tab==="successful-deposits"?"successful_deposits":tab==="all-withdrawals"?"all_withdrawals":tab==="successful-withdrawals"?"successful_withdrawals":tab==="active-customers"?"active_customers":tab==="referrals"?"referrals":tab==="audit"?"audit":null;
  if(!section)return;
  try{
   const response=await fetch("/api/admin/data?section="+encodeURIComponent(section),{credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}});
   const data=await response.json().catch(()=>({}));
   if(response.status===401){location.replace("/admin/login/");return;}
   if(!response.ok)throw new Error(data.error||"Administrator data could not be loaded.");
   document.querySelector("[data-admin-error]")?.remove();
   if(section==="overview"){
    const m=data.metrics||{};
    const values={
     totalInvestors:String(m.totalInvestors??0),
     successfulDeposits:adminMoney(m.successfulDepositsMinor??0,"UGX"),
     successfulWithdrawals:adminMoney(m.successfulWithdrawalsMinor??0,"UGX"),
      netDeposits:adminMoney((Number(m.successfulDepositsMinor)||0)-(Number(m.successfulWithdrawalsMinor)||0),"UGX"),
      nextMidnightEarnings:adminMoney(m.nextMidnightEarningsMinor??0,"UGX"),
     activeInvestments:String(m.activeInvestments??0),
     todayDeposits:adminMoney(m.todayDepositsMinor??0,"UGX"),
     todayWithdrawals:adminMoney(m.todayWithdrawalsMinor??0,"UGX"),
     pendingDeposits:String(m.pendingDeposits??0),
     pendingWithdrawals:String(m.pendingWithdrawals??0),
     referrals:String(m.referrals??0)
    };
    document.querySelectorAll("[data-overview-metric]").forEach(el=>{
     const value=values[el.dataset.overviewMetric];if(value!==undefined)el.textContent=value;
    });
    const pill=document.querySelector(".subtle-tag");if(pill)pill.textContent="Live database data";
   }else renderAdminTable(section,data.records||[]);
  }catch(error){console.error("Administrator data load failed:",error);adminError(error.message||"Administrator data could not be loaded.");}
 };
 fetch("/api/admin/auth/me",{credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}})
  .then(response=>{if(response.status===401){location.replace("/admin/login/");return null;}if(!response.ok)throw new Error("Administrator session check failed.");return response.json();})
  .then(data=>{
   if(!data?.authenticated)return;
   const badge=document.querySelector(".preview-pill");if(badge)badge.textContent=data.admin.role.replaceAll("_"," ").toUpperCase();
   const notice=document.querySelector(".content > .notice");if(notice)notice.remove();
   const overview=document.getElementById("panel-overview");
   if(overview&&!overview.querySelector("[data-obpay-tools]")){
    const tools=document.createElement("div");tools.dataset.obpayTools="true";tools.style.display="flex";tools.style.flexWrap="wrap";tools.style.gap="8px";tools.style.margin="0 0 16px";
    const check=document.createElement("button");check.type="button";check.className="admin-row-action";check.textContent="Check ObPay & reconcile payments";
    check.addEventListener("click",async()=>{check.disabled=true;check.textContent="Checking…";try{
      const statusResponse=await fetch("/api/admin/obpay/status",{credentials:"same-origin",cache:"no-store"});const status=await statusResponse.json().catch(()=>({}));
      if(!statusResponse.ok)throw new Error(status.error||"ObPay check failed.");
      const reconcileResponse=await fetch("/api/admin/obpay/reconcile",{method:"POST",credentials:"same-origin"});const reconcile=await reconcileResponse.json().catch(()=>({}));
      if(!reconcileResponse.ok)throw new Error(reconcile.error||"Reconciliation failed.");
      const panel=overview.querySelector("[data-obpay-status]")||document.createElement("section");
      panel.dataset.obpayStatus="true";
      panel.style.cssText="margin:0 0 18px;padding:16px;border:1px solid #cfe5dc;border-radius:16px;background:#f5fbf8;color:#24483e;line-height:1.6;overflow-wrap:anywhere";
      const enabledMethods=Array.isArray(status.payoutMethods)?status.payoutMethods.filter(item=>item.enabled).map(item=>item.name||item.code).filter(Boolean):[];
      const missing=Array.isArray(status.missingWebhookEvents)?status.missingWebhookEvents:[];
      const readiness=status.payoutReadiness||"blocked";
      const readyLabel=readiness==="configured"?"PAYOUTS CONFIGURED":readiness==="funding_required"?"CONFIGURED — FUND WALLET":readiness==="funding_unverified"?"CONFIGURED — BALANCE UNVERIFIED":"PAYOUT CONFIGURATION BLOCKED";
      const escapeHtml=value=>String(value??"").replace(/[&<>"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[char]));
      const row=(label,value)=>"<div style='display:flex;justify-content:space-between;gap:14px;padding:7px 0;border-bottom:1px solid #e0eee8'><span style='color:#61766e'>"+escapeHtml(label)+"</span><strong style='text-align:right'>"+escapeHtml(value)+"</strong></div>";
      panel.innerHTML="<div style='display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px'><strong style='font-size:17px'>ObPay integration diagnostics</strong><strong style='color:"+(readiness?"#16734d":"#a45b12")+"'>"+readyLabel+"</strong></div>"+row("Provider connection",status.authenticated?"Connected":"Not connected")+row("Webhook endpoint",status.webhookRegistered?"Registered":"Not registered")+row("Payout webhook events",status.payoutWebhookEventsReady?"Both success and failure events detected":"Missing: "+(missing.join(", ")||"event list not confirmed"))+row("Merchant pays payout fees",status.merchantPaidFeesConfigured?"Confirmed — account fee mode":"Not confirmed")+row("Enabled Uganda payout networks",enabledMethods.join(", ")||"None confirmed")+row("Payout methods check",status.payoutMethodsReady?"Passed":"Not passed")+row("UGX provider balance",status.balance&&status.balance.available!==null?"UGX "+Number(status.balance.available).toLocaleString("en-UG"):"Unavailable")+row("Payout funding status",status.fundingStatus==="empty"?"Wallet empty — fund ObPay before payouts":status.fundingStatus==="funds_present"?"Funds present — amount-specific fee coverage still applies":"Balance could not be verified")+row("Deposits reconciled",String(reconcile.completedDeposits||0))+row("Withdrawals reconciled",String(reconcile.completedWithdrawals||0))+"<div style='font-size:12px;color:#61766e;margin-top:10px'>Webhook: "+escapeHtml(status.webhookUrl)+"</div>";
      if(!panel.isConnected)tools.after(panel);
    }catch(error){adminError(error.message||"ObPay check failed.");}finally{check.disabled=false;check.textContent="Check ObPay & reconcile payments";}});
    const runEarnings=document.createElement("button");runEarnings.type="button";runEarnings.className="admin-row-action";runEarnings.textContent="Post today's daily earnings";
    runEarnings.addEventListener("click",async()=>{runEarnings.disabled=true;try{const response=await fetch("/api/admin/earnings/run",{method:"POST",credentials:"same-origin"});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Earnings posting failed.");adminError("Daily earnings run completed for "+result.earningDate+" (EAT). New credits posted: "+(result.posted||0)+".");loadAdminSection("overview");}catch(error){adminError(error.message);}finally{runEarnings.disabled=false;}});
    tools.append(check,runEarnings);overview.prepend(tools);
   }
   const initial=location.hash.slice(1);loadAdminSection(initial&&document.getElementById("panel-"+initial)?initial:"overview");
   document.querySelectorAll("[data-tab]").forEach(link=>link.addEventListener("click",()=>loadAdminSection(link.dataset.tab)));
  })
  .catch(error=>{console.error(error);location.replace("/admin/login/");});
}
if(!isAdmin){

 const dailyCheckInDialog=document.createElement("dialog");
 dailyCheckInDialog.className="payment-dialog";
 dailyCheckInDialog.innerHTML='<form method="dialog" class="payment-dialog-form"><button class="dialog-close" type="button" aria-label="Close check-in">×</button><span class="kicker">LIFELINE CARE SUPPLY</span><h2>Daily check-in reward</h2><p>Claim your daily reward for today. You can claim once per East African calendar day.</p><div class="checkin-reward-card"><span class="checkin-reward-label">TODAY’S REWARD</span><strong data-checkin-amount>UGX 200</strong><span class="checkin-reward-caption">Added directly to your wallet after claiming</span></div><button class="primary-button" type="button" data-checkin-claim>Claim UGX 200</button><p class="payment-result" role="status" data-checkin-result></p></form>';
 document.body.append(dailyCheckInDialog);
 dailyCheckInDialog.querySelector(".dialog-close").addEventListener("click",()=>dailyCheckInDialog.close("cancel"));
 dailyCheckInDialog.querySelector("form").addEventListener("submit",event=>event.preventDefault());
 const showDailyCheckInPrompt=async()=>{
  try{
   const response=await fetch("/api/investor/daily-checkin",{credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}});
   const data=await response.json().catch(()=>({}));
   if(response.status===401){location.replace("/login/");return;}
   if(!response.ok||data.available!==true)return;
   dailyCheckInDialog.querySelector("[data-checkin-amount]").textContent=amountMinor(data.amountUGX,"UGX");
   const claim=dailyCheckInDialog.querySelector("[data-checkin-claim]");
   const result=dailyCheckInDialog.querySelector("[data-checkin-result]");
   claim.disabled=false;claim.textContent="Claim "+amountMinor(data.amountUGX,"UGX");result.textContent="";
   dailyCheckInDialog.showModal();
  }catch(error){console.warn("Daily check-in availability could not be loaded:",error);}
 };
 dailyCheckInDialog.querySelector("[data-checkin-claim]").addEventListener("click",async event=>{
  const button=event.currentTarget,result=dailyCheckInDialog.querySelector("[data-checkin-result]");
  button.disabled=true;button.textContent="Claiming…";result.textContent="";
  try{
   const response=await fetch("/api/investor/daily-checkin",{method:"POST",credentials:"same-origin",headers:{"Accept":"application/json","Content-Type":"application/json"},body:"{}"});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Daily reward could not be claimed.");
   if(data.alreadyClaimed){result.textContent="You have already claimed today's reward.";button.textContent="Already claimed";return;}
   result.textContent="Success! "+amountMinor(data.amountUGX,"UGX")+" has been added to your wallet.";
   button.textContent="Reward claimed";
   setTimeout(()=>location.reload(),1300);
  }catch(error){result.textContent=error.message||"Daily reward could not be claimed.";button.disabled=false;button.textContent="Try again";}
 });

 const paymentDialog=document.createElement("dialog");
 paymentDialog.className="payment-dialog";
 paymentDialog.innerHTML='<form method="dialog" class="payment-dialog-form"><button class="dialog-close" value="cancel" aria-label="Close">×</button><span class="kicker">LIFELINE CARE SUPPLY</span><h2 data-payment-title>Deposit</h2><p data-payment-description>Pay securely using MTN or Airtel Mobile Money.</p><label for="payment-amount">Amount (UGX)</label><input id="payment-amount" name="amount" type="number" min="15000" step="1" required inputmode="numeric"><label for="payment-phone">Mobile money number</label><input id="payment-phone" name="phone" type="tel" required pattern="(?:07[0-9]{8}|\\+2567[0-9]{8})" placeholder="07XXXXXXXX or +2567XXXXXXXX" autocomplete="tel"><label for="payment-recipient-name">Registered mobile-money account name</label><input id="payment-recipient-name" name="recipientName" type="text" required maxlength="80" placeholder="Name registered with MTN or Airtel" autocomplete="name"><button class="primary-button" type="submit" data-payment-submit>Continue</button><p class="payment-result" role="status" data-payment-result></p></form>';
 document.body.append(paymentDialog);
 paymentDialog.querySelector(".dialog-close").addEventListener("click",()=>{if(paymentDialog.open)paymentDialog.close("cancel");});
 paymentDialog.addEventListener("click",event=>{if(event.target===paymentDialog)paymentDialog.close("cancel");});
 const paymentForm=paymentDialog.querySelector("form");
 let paymentMode="deposit";
 const openPayment=mode=>{
  paymentMode=mode;
  paymentDialog.querySelector("[data-payment-title]").textContent=mode==="deposit"?"Deposit funds":"Withdraw funds";
  paymentDialog.querySelector("[data-payment-description]").textContent=mode==="deposit"?"Request an MTN or Airtel Mobile Money payment to fund your wallet.":"Submit a withdrawal to your registered mobile-money number. A 15% withdrawal tax is deducted. Eligibility requires a successful deposit and at least one active investment.";
  paymentDialog.querySelector("#payment-amount").min=mode==="deposit"?"15000":"5000";
  const recipientNameField=paymentDialog.querySelector("#payment-recipient-name");
  const recipientNameLabel=paymentDialog.querySelector('label[for="payment-recipient-name"]');
  recipientNameField.required=mode==="withdrawal";
  recipientNameField.hidden=mode==="deposit";
  recipientNameLabel.hidden=mode==="deposit";
  paymentDialog.querySelector("#payment-amount").value="";
  paymentDialog.querySelector("#payment-phone").value="";
  paymentDialog.querySelector("#payment-recipient-name").value="";
  paymentDialog.querySelector("[data-payment-result]").textContent="";
  paymentDialog.querySelector("[data-payment-submit]").disabled=false;
  paymentDialog.querySelector("[data-payment-submit]").textContent=mode==="deposit"?"Continue to payment":"Submit withdrawal";
  paymentDialog.showModal();
 };
 document.querySelectorAll("[data-payment-action]").forEach(button=>button.addEventListener("click",()=>openPayment(button.dataset.paymentAction)));
 paymentForm.addEventListener("submit",async event=>{
  event.preventDefault();
  const submit=paymentDialog.querySelector("[data-payment-submit]"),result=paymentDialog.querySelector("[data-payment-result]");
  submit.disabled=true;submit.textContent="Processing…";result.textContent="";
  const payload={amount:Number(paymentForm.elements.amount.value),phone:paymentForm.elements.phone.value.trim(),recipientName:paymentForm.elements.recipientName.value.trim()};
  try{
   const response=await fetch("/api/investor/"+(paymentMode==="deposit"?"deposits":"withdrawals"),{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({error:"The server returned an invalid response."}));
   if(!response.ok)throw new Error(data.error||"The request could not be completed.");
   if(paymentMode==="deposit"){
    const checkout=typeof data.checkoutUrl==="string"?data.checkoutUrl:(typeof data.provider?.checkout_url==="string"?data.provider.checkout_url:null);
    const safeCheckout=(()=>{try{const parsed=new URL(checkout);return parsed.protocol==="https:"?parsed.href:null;}catch{return null;}})();
    if(data.promptSent===true){
     result.textContent="ObPay sent a mobile-money PIN prompt to "+payload.phone+". Approve it on your phone. Your wallet will only be credited after ObPay confirms successful payment. Reference: "+data.reference;
    }else if(safeCheckout){
     result.textContent="ObPay requires hosted checkout. Continue using the secure payment page. Reference: "+data.reference+" ";
     const link=document.createElement("a");link.href=safeCheckout;link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open secure checkout";result.append(link);
    }else{
     result.textContent="ObPay has not confirmed that a PIN prompt was sent. The original payment reference is being checked. Do not submit another deposit. Reference: "+data.reference;
    }
   }else result.textContent="Withdrawal request submitted. Gross: "+amountMinor(data.grossAmount,"UGX")+" · Tax: "+amountMinor(data.taxAmount,"UGX")+" · Net payout: "+amountMinor(data.payoutAmount,"UGX")+". Reference: "+data.reference+".";
   submit.textContent="Request submitted";
   setTimeout(()=>location.reload(),2200);
  }catch(error){result.textContent=error.message||"Payment request failed.";submit.disabled=false;submit.textContent=paymentMode==="deposit"?"Continue to payment":"Submit withdrawal";}
 });

 const showLoadError=message=>{
  const content=document.querySelector(".content");if(!content)return;
  let note=document.querySelector("[data-dashboard-error]");
  if(!note){note=document.createElement("div");note.className="notice";note.dataset.dashboardError="true";content.prepend(note);}
  note.textContent=message;
 };
 fetch("/api/investor/dashboard",{credentials:"same-origin",cache:"no-store",headers:{"Accept":"application/json"}})
  .then(async response=>{
   const contentType=response.headers.get("content-type")||"";
   const raw=await response.text();
   if(response.status===401){location.replace("/login/");return null;}
   if(!contentType.includes("application/json"))throw new Error("Dashboard API returned "+response.status+" with "+(contentType||"an unknown content type")+".");
   let data;try{data=JSON.parse(raw);}catch{throw new Error("Dashboard API response was not valid JSON.");}
   if(!response.ok)throw new Error(data.error||("Dashboard API returned "+response.status+"."));
   if(data.authenticated!==true)throw new Error("The dashboard could not confirm your investor session.");
   return data;
  })
  .then(data=>{
   if(!data)return;
   try{renderDashboard(data);document.querySelector("[data-dashboard-error]")?.remove();showDailyCheckInPrompt();}
   catch(error){console.error("Investor dashboard rendering failed:",error);showLoadError("Your account data was received, but the dashboard could not display it: "+(error.message||"Unknown display error"));}
  })
  .catch(error=>{
   console.error("Investor dashboard load failed:",error);
   showLoadError("Your account information could not be loaded: "+(error.message||"Unknown error")+". Refresh the page to try again.");
  });
 
 document.querySelector("[data-history-toggle]")?.addEventListener("click",event=>{
  const button=event.currentTarget;
  const content=document.querySelector("[data-history-content]");
  if(!content)return;
  const expanded=button.getAttribute("aria-expanded")==="true";
  button.setAttribute("aria-expanded",String(!expanded));
  content.hidden=expanded;
  const chevron=button.querySelector(".profile-chevron");
  if(chevron)chevron.textContent=expanded?"⌄":"⌃";
 });
 const passwordDialog=document.querySelector("[data-password-dialog]");
 const passwordForm=document.querySelector("[data-password-change-form]");
 const passwordMessage=document.querySelector("[data-password-change-message]");
 const closePasswordDialog=()=>{
  if(passwordDialog)passwordDialog.hidden=true;
  passwordForm?.reset();
  if(passwordMessage){passwordMessage.textContent="";passwordMessage.className="password-dialog-message";}
 };
 document.querySelectorAll("[data-profile-action='password']").forEach(button=>button.addEventListener("click",()=>{
  if(passwordDialog){passwordDialog.hidden=false;passwordDialog.querySelector("input")?.focus();}
 }));
 document.querySelectorAll("[data-password-close]").forEach(button=>button.addEventListener("click",closePasswordDialog));
 passwordDialog?.addEventListener("click",event=>{if(event.target===passwordDialog)closePasswordDialog();});
 document.addEventListener("keydown",event=>{if(event.key==="Escape"&&passwordDialog&&!passwordDialog.hidden)closePasswordDialog();});
 passwordForm?.addEventListener("submit",async event=>{
  event.preventDefault();
  const values=Object.fromEntries(new FormData(passwordForm).entries());
  const submit=passwordForm.querySelector('button[type="submit"]');
  if(values.newPassword!==values.confirmPassword){passwordMessage.textContent="The new passwords do not match.";return;}
  passwordMessage.textContent="";passwordMessage.className="password-dialog-message";
  submit.disabled=true;submit.textContent="Updating…";
  try{
   const response=await fetch("/api/investor/password/change",{method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify({currentPassword:values.currentPassword,newPassword:values.newPassword})});
   const result=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(result.error||"Password could not be updated.");
   passwordMessage.textContent="Password updated. Other signed-in devices have been logged out.";
   passwordMessage.classList.add("success");
   passwordForm.reset();
   setTimeout(closePasswordDialog,1800);
  }catch(error){
   passwordMessage.textContent=error.message||"Password could not be updated. Try again.";
   passwordMessage.classList.add("error");
  }finally{
   submit.disabled=false;submit.textContent="Update password";
  }
 });
 let deferredInstallPrompt=null;
 const installButton=document.querySelector("[data-install-app]");
 const isInstalled=()=>window.matchMedia("(display-mode: standalone)").matches||window.navigator.standalone===true;
 const installDialog=document.createElement("dialog");
 installDialog.className="payment-dialog lifeline-install-dialog";
 installDialog.innerHTML='<form method="dialog" class="payment-dialog-form"><button class="dialog-close" type="button" aria-label="Close">×</button><span class="kicker">LIFELINE CARE SUPPLY</span><h2 data-install-title>Install Lifeline</h2><p data-install-message></p><button class="primary-button" type="button" data-install-confirm>Install now</button><p class="payment-result" role="status" data-install-help></p></form>';
 document.body.append(installDialog);
 const installTitle=installDialog.querySelector("[data-install-title]");
 const installMessage=installDialog.querySelector("[data-install-message]");
 const installConfirm=installDialog.querySelector("[data-install-confirm]");
 const installHelp=installDialog.querySelector("[data-install-help]");
 const closeInstallDialog=()=>{if(installDialog.open)installDialog.close();};
 installDialog.querySelector(".dialog-close").addEventListener("click",closeInstallDialog);
 installDialog.addEventListener("click",event=>{if(event.target===installDialog)closeInstallDialog();});
 window.addEventListener("beforeinstallprompt",event=>{
  event.preventDefault();
  deferredInstallPrompt=event;
 });
 window.addEventListener("appinstalled",()=>{
  deferredInstallPrompt=null;
  if(installButton){const label=installButton.querySelector("b");if(label)label.textContent="Lifeline installed";}
  installTitle.textContent="Lifeline installed";
  installMessage.textContent="Lifeline has been added to this device. You can open it from your home screen or app list.";
  installConfirm.hidden=true;installHelp.textContent="";
  if(!installDialog.open)installDialog.showModal();
 });
 installButton?.addEventListener("click",async()=>{
  installHelp.textContent="";
  installConfirm.hidden=false;
  if(isInstalled()){
   installTitle.textContent="Lifeline is already installed";
   installMessage.textContent="You can open Lifeline directly from your home screen or app list.";
   installConfirm.hidden=true;
   installDialog.showModal();
   return;
  }
  installTitle.textContent="Install Lifeline";
  installMessage.textContent="Add Lifeline to your device for quick access from your home screen.";
  installConfirm.textContent="Install now";
  installDialog.showModal();
  if(deferredInstallPrompt){
   installConfirm.disabled=false;
   installHelp.textContent="Tap Install now to add the app to your device.";
  }else{
   const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
   installHelp.textContent=isIOS
    ?"On iPhone or iPad: tap Share in Safari, then choose Add to Home Screen."
    :"In Chrome: open the browser menu (⋮), choose Install app or Add to Home screen, then confirm.";
  }
 });
 installConfirm.addEventListener("click",async()=>{
  if(!deferredInstallPrompt){
   const isIOS=/iphone|ipad|ipod/i.test(navigator.userAgent);
   installHelp.textContent=isIOS
    ?"Use Safari's Share menu, then select Add to Home Screen."
    :"Open Chrome's ⋮ menu and select Install app or Add to Home screen.";
   return;
  }
  installConfirm.disabled=true;installConfirm.textContent="Opening installer…";
  try{
   deferredInstallPrompt.prompt();
   const choice=await deferredInstallPrompt.userChoice;
   deferredInstallPrompt=null;
   if(choice?.outcome==="accepted"){
    installMessage.textContent="Installation started. Follow your device's confirmation steps.";
    installHelp.textContent="";
   }else{
    installHelp.textContent="Installation was not completed. Tap Install now to try again.";
   }
  }catch(error){
   installHelp.textContent="Your browser could not open the installer. Use the browser menu to install Lifeline.";
  }finally{
   installConfirm.disabled=false;installConfirm.textContent="Install now";
  }
 });
 if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("/service-worker.js").catch(()=>{}));
 }

 document.querySelector("[data-copy-referral]")?.addEventListener("click",async event=>{
 const button=event.currentTarget;const url=button.dataset.url;
 if(!url||button.disabled)return;
 const feedback=document.querySelector("[data-referral-feedback]");
 try{
  if(navigator.clipboard?.writeText){
   await navigator.clipboard.writeText(url);
  }else{
   const field=document.createElement("textarea");
   field.value=url;field.setAttribute("readonly","");field.style.position="fixed";field.style.opacity="0";
   document.body.appendChild(field);field.select();
   const copied=document.execCommand("copy");field.remove();
   if(!copied)throw new Error("Clipboard copy was blocked");
  }
  if(feedback)feedback.textContent="Link copied.";
 }catch(error){
  if(feedback)feedback.textContent="Unable to copy the link. Please try again.";
 }
 });

 const menuToggle=document.querySelector("[data-menu-toggle]");
 const closeMenu=()=>{
  document.body.classList.remove("investor-menu-open");
  menuToggle?.setAttribute("aria-expanded","false");
  menuToggle?.setAttribute("aria-label","Open navigation menu");
 };
 menuToggle?.addEventListener("click",()=>{
  const open=document.body.classList.toggle("investor-menu-open");
  menuToggle.setAttribute("aria-expanded",String(open));
  menuToggle.setAttribute("aria-label",open?"Close navigation menu":"Open navigation menu");
 });
 document.querySelector("[data-menu-close]")?.addEventListener("click",closeMenu);
 document.querySelector("body[data-portal=investor]")?.addEventListener("click",event=>{
  if(document.body.classList.contains("investor-menu-open") && event.target===document.body)closeMenu();
 });
 document.querySelectorAll(".side-nav a[data-tab]").forEach(link=>link.addEventListener("click",closeMenu));
 document.querySelector("[data-open-profile]")?.addEventListener("click",()=>{activateTab("profile");history.replaceState(null,"","#profile");window.scrollTo({top:0,behavior:"smooth"});});
 const applyPhoto=src=>{
  const photo=document.querySelector("[data-profile-photo]");
  const fallback=document.querySelector("[data-profile-initial]");
  const top=document.querySelector("[data-top-profile-avatar]");
  if(photo){photo.src=src||"";photo.hidden=!src;}
  if(fallback)fallback.hidden=!!src;
  if(top){top.style.backgroundImage=src?'url("'+src+'")':"";top.classList.toggle("has-photo",!!src);top.textContent=src?"":(document.querySelector("[data-profile-name]")?.textContent||"I").slice(0,1).toUpperCase();}
 };
 const loadProfilePhoto=async()=>{
  try{const response=await fetch("/api/investor/profile-photo",{credentials:"same-origin",cache:"no-store"});
   if(response.status===401){location.replace("/login/");return;}
   if(!response.ok)return;
   const data=await response.json();applyPhoto(data.photo||"");
  }catch(error){console.warn("Profile photo could not be loaded:",error);}
 };
 loadProfilePhoto();
 document.querySelector("[data-profile-photo-input]")?.addEventListener("change",event=>{
  const file=event.target.files?.[0];if(!file)return;
  if(!["image/jpeg","image/png","image/webp"].includes(file.type)){alert("Choose a JPG, PNG or WebP image.");event.target.value="";return;}
  if(file.size>3*1024*1024){alert("Choose an image smaller than 3 MB.");event.target.value="";return;}
  const reader=new FileReader();
  reader.onload=()=>{
   const img=new Image();
   img.onload=()=>{
    const side=512,canvas=document.createElement("canvas");canvas.width=side;canvas.height=side;
    const scale=Math.max(side/img.width,side/img.height),w=img.width*scale,h=img.height*scale;
    canvas.getContext("2d").drawImage(img,(side-w)/2,(side-h)/2,w,h);
    const data=canvas.toDataURL("image/jpeg",.78);
    if(data.length>350000){alert("This image is too detailed to store. Choose a smaller photo.");return;}
    const button=document.querySelector(".profile-upload-button");
    if(button){button.style.opacity=".6";button.style.pointerEvents="none";}
    fetch("/api/investor/profile-photo",{method:"PUT",credentials:"same-origin",headers:{"Content-Type":"application/json"},body:JSON.stringify({photo:data})})
     .then(async response=>{const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Photo upload failed.");applyPhoto(data);})
     .catch(error=>alert(error.message||"Photo upload failed. Please try again."))
     .finally(()=>{if(button){button.style.opacity="";button.style.pointerEvents="";}event.target.value="";});
   };
   img.onerror=()=>alert("The selected image could not be opened.");
   img.src=reader.result;
  };
  reader.readAsDataURL(file);
 });
document.querySelectorAll("[data-logout]").forEach(button=>{button.addEventListener("click",async event=>{event.preventDefault();if(button.dataset.loggingOut==="true")return;button.dataset.loggingOut="true";button.setAttribute("aria-busy","true");button.style.pointerEvents="none";try{const response=await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin",headers:{"Accept":"application/json"}});if(!response.ok)throw new Error("Logout request failed");location.replace("/login/?logged_out=1");}catch(error){button.dataset.loggingOut="false";button.removeAttribute("aria-busy");button.style.pointerEvents="";const feedback=document.querySelector("[data-logout-feedback]");if(feedback)feedback.textContent="Unable to log out. Check your connection and try again.";else alert("Unable to log out. Check your connection and try again.");}});});
}
