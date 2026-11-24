const body=document.body;
const title=document.getElementById("page-title");
const crumb=document.getElementById("crumb");
const isAdmin=body.dataset.portal==="admin";
const titles={overview:isAdmin?"Administrator overview":"Dashboard",investments:"My Investments",packages:"Investment Plans",wallet:"Wallet",earnings:"Earnings",transactions:"Transactions",referrals:"Referrals",profile:"Account",investors:"Individual investors",deposits:"Deposit management",withdrawals:"Withdrawal management",reports:"Reports",staff:"Staff & permissions",audit:"Audit log"};
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
 if(title&&(!location.hash||location.hash==="#overview"))title.textContent="Dashboard";
 if(crumb&&(!location.hash||location.hash==="#overview"))crumb.textContent="Dashboard";
 const avatar=document.querySelector(".top-actions .avatar");if(avatar)avatar.textContent=name.slice(0,1).toUpperCase();
 setText("[data-profile-name]",name);setText("[data-profile-phone]",profile.phone||"—");
 setText("[data-profile-created]",dateEAT(profile.createdAt));
 setText("[data-profile-verification]",profile.phoneVerified?"Verified":"Not verified");
 const initial=document.querySelector("[data-profile-initial]");if(initial)initial.textContent=name.slice(0,1).toUpperCase();
 const investments=data.investments||[];
 const active=investments.filter(item=>item.status==="active");
 const totalInvested=investments.filter(item=>!["cancelled","rejected"].includes(item.status)).reduce((sum,item)=>sum+(Number.parseFloat(String(item.principal_amount).replace(/[^0-9.]/g,""))||0),0);
 const currency=investments[0]?.currency||"UGX";
 const formatMajor=value=>new Intl.NumberFormat("en-UG",{style:"currency",currency,maximumFractionDigits:0}).format(value);
 setText('[data-metric="totalInvested"]',formatMajor(totalInvested));
 setText('[data-metric="totalEarnings"]',"Not available");
 setText('[data-metric="availableBalance"]',"Not available");
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
 fillTable("[data-transactions]",data.transactions||[],[x=>x.reference,x=>x.type,x=>dateEAT(x.createdAt),x=>amountMinor(x.amountMinor,x.currency),x=>x.status],"No transactions have been recorded.");
 fillTable("[data-referrals]",data.referrals||[],[x=>x.phone_e164,x=>dateEAT(x.registered_at),x=>x.status],"No referrals are linked to this account.");
 const link=document.querySelector("[data-referral-link]");const refStatus=document.querySelector("[data-referral-status]");
 if(data.referralCode?.code&&data.referralCode.is_active){if(link)link.textContent=data.referralCode.code;if(refStatus)refStatus.textContent="Active code";}
 const packages=document.querySelector("[data-packages]");
 const catalogue=[
  {name:"Product 1",price:10000,daily:2000,duration:90,image:"/product-01.jpg"},
  {name:"Product 2",price:15000,daily:3000,duration:90,image:"/product-02.jpg"},
  {name:"Product 3",price:20000,daily:4000,duration:90,image:"/product-03.jpg"},
  {name:"Product 4",price:30000,daily:6000,duration:90,image:"/product-04.jpg"},
  {name:"Product 5",price:50000,daily:8000,duration:90,image:"/product-05.jpg"},
  {name:"Product 6",price:80000,daily:11000,duration:90,image:"/product-06.jpg"},
  {name:"Product 7",price:100000,daily:20000,duration:90,image:"/product-07.jpg"},
  {name:"Product 8",price:150000,daily:30000,duration:90,image:"/product-08.jpg"},
  {name:"Product 9",price:200000,daily:40000,duration:90,image:"/product-09.jpg"},
  {name:"Product 10",price:250000,daily:48000,duration:90,image:"/product-10.jpg"}
 ];
 if(packages){
  packages.replaceChildren();
  const items=catalogue;
  for(const p of items){
   const card=document.createElement("article");card.className="panel package-card";
   const image=document.createElement("img");image.className="package-image";image.src=p.image;image.alt="Medical equipment";image.loading="lazy";image.decoding="async";
   const body=document.createElement("div");body.className="package-card-body";
   const heading=document.createElement("h3");heading.textContent=p.name;
   const details=document.createElement("div");details.className="package-details";
   const fields=[["Purchase price",p.price],["Daily income",p.daily],["Duration",p.duration+" days"],["Total projected return",p.daily*p.duration]];
   for(const [label,value] of fields){const item=document.createElement("div");item.className="package-detail";const caption=document.createElement("span");caption.textContent=label;const amount=document.createElement("b");amount.textContent=typeof value==="number"?new Intl.NumberFormat("en-UG").format(value)+" UGX":value;item.append(caption,amount);details.append(item);}
   const note=document.createElement("p");note.className="package-risk-note";note.textContent="Catalogue figures only. Projected returns are not guaranteed. Investment activation and earnings are not yet enabled.";
   body.append(heading,details,note);card.append(image,body);packages.append(card);
  }
 }
 const recent=document.querySelector("[data-recent-activity]");
 if(recent){recent.replaceChildren();const span=document.createElement("span");span.textContent="⌁";const b=document.createElement("b");b.textContent=data.investments?.length?data.investments.length+" investment record(s)":"No investment activity yet";const small=document.createElement("small");small.textContent="Account records are up to date";recent.append(span,b,small);}
 const recentTx=document.querySelector("[data-recent-transactions]");
 if(recentTx){
  recentTx.replaceChildren();
  const recentItems=(data.transactions||[]).slice(0,5);
  if(!recentItems.length){const empty=document.createElement("div");empty.className="empty-state";empty.textContent="No transaction activity has been recorded yet.";recentTx.append(empty);}
  else for(const item of recentItems){
   const row=document.createElement("div");row.className="recent-transaction";
   const info=document.createElement("div");const label=document.createElement("b");label.textContent=item.type+" · "+(item.status||"pending");
   const date=document.createElement("small");date.textContent=dateEAT(item.createdAt);info.append(label,date);
   const amount=document.createElement("strong");amount.textContent=amountMinor(item.amountMinor,item.currency);row.append(info,amount);recentTx.append(row);
  }
 }
}
if(!isAdmin){
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
   try{renderDashboard(data);document.querySelector("[data-dashboard-error]")?.remove();}
   catch(error){console.error("Investor dashboard rendering failed:",error);showLoadError("Your account data was received, but the dashboard could not display it: "+(error.message||"Unknown display error"));}
  })
  .catch(error=>{
   console.error("Investor dashboard load failed:",error);
   showLoadError("Your account information could not be loaded: "+(error.message||"Unknown error")+". Refresh the page to try again.");
  });
 document.querySelector("[data-logout]")?.addEventListener("click",async event=>{event.preventDefault();try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});}finally{location.replace("/login/");}});
}
