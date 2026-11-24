const body=document.body;
const title=document.getElementById("page-title");
const crumb=document.getElementById("crumb");
const isAdmin=body.dataset.portal==="admin";
const titles={overview:isAdmin?"Administrator overview":"Good day, Investor",investments:"My investments",packages:"Investment packages",transactions:"Transactions",referrals:"Referrals",profile:"My profile",investors:"Individual investors",deposits:"Deposit management",withdrawals:"Withdrawal management",reports:"Reports",staff:"Staff & permissions",audit:"Audit log"};
function activateTab(tab){
 const panel=document.getElementById("panel-"+tab);if(!panel)return;
 document.querySelectorAll(".tab-panel").forEach(item=>item.classList.remove("active"));
 panel.classList.add("active");
 document.querySelectorAll(".side-nav a[data-tab]").forEach(item=>item.classList.toggle("active",item.dataset.tab===tab));
 if(title)title.textContent=titles[tab]||"Workspace";
 if(crumb)crumb.textContent=titles[tab]||"Workspace";
}
document.querySelectorAll("[data-tab]").forEach(link=>link.addEventListener("click",event=>{
 const tab=link.dataset.tab;if(!document.getElementById("panel-"+tab))return;
 event.preventDefault();activateTab(tab);history.replaceState(null,"","#"+tab);
}));
const initialTab=location.hash.slice(1);if(initialTab&&document.getElementById("panel-"+initialTab))activateTab(initialTab);
document.querySelectorAll(".year").forEach(item=>item.textContent=String(new Date().getFullYear()));
function setText(selector,value){const el=document.querySelector(selector);if(el)el.textContent=value??"—";}
function cell(row,value){const td=document.createElement("td");td.textContent=value??"—";row.append(td);}
function dateEAT(value){
 if(!value)return "—";
 const date=new Date(value);if(Number.isNaN(date.getTime()))return "—";
 return new Intl.DateTimeFormat("en-UG",{timeZone:"Africa/Kampala",year:"numeric",month:"short",day:"2-digit",hour:"2-digit",minute:"2-digit"}).format(date);
}
function amountMinor(value,currency){const n=Number(value);return Number.isFinite(n)?new Intl.NumberFormat("en-UG",{style:"currency",currency:currency||"UGX",maximumFractionDigits:2}).format(n/100):"—";}
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
 if(title&&(!location.hash||location.hash==="#overview"))title.textContent="Good day, "+name;
 if(crumb&&(!location.hash||location.hash==="#overview"))crumb.textContent="Overview";
 const avatar=document.querySelector(".top-actions .avatar");if(avatar)avatar.textContent=name.slice(0,1).toUpperCase();
 setText("[data-profile-name]",name);setText("[data-profile-phone]",profile.phone||"—");
 setText("[data-profile-created]",dateEAT(profile.createdAt));
 setText("[data-profile-verification]",profile.phoneVerified?"Verified":"Not verified");
 const initial=document.querySelector("[data-profile-initial]");if(initial)initial.textContent=name.slice(0,1).toUpperCase();
 fillTable("[data-investments]",data.investments||[],[x=>x.reference,x=>x.package_name||"—",x=>String(x.principal_amount||"—")+" "+(x.currency||""),x=>x.status,dateEAT(x.started_at)],"No investment records yet.");
 fillTable("[data-transactions]",data.transactions||[],[x=>x.reference,x=>x.type,dateEAT(x.createdAt),x=>amountMinor(x.amountMinor,x.currency),x=>x.status],"No transactions have been recorded.");
 fillTable("[data-referrals]",data.referrals||[],[x=>x.phone_e164,dateEAT(x.registered_at),x=>x.status],"No referrals are linked to this account.");
 const link=document.querySelector("[data-referral-link]");const refStatus=document.querySelector("[data-referral-status]");
 if(data.referralCode?.code&&data.referralCode.is_active){if(link)link.textContent=data.referralCode.code;if(refStatus)refStatus.textContent="Active code";}
 const packages=document.querySelector("[data-packages]");
 if(packages){packages.replaceChildren();if(!data.packages?.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="There are currently no published investment packages.";packages.append(empty);}
 else for(const p of data.packages){const card=document.createElement("article");card.className="panel package-card";const h=document.createElement("h3");h.textContent=p.name;const d=document.createElement("p");d.textContent=p.description||"Review the full terms before making a decision.";const meta=document.createElement("small");meta.textContent=[p.currency,p.investment_amount,p.duration_days?(p.duration_days+" days"):null].filter(Boolean).join(" · ");card.append(h,d,meta);packages.append(card);}}
 const recent=document.querySelector("[data-recent-activity]");
 if(recent){recent.replaceChildren();const span=document.createElement("span");span.textContent="⌁";const b=document.createElement("b");b.textContent=data.investments?.length?data.investments.length+" investment record(s)":"No investment activity yet";const small=document.createElement("small");small.textContent="Account records are up to date";recent.append(span,b,small);}
 const recentTx=document.querySelector("[data-recent-transactions]");
 if(recentTx)recentTx.textContent=data.transactions?.length?data.transactions.length+" transaction record(s) are available in your history.":"No transaction activity has been recorded yet.";
}
if(!isAdmin){
 fetch("/api/investor/dashboard",{credentials:"same-origin",cache:"no-store"})
  .then(async response=>{if(response.status===401){location.replace("/login/");return null;}const data=await response.json();if(!response.ok)throw new Error(data.error||"Unable to load your account.");return data;})
  .then(data=>{if(data?.authenticated)renderDashboard(data);})
  .catch(error=>{console.error("Investor dashboard load failed:",error);const content=document.querySelector(".content");if(content){const note=document.createElement("div");note.className="notice";note.textContent="Your account information could not be loaded. Refresh the page to try again.";content.prepend(note);}});
 document.querySelector("[data-logout]")?.addEventListener("click",async event=>{event.preventDefault();try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});}finally{location.replace("/login/");}});
}
