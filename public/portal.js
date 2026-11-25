const body=document.body;
const title=document.getElementById("page-title");
const crumb=document.getElementById("crumb");
const isAdmin=body.dataset.portal==="admin";
const titles={overview:isAdmin?"Administrator overview":"Dashboard",investments:"My Investments",packages:"Investment Plans",wallet:"Wallet",earnings:"Earnings",transactions:"History",referrals:"Referral",profile:"Profile",investors:"Individual investors",deposits:"Deposit management",withdrawals:"Withdrawal management",reports:"Reports",staff:"Staff & permissions",audit:"Audit log"};
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
function cell(row,value){const td=document.createElement("td");td.textContent=value??"—";row.append(td);}
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
 setText('[data-metric="totalEarnings"]',"Not available");
 const walletCurrency=metrics.walletCurrency||"UGX";
 const walletBalance=amountMinor(metrics.walletBalanceMinor||0,walletCurrency);
 setText('[data-metric="availableBalance"]',walletBalance);
 setText("[data-home-wallet-balance]",walletBalance);
 setText("[data-wallet-balance]",walletBalance);
 setText("[data-home-today-earnings]","UGX 0");
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
 const copyButton=document.querySelector("[data-copy-referral]");
 if(data.referralCode?.code&&data.referralCode.is_active){
  if(link)link.textContent=data.referralCode.code;
  if(refStatus)refStatus.textContent="Active referral code";
  if(copyButton){copyButton.disabled=false;copyButton.dataset.code=data.referralCode.code;}
 }else{
  if(link)link.textContent="Referral code has not been issued";
  if(refStatus)refStatus.textContent="Code not issued";
  if(copyButton)copyButton.disabled=true;
 }
 const packages=document.querySelector("[data-packages]");
 const productImageByCode={
  THERMOMETER:"/product-01.jpg","BP-MONITOR":"/product-02.jpg","PULSE-OXIMETER":"/product-03.jpg",
  NEBULIZER:"/product-04.jpg",GLUCOMETER:"/product-05.jpg","ECG-MACHINE":"/product-06.jpg",
  "PATIENT-MONITOR":"/product-07.jpg",MICROSCOPE:"/product-08.jpg",
  "OXYGEN-CONCENTRATOR":"/product-09.jpg","ULTRASOUND-SCANNER":"/product-10.jpg"
 };
 const catalogue=(data.packages||[]).map(item=>{
  let terms={};try{terms=JSON.parse(item.return_structure||"{}");}catch{}
  return {name:item.name,price:Number(item.investment_amount),daily:Number(terms.daily_income_ugx||0),duration:Number(item.duration_days||90),total:Number(terms.total_return_ugx||0),image:productImageByCode[item.code]||"/product-01.jpg"};
 });
 if(packages){
  packages.replaceChildren();
  const items=catalogue;
  for(const p of items){
   const card=document.createElement("article");card.className="panel package-card";
   const image=document.createElement("img");image.className="package-image";image.src=p.image;image.alt="Medical equipment";image.loading="lazy";image.decoding="async";
   const body=document.createElement("div");body.className="package-card-body";
   const heading=document.createElement("h3");heading.textContent=p.name;
   const details=document.createElement("div");details.className="package-details";
   const fields=[["Purchase price",p.price],["Daily income",p.daily],["Duration",p.duration+" days"],["Total projected return",p.total]];
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
  withdrawals:[["REFERENCE",x=>x.reference],["INVESTOR",x=>x.phone_e164],["AMOUNT",x=>adminMoney(x.amount_minor,x.currency)],["PAYOUT METHOD",x=>x.payout_method],["STATUS",x=>x.status],["CREATED (EAT)",x=>adminDate(x.created_at)]],
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
  const defs=columns[tab]||[];
  const headRow=document.createElement("tr");defs.forEach(([label])=>{const th=document.createElement("th");th.textContent=label;headRow.append(th);});thead.replaceChildren(headRow);
  tbody.replaceChildren();
  if(!records?.length){const tr=document.createElement("tr"),td=document.createElement("td");td.colSpan=defs.length||1;td.className="empty-cell";td.textContent="No records found.";tr.append(td);tbody.append(tr);return;}
  for(const item of records){const tr=document.createElement("tr");for(const [,get] of defs){const td=document.createElement("td");td.textContent=String(get(item)??"—");tr.append(td);}tbody.append(tr);}
 };
 const loadAdminSection=async tab=>{
  const section=tab==="overview"?"overview":tab==="packages"?"packages":tab==="investors"?"investors":tab==="investments"?"investments":tab==="deposits"?"deposits":tab==="withdrawals"?"withdrawals":tab==="referrals"?"referrals":tab==="audit"?"audit":null;
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
      nextMidnightEarnings:"Not configured",
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
   const initial=location.hash.slice(1);loadAdminSection(initial&&document.getElementById("panel-"+initial)?initial:"overview");
   document.querySelectorAll("[data-tab]").forEach(link=>link.addEventListener("click",()=>loadAdminSection(link.dataset.tab)));
  })
  .catch(error=>{console.error(error);location.replace("/admin/login/");});
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
 document.querySelectorAll("[data-profile-action]").forEach(button=>button.addEventListener("click",()=>{
  const action=button.dataset.profileAction;
  const messages={
   password:"Password management is not available yet. The secure password-change service must be implemented before this control can update credentials.",
   help:"Help articles are being prepared. For assistance, use the official support channel once its link is configured.",
   terms:"The platform Terms & Conditions will be published here before investment transactions are enabled.",
   privacy:"The platform Privacy Policy will be published here before personal-data workflows are enabled.",
   about:"Lifeline Care Supply is an individual-investor platform focused on fixed investment packages for medical equipment."
  };
  window.alert(messages[action]||"This section is not available yet.");
 }));
 document.querySelectorAll("[data-support-placeholder]").forEach(link=>link.addEventListener("click",event=>{
  event.preventDefault();
  window.alert("The official Telegram and live-support links have not been configured in this project yet.");
 }));

 document.querySelector("[data-copy-referral]")?.addEventListener("click",async event=>{
 const button=event.currentTarget;const code=button.dataset.code;
 if(!code)return;
 const feedback=document.querySelector("[data-referral-feedback]");
 try{await navigator.clipboard.writeText(code);if(feedback)feedback.textContent="Referral code copied.";}
 catch{if(feedback)feedback.textContent="Copy is unavailable in this browser. Select and copy the code above.";}
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
document.querySelector("[data-logout]")?.addEventListener("click",async event=>{event.preventDefault();try{await fetch("/api/auth/logout",{method:"POST",credentials:"same-origin"});}finally{location.replace("/login/");}});
}
