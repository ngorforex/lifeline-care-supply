const SESSION_SECONDS = 60 * 60 * 24 * 14;
const PASSWORD_ITERATIONS = 100000;
const encoder = new TextEncoder();

function json(data, status = 200, headers = {}) {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff", ...headers }
  });
}
function bytesToBase64(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
function base64ToBytes(value) {
  return Uint8Array.from(atob(value), c => c.charCodeAt(0));
}
function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
}
function constantTimeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}
function randomToken(size = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function sha256(value) {
  return toHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt,
    iterations: PASSWORD_ITERATIONS,
    hash: "SHA-256"
  }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function validPhone(value) {
  return typeof value === "string" && /^\+[1-9]\d{7,14}$/.test(value);
}
function validName(value, optional = false) {
  if (optional && (value === undefined || value === null || value === "")) return true;
  return typeof value === "string" && value.trim().length >= 1 && value.trim().length <= 80 && !/[<>]/.test(value);
}
function passwordValid(value) {
  return typeof value === "string" && value.length >= 12 && value.length <= 128 &&
    /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value);
}
function cookieValue(request, name) {
  const header = request.headers.get("Cookie") || "";
  const match = header.split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  return match ? match.slice(name.length + 1) : null;
}
function cookie(token, maxAge = SESSION_SECONDS) {
  return `lcs_session=${token}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}
function checkOrigin(request, url) {
  const origin = request.headers.get("Origin");
  return !origin || origin === url.origin;
}
async function rateLimit(env, key, maxAttempts, windowSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare(`
    INSERT INTO auth_rate_limits (rate_key, window_started_at, attempts, updated_at)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(rate_key) DO UPDATE SET
      attempts = CASE WHEN auth_rate_limits.window_started_at <= ? THEN 1 ELSE auth_rate_limits.attempts + 1 END,
      window_started_at = CASE WHEN auth_rate_limits.window_started_at <= ? THEN ? ELSE auth_rate_limits.window_started_at END,
      updated_at = excluded.updated_at
    RETURNING attempts
  `).bind(key, now, now, now - windowSeconds, now - windowSeconds, now).first();
  return (row?.attempts || 0) <= maxAttempts;
}
async function createSession(env, userId) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO auth_sessions (id, user_id, admin_user_id, token_hash, expires_at, created_at, last_seen_at)
    VALUES (?, ?, NULL, ?, ?, ?, ?)
  `).bind(id, userId, tokenHash, expires, now, now).run();
  return token;
}
async function createAdminSession(env, adminId) {
  const token = randomToken(32);
  const tokenHash = await sha256(token);
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + SESSION_SECONDS * 1000).toISOString();
  await env.DB.prepare(`
    INSERT INTO auth_sessions (id, user_id, admin_user_id, token_hash, expires_at, created_at, last_seen_at)
    VALUES (?, NULL, ?, ?, ?, ?, ?)
  `).bind(id, adminId, tokenHash, expires, now, now).run();
  return token;
}
async function grantWelcomeBonus(env, userId) {
  const setting = await env.DB.prepare("SELECT setting_value FROM platform_settings WHERE setting_key = ? LIMIT 1")
    .bind("welcome_bonus_ugx").first();
  const amount = Number(setting?.setting_value);
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Welcome bonus setting is missing or invalid.");
  const now = new Date().toISOString();
  const walletId = "wallet-" + userId;
  const transactionId = "welcome-bonus-" + userId;
  const reference = "WB-" + userId;
  const idempotencyKey = "welcome_bonus:" + userId;
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO ledger_accounts (id, owner_user_id, account_code, currency, account_name, created_at) VALUES (?, ?, 'WALLET_AVAILABLE', 'UGX', 'Available wallet balance', ?)")
      .bind(walletId, userId, now),
    env.DB.prepare("INSERT OR IGNORE INTO ledger_accounts (id, owner_user_id, account_code, currency, account_name, created_at) VALUES ('platform-welcome-bonus-expense', NULL, 'PLATFORM_WELCOME_BONUS_EXPENSE', 'UGX', 'Welcome bonus expense', ?)")
      .bind(now),
    env.DB.prepare("INSERT OR IGNORE INTO ledger_transactions (id, reference, idempotency_key, transaction_type, status, currency, related_entity_type, related_entity_id, description, created_by_user_id, posted_at, created_at) VALUES (?, ?, ?, 'welcome_bonus', 'posted', 'UGX', 'user', ?, 'Registration welcome bonus after first successful login', ?, ?, ?)")
      .bind(transactionId, reference, idempotencyKey, userId, userId, now, now),
    env.DB.prepare("INSERT OR IGNORE INTO ledger_entries (id, transaction_id, account_id, side, amount_minor, currency, created_at) VALUES (?, ?, 'platform-welcome-bonus-expense', 'debit', ?, 'UGX', ?)")
      .bind("welcome-bonus-debit-" + userId, transactionId, amount, now),
    env.DB.prepare("INSERT OR IGNORE INTO ledger_entries (id, transaction_id, account_id, side, amount_minor, currency, created_at) VALUES (?, ?, ?, 'credit', ?, 'UGX', ?)")
      .bind("welcome-bonus-credit-" + userId, transactionId, walletId, amount, now),
    env.DB.prepare("INSERT OR IGNORE INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, 'investor.welcome_bonus_credited', 'user', ?, ?, ?)")
      .bind("welcome-bonus-audit-" + userId, userId, userId, JSON.stringify({ amountUGX: amount, trigger: "first_successful_login" }), now)
  ]);
}

async function currentAdmin(request, env) {
  const token = cookieValue(request, "lcs_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const admin = await env.DB.prepare(`
    SELECT a.id, a.email, a.role
    FROM auth_sessions s
    JOIN admin_users a ON a.id = s.admin_user_id
    WHERE s.token_hash = ? AND s.expires_at > ?
      AND s.user_id IS NULL AND a.is_active = 1
    LIMIT 1
  `).bind(tokenHash, now).first();
  if (admin) await env.DB.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
    .bind(now, tokenHash).run();
  return admin || null;
}
async function currentInvestor(request, env) {
  const token = cookieValue(request, "lcs_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await env.DB.prepare(`
    SELECT u.id, u.phone_e164, u.status, u.phone_verified_at, u.created_at,
           p.first_name, p.middle_name, p.last_name
    FROM auth_sessions s
    JOIN users u ON u.id = s.user_id
    JOIN investor_profiles p ON p.user_id = u.id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.status = 'active'
      AND s.admin_user_id IS NULL
    LIMIT 1
  `).bind(tokenHash, now).first();
  if (session) {
    await env.DB.prepare("UPDATE auth_sessions SET last_seen_at = ? WHERE token_hash = ?")
      .bind(now, tokenHash).run();
  }
  return session || null;
}

async function setting(env, key, fallback = null) {
  const row = await env.DB.prepare("SELECT setting_value FROM platform_settings WHERE setting_key=?").bind(key).first();
  return row?.setting_value ?? fallback;
}
async function walletBalance(env, userId) {
  const row = await env.DB.prepare(`
    SELECT COALESCE(SUM(CASE WHEN e.side='credit' THEN e.amount_minor ELSE -e.amount_minor END),0) AS balance
    FROM ledger_accounts a LEFT JOIN ledger_entries e ON e.account_id=a.id AND e.currency=a.currency
    WHERE a.owner_user_id=? AND a.account_code='WALLET_AVAILABLE' AND a.currency='UGX'
  `).bind(userId).first();
  return Number(row?.balance || 0);
}
async function ensurePlatformAccount(env, code, name) {
  await env.DB.prepare("INSERT OR IGNORE INTO ledger_accounts(id,owner_user_id,account_code,currency,account_name,created_at) VALUES(?,NULL,?,'UGX',?,?)")
    .bind("platform-" + code.toLowerCase().replace(/^platform_/,"").replace(/[^a-z0-9]+/g,"-"), code, name, new Date().toISOString()).run();
  return "platform-" + code.toLowerCase().replace(/^platform_/,"").replace(/[^a-z0-9]+/g,"-");
}
async function postLedger(env, {id,reference,key,type,userId,description,debitAccount,creditAccount,amount,adminId=null}) {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Invalid ledger amount.");
  const now = new Date().toISOString();
  const txId = id;
  await env.DB.batch([
    env.DB.prepare("INSERT OR IGNORE INTO ledger_transactions(id,reference,idempotency_key,transaction_type,status,currency,related_entity_type,related_entity_id,description,created_by_user_id,created_by_admin_id,posted_at,created_at) VALUES(?,?,?,?,'posted','UGX','financial_event',?,?,?,?,?,?)")
      .bind(txId,reference,key,type,reference,description,userId,adminId,now,now),
    env.DB.prepare("INSERT OR IGNORE INTO ledger_entries(id,transaction_id,account_id,side,amount_minor,currency,created_at) VALUES(?,?,?,'debit',?,'UGX',?)")
      .bind(txId+"-dr",txId,debitAccount,amount,now),
    env.DB.prepare("INSERT OR IGNORE INTO ledger_entries(id,transaction_id,account_id,side,amount_minor,currency,created_at) VALUES(?,?,?,'credit',?,'UGX',?)")
      .bind(txId+"-cr",txId,creditAccount,amount,now)
  ]);
  const totals = await env.DB.prepare("SELECT COALESCE(SUM(CASE WHEN side='debit' THEN amount_minor ELSE 0 END),0) AS debit,COALESCE(SUM(CASE WHEN side='credit' THEN amount_minor ELSE 0 END),0) AS credit FROM ledger_entries WHERE transaction_id=?").bind(txId).first();
  if (Number(totals?.debit)!==Number(totals?.credit) || Number(totals?.debit)!==amount) throw new Error("Ledger transaction failed balance validation.");
  return txId;
}
async function obpay(env, path, method="GET", payload=null) {
  if (!env.OBPAY_SECRET_KEY) throw new Error("ObPay secret key is not configured.");
  const response = await fetch("https://obpay.online/api/public/v1"+path, {
    method,
    headers: {
      "Authorization":"Bearer "+env.OBPAY_SECRET_KEY,
      "Accept":"application/json",
      ...(payload ? {"Content-Type":"application/json"} : {})
    },
    ...(payload ? {body:JSON.stringify(payload)} : {})
  });
  const raw = await response.text();
  let data={}; try { data=raw ? JSON.parse(raw) : {}; } catch { throw new Error("ObPay returned an unreadable response."); }
  if (!response.ok || data.success===false || data.ok===false) {
    const message = data.error || data.message || data.detail || "ObPay request failed.";
    throw new Error("ObPay HTTP "+response.status+": "+String(message).slice(0,180));
  }
  return data.data || data.result || data.transaction || data.payment || data;
}
function providerStatus(value) {
  const s=String(value||"").toLowerCase();
  if (["success","successful","completed","complete","paid","settled"].includes(s)) return "success";
  if (["failed","failure","rejected","cancelled","canceled","expired"].includes(s)) return "failed";
  return "pending";
}
async function postDepositCredit(env, deposit, provider) {
  const amount=Number(provider.amount ?? provider.amount_minor ?? deposit.amount_minor);
  const currency=String(provider.currency || deposit.currency || "UGX").toUpperCase();
  const providerRef=String(provider.reference || provider.provider_reference || provider.transaction_reference || deposit.reference);
  const providerId=String(provider.transaction_id || provider.id || provider.provider_transaction_id || providerRef);
  if (amount!==Number(deposit.amount_minor) || currency!=="UGX" || providerRef!==deposit.reference) {
    throw new Error("ObPay transaction does not match the local deposit reference, amount and currency.");
  }
  const wallet="wallet-"+deposit.investor_id;
  await env.DB.prepare("INSERT OR IGNORE INTO ledger_accounts(id,owner_user_id,account_code,currency,account_name,created_at) VALUES(?,?,'WALLET_AVAILABLE','UGX','Available wallet balance',?)")
    .bind(wallet,deposit.investor_id,new Date().toISOString()).run();
  const clearing=await ensurePlatformAccount(env,"PLATFORM_DEPOSIT_CLEARING","ObPay deposit clearing");
  const txId="deposit-credit-"+deposit.id;
  await postLedger(env,{id:txId,reference:"DEP-POST-"+deposit.reference,key:"obpay_deposit:"+deposit.id,type:"deposit",userId:deposit.investor_id,description:"Confirmed ObPay mobile-money deposit",debitAccount:clearing,creditAccount:wallet,amount});
  const now=new Date().toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE deposit_requests SET status='completed',provider_status='successful',provider_transaction_id=?,updated_at=? WHERE id=? AND status<>'completed'")
      .bind(providerId,now,deposit.id),
    env.DB.prepare("UPDATE deposit_requests SET ledger_transaction_id=? WHERE id=? AND ledger_transaction_id IS NULL")
      .bind(txId,deposit.id)
  ]);
  await qualifyReferralCommissions(env,deposit);
}
async function qualifyReferralCommissions(env, deposit) {
  const already=await env.DB.prepare("SELECT 1 AS yes FROM referral_commissions WHERE deposit_request_id=? LIMIT 1").bind(deposit.id).first();
  if (already) return;
  const first=await env.DB.prepare("SELECT id FROM deposit_requests WHERE investor_id=? AND status='completed' ORDER BY created_at,id LIMIT 1").bind(deposit.investor_id).first();
  if (first?.id!==deposit.id) return;
  const rates=[Number(await setting(env,"referral_level_1_bps","2500")),Number(await setting(env,"referral_level_2_bps","200")),Number(await setting(env,"referral_level_3_bps","100"))];
  let current=deposit.investor_id;
  for(let level=1;level<=3;level++){
    const rel=await env.DB.prepare("SELECT referrer_user_id FROM referrals WHERE referred_user_id=? LIMIT 1").bind(current).first();
    if(!rel?.referrer_user_id) break;
    const referrer=rel.referrer_user_id, rate=rates[level-1], amount=Math.floor(Number(deposit.amount_minor)*rate/10000);
    if(amount>0){
      const wallet="wallet-"+referrer;
      await env.DB.prepare("INSERT OR IGNORE INTO ledger_accounts(id,owner_user_id,account_code,currency,account_name,created_at) VALUES(?,?,'WALLET_AVAILABLE','UGX','Available wallet balance',?)")
        .bind(wallet,referrer,new Date().toISOString()).run();
      const expense=await ensurePlatformAccount(env,"PLATFORM_REFERRAL_EXPENSE","Referral commission expense");
      const commissionId="ref-commission-"+deposit.id+"-L"+level;
      const txId="referral-credit-"+deposit.id+"-L"+level;
      await postLedger(env,{id:txId,reference:"REF-"+deposit.reference+"-L"+level,key:"referral:"+deposit.id+":"+level,type:"referral_commission",userId:deposit.investor_id,description:"Level "+level+" referral commission",debitAccount:expense,creditAccount:wallet,amount});
      await env.DB.prepare("INSERT OR IGNORE INTO referral_commissions(id,deposit_request_id,referrer_user_id,referred_user_id,level,rate_bps,amount_minor,ledger_transaction_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)")
        .bind(commissionId,deposit.id,referrer,deposit.investor_id,level,rate,amount,txId,new Date().toISOString()).run();
    }
    current=referrer;
  }
  await env.DB.prepare("UPDATE referrals SET status='qualified',qualified_at=COALESCE(qualified_at,?) WHERE referred_user_id=? AND status='registered'")
    .bind(new Date().toISOString(),deposit.investor_id).run();
}
async function confirmObpayTransaction(env, reference) {
  const data=await obpay(env,"/transactions/"+encodeURIComponent(reference));
  const row=await env.DB.prepare("SELECT * FROM deposit_requests WHERE reference=? LIMIT 1").bind(reference).first();
  if(row && providerStatus(data.status || data.payment_status)==="success") await postDepositCredit(env,row,data);
  return data;
}
async function handleObpayWebhook(request, env) {
  if(!env.OBPAY_WEBHOOK_SIGNING_SECRET) return json({error:"Webhook signing secret is not configured."},503);
  const raw=await request.text();
  const signature=(request.headers.get("obpay-signature")||request.headers.get("x-obpay-signature")||request.headers.get("x-webhook-signature")||request.headers.get("x-signature")||"").replace(/^sha256=/i,"").trim().toLowerCase();
  if(!signature) return json({error:"Missing webhook signature."},401);
  const key=await crypto.subtle.importKey("raw",encoder.encode(env.OBPAY_WEBHOOK_SIGNING_SECRET),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const digest=toHex(new Uint8Array(await crypto.subtle.sign("HMAC",key,encoder.encode(raw))));
  if(!constantTimeEqual(digest,signature)) return json({error:"Invalid webhook signature."},401);
  let payload;try{payload=JSON.parse(raw);}catch{return json({error:"Invalid webhook JSON."},400);}
  const event=payload.data||payload.payload||payload;
  const reference=String(event.reference||event.merchant_reference||event.transaction_reference||"");
  if(!reference) return json({error:"Webhook reference is missing."},400);
  const eventStatus=providerStatus(event.status||event.payment_status);
  const hash=await sha256(raw);
  const eventId=String(payload.event_id||payload.id||event.event_id||event.transaction_id||reference+":"+eventStatus+":"+hash);
  const now=new Date().toISOString();
  const inserted=await env.DB.prepare("INSERT OR IGNORE INTO provider_webhook_events(id,provider,provider_event_id,provider_reference,event_type,payload_hash,received_at) VALUES(?,'obpay',?,?,?,?,?)")
    .bind(crypto.randomUUID(),eventId,reference,String(payload.event||payload.type||eventStatus),hash,now).run();
  if(!inserted.meta?.changes){const existing=await env.DB.prepare("SELECT processed_at FROM provider_webhook_events WHERE provider='obpay' AND provider_event_id=?").bind(eventId).first();if(existing?.processed_at)return json({ok:true,duplicate:true});}
  try{
    const deposit=await env.DB.prepare("SELECT * FROM deposit_requests WHERE reference=? LIMIT 1").bind(reference).first();
    const withdrawal=await env.DB.prepare("SELECT * FROM withdrawal_requests WHERE reference=? LIMIT 1").bind(reference).first();
    if(deposit){
      const verified=await confirmObpayTransaction(env,reference);
      const finalStatus=providerStatus(verified.status||verified.payment_status);
      if(finalStatus==="failed") await env.DB.prepare("UPDATE deposit_requests SET provider_status='failed',status='rejected',updated_at=? WHERE id=? AND status='pending'").bind(now,deposit.id).run();
    }else if(withdrawal){
      const verified=await obpay(env,"/transactions/"+encodeURIComponent(reference));
      const finalStatus=providerStatus(verified.status||verified.payment_status);
      if(verified.reference&&String(verified.reference)!==reference)throw new Error("Payout webhook reference mismatch.");
      if(verified.amount!==undefined&&Number(verified.amount)!==Number(withdrawal.payout_amount_minor??withdrawal.amount_minor))throw new Error("Payout webhook amount mismatch.");
      if(verified.currency&&String(verified.currency).toUpperCase()!=="UGX")throw new Error("Payout webhook currency mismatch.");
      if(finalStatus==="success"){await settleWithdrawal(env,withdrawal);await env.DB.prepare("UPDATE withdrawal_requests SET status='completed',provider_status='successful',updated_at=? WHERE id=? AND status='approved'").bind(now,withdrawal.id).run();}
      else if(finalStatus==="failed") await releaseWithdrawal(env,withdrawal,"ObPay payout failed");
    }
    await env.DB.prepare("UPDATE provider_webhook_events SET processed_at=? WHERE provider='obpay' AND provider_event_id=?").bind(new Date().toISOString(),eventId).run();
    return json({ok:true});
  }catch(error){
    console.error("ObPay webhook processing failed:",error);
    return json({error:"Webhook could not be reconciled yet."},503);
  }
}
async function releaseWithdrawal(env, withdrawal, reason) {
  if(withdrawal.status==="rejected"||withdrawal.status==="completed") return;
  const clearing=await ensurePlatformAccount(env,"PLATFORM_WITHDRAWAL_CLEARING","ObPay withdrawal clearing");
  const wallet="wallet-"+withdrawal.investor_id;
  const txId="withdrawal-release-"+withdrawal.id;
  await postLedger(env,{id:txId,reference:"WREL-"+withdrawal.reference,key:"withdrawal_release:"+withdrawal.id,type:"withdrawal_release",userId:withdrawal.investor_id,description:reason,debitAccount:clearing,creditAccount:wallet,amount:Number(withdrawal.amount_minor)});
  await env.DB.prepare("UPDATE withdrawal_requests SET status='rejected',provider_status='failed',updated_at=? WHERE id=? AND status NOT IN ('completed','rejected')").bind(new Date().toISOString(),withdrawal.id).run();
}



async function reconcilePendingObpay(env) {
  const deposits=await env.DB.prepare("SELECT * FROM deposit_requests WHERE status='pending' AND payment_method='ObPay Mobile Money' ORDER BY created_at LIMIT 100").all();
  const withdrawals=await env.DB.prepare("SELECT * FROM withdrawal_requests WHERE status='approved' AND payout_method='ObPay Mobile Money' ORDER BY created_at LIMIT 100").all();
  let completedDeposits=0,completedWithdrawals=0,failed=0;
  for(const row of deposits.results||[]){
    try{
      const p=await obpay(env,"/transactions/"+encodeURIComponent(row.reference));
      const status=providerStatus(p.status||p.payment_status);
      if(p.reference&&String(p.reference)!==row.reference)continue;
      if(p.amount!==undefined&&Number(p.amount)!==Number(row.amount_minor))continue;
      if(p.currency&&String(p.currency).toUpperCase()!=="UGX")continue;
      if(status==="success"){await postDepositCredit(env,row,p);completedDeposits++;}
      else if(status==="failed"){await env.DB.prepare("UPDATE deposit_requests SET status='rejected',provider_status='failed',updated_at=? WHERE id=? AND status='pending'").bind(new Date().toISOString(),row.id).run();failed++;}
    }catch(error){console.warn("Pending ObPay deposit reconciliation deferred:",row.reference,String(error).slice(0,160));}
  }
  const completed=await env.DB.prepare("SELECT * FROM deposit_requests WHERE status='completed' ORDER BY updated_at DESC LIMIT 100").all();
  for(const row of completed.results||[]){try{await qualifyReferralCommissions(env,row);}catch(error){console.warn("Referral commission reconciliation deferred:",row.reference,String(error).slice(0,160));}}
  for(const row of withdrawals.results||[]){
    try{
      const p=await obpay(env,"/transactions/"+encodeURIComponent(row.reference));
      const status=providerStatus(p.status||p.payment_status);
      if(p.reference&&String(p.reference)!==row.reference)continue;
      if(p.amount!==undefined&&Number(p.amount)!==Number(row.payout_amount_minor??row.amount_minor))continue;
      if(p.currency&&String(p.currency).toUpperCase()!=="UGX")continue;
      if(status==="success"){await settleWithdrawal(env,row);await env.DB.prepare("UPDATE withdrawal_requests SET status='completed',provider_status='successful',updated_at=? WHERE id=? AND status='approved'").bind(new Date().toISOString(),row.id).run();completedWithdrawals++;}
      else if(status==="failed"){await releaseWithdrawal(env,row,"ObPay payout failed");failed++;}
    }catch(error){console.warn("Pending ObPay payout reconciliation deferred:",row.reference,String(error).slice(0,160));}
  }
  return {completedDeposits,completedWithdrawals,failed};
}


async function settleWithdrawal(env, withdrawal) {
  const gross=Number(withdrawal.amount_minor);
  const tax=Number(withdrawal.tax_amount_minor||0);
  const net=Number(withdrawal.payout_amount_minor??(gross-tax));
  if(!Number.isSafeInteger(gross)||!Number.isSafeInteger(tax)||!Number.isSafeInteger(net)||gross<=0||tax<0||net<=0||net+tax!==gross)throw new Error("Withdrawal tax and payout amounts do not reconcile.");
  const clearing=await ensurePlatformAccount(env,"PLATFORM_WITHDRAWAL_CLEARING","ObPay withdrawal clearing");
  const payout=await ensurePlatformAccount(env,"PLATFORM_OBPAY_PAYOUT_SETTLEMENT","ObPay payout settlement");
  await postLedger(env,{id:"withdrawal-settle-net-"+withdrawal.id,reference:"WNET-"+withdrawal.reference,key:"withdrawal_settlement_net:"+withdrawal.id,type:"withdrawal_settlement",userId:withdrawal.investor_id,description:"Confirmed ObPay payout",debitAccount:clearing,creditAccount:payout,amount:net});
  if(tax>0){
    const taxAccount=await ensurePlatformAccount(env,"PLATFORM_WITHDRAWAL_TAX_PAYABLE","Withdrawal tax payable");
    await postLedger(env,{id:"withdrawal-tax-"+withdrawal.id,reference:"WTAX-"+withdrawal.reference,key:"withdrawal_tax:"+withdrawal.id,type:"withdrawal_tax",userId:withdrawal.investor_id,description:"Withdrawal tax withheld",debitAccount:clearing,creditAccount:taxAccount,amount:tax});
  }
}

async function postDailyEarnings(env, scheduledAt = new Date()) {
  const eatDate = new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Kampala",year:"numeric",month:"2-digit",day:"2-digit"}).format(scheduledAt);
  const now = scheduledAt.toISOString();
  const rows = await env.DB.prepare("SELECT id,investor_id,package_snapshot,started_at,matures_at FROM investments WHERE status='active' AND started_at<=? AND matures_at>? ORDER BY id").bind(now,now).all();
  const expense = await ensurePlatformAccount(env,"PLATFORM_INVESTMENT_EARNINGS_EXPENSE","Investment earnings expense");
  let posted=0;
  for (const item of rows.results || []) {
    let snapshot={}; try { snapshot=JSON.parse(item.package_snapshot||"{}"); } catch {}
    let terms={}; try { terms=typeof snapshot.returnStructure==="string"?JSON.parse(snapshot.returnStructure):snapshot.returnStructure||{}; } catch {}
    const amount=Number(terms.daily_income_ugx);
    if(!Number.isSafeInteger(amount)||amount<=0) continue;
    const wallet="wallet-"+item.investor_id;
    await env.DB.prepare("INSERT OR IGNORE INTO ledger_accounts(id,owner_user_id,account_code,currency,account_name,created_at) VALUES(?,?,'WALLET_AVAILABLE','UGX','Available wallet balance',?)")
      .bind(wallet,item.investor_id,now).run();
    const earningId="earning-"+item.id+"-"+eatDate;
    const txId="earning-credit-"+item.id+"-"+eatDate;
    await postLedger(env,{id:txId,reference:"EARN-"+item.id+"-"+eatDate,key:"investment_earning:"+item.id+":"+eatDate,type:"investment_earning",userId:item.investor_id,description:"Daily investment earnings for "+eatDate,debitAccount:expense,creditAccount:wallet,amount});
    const insert=await env.DB.prepare("INSERT OR IGNORE INTO investment_earnings(id,investment_id,investor_id,earning_date,amount_minor,ledger_transaction_id,created_at) VALUES(?,?,?,?,?,?,?)")
      .bind(earningId,item.id,item.investor_id,eatDate,amount,txId,now).run();
    if(insert.meta?.changes) posted++;
  }
  await env.DB.prepare("UPDATE investments SET status='matured',updated_at=? WHERE status='active' AND matures_at<=?").bind(now,now).run();
  return {earningDate:eatDate,processed:rows.results?.length||0,posted};
}

async function authApi(request, env, url) {
  if (!env.DB) return json({ error: "Service temporarily unavailable." }, 503);
  if (!checkOrigin(request, url)) return json({ error: "Request origin rejected." }, 403);

  if (request.method === "GET" && url.pathname === "/api/obpay/health") {
    try {
      const ping=await obpay(env,"/ping");
      return json({configured:true,authenticated:true,provider:"ObPay",status:"connected",message:typeof ping.message==="string"?ping.message.slice(0,100):null});
    } catch(error) {
      console.error("ObPay health check:",error);
      return json({configured:Boolean(env.OBPAY_SECRET_KEY&&env.OBPAY_WEBHOOK_SIGNING_SECRET),authenticated:false,provider:"ObPay",status:"unavailable",message:"Provider authentication or connectivity check failed."},502);
    }
  }


  if (request.method === "POST" && url.pathname === "/api/admin/bootstrap") {
    const configuredSecret = env.ADMIN_BOOTSTRAP_SECRET;
    const suppliedSecret = request.headers.get("X-Admin-Bootstrap-Secret") || "";
    if (typeof configuredSecret !== "string" || configuredSecret.length < 32 ||
        !constantTimeEqual(suppliedSecret, configuredSecret)) {
      return json({ error: "Bootstrap is unavailable or unauthorized." }, 404);
    }
    const existing = await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first();
    if (Number(existing?.count || 0) !== 0) {
      return json({ error: "Initial administrator has already been created." }, 409);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    if (!await rateLimit(env, "admin-bootstrap:" + await sha256(ip), 3, 3600)) {
      return json({ error: "Too many bootstrap attempts. Try again later." }, 429);
    }
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = data.password;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !passwordValid(password)) {
      return json({ error: "Provide a valid email and a password with at least 12 characters including uppercase, lowercase and a number." }, 400);
    }
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await passwordHash(password, salt);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO admin_users (id, email, role, is_active, created_at, updated_at) VALUES (?, ?, 'super_admin', 1, ?, ?)")
          .bind(id, email, now, now),
        env.DB.prepare("INSERT INTO admin_credentials (admin_user_id, password_hash, password_salt, password_iterations, password_changed_at) VALUES (?, ?, ?, ?, ?)")
          .bind(id, hash, bytesToBase64(salt), PASSWORD_ITERATIONS, now),
        env.DB.prepare("INSERT INTO audit_logs (id, actor_admin_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, 'admin.initial_bootstrap', 'admin_user', ?, ?, ?)")
          .bind(crypto.randomUUID(), id, id, JSON.stringify({ role: "super_admin" }), now)
      ]);
    } catch (error) {
      console.error("Initial administrator bootstrap failed:", error);
      return json({ error: "Initial administrator could not be created." }, 500);
    }
    return json({ ok: true, message: "Initial super administrator created. Remove ADMIN_BOOTSTRAP_SECRET from Worker secrets now." }, 201);
  }

  if (request.method === "POST" && url.pathname === "/api/admin/auth/login") {
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";
    if (!(email.includes("@") && email.indexOf("@") > 0 && email.lastIndexOf(".") > email.indexOf("@") + 1 && email.lastIndexOf(".") < email.length - 1) || password.length < 1 || password.length > 128) {
      return json({ error: "Invalid email or password." }, 400);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateKey = "admin-login:" + await sha256(ip + ":" + email);
    if (!await rateLimit(env, rateKey, 8, 900)) return json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);
    const row = await env.DB.prepare(`
      SELECT a.id, a.is_active, c.password_hash, c.password_salt, c.password_iterations
      FROM admin_users a JOIN admin_credentials c ON c.admin_user_id = a.id
      WHERE lower(a.email) = ? LIMIT 1
    `).bind(email).first();
    let valid = false;
    if (row) {
      const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: base64ToBytes(row.password_salt), iterations: row.password_iterations, hash: "SHA-256" }, key, 256);
      valid = constantTimeEqual(bytesToBase64(new Uint8Array(bits)), row.password_hash);
    } else {
      await passwordHash(password, crypto.getRandomValues(new Uint8Array(16)));
    }
    if (!row || !valid || row.is_active !== 1) return json({ error: "Invalid email or password." }, 401);
    const token = await createAdminSession(env, row.id);
    return json({ ok: true }, 200, { "set-cookie": cookie(token) });
  }

  if (request.method === "GET" && url.pathname === "/api/admin/auth/me") {
    const admin = await currentAdmin(request, env);
    if (!admin) return json({ authenticated: false }, 401);
    return json({ authenticated: true, admin: { id: admin.id, email: admin.email, role: admin.role } });
  }

  if (request.method === "GET" && url.pathname === "/api/admin/obpay/status") {
    const admin = await currentAdmin(request, env);
    if (!admin) return json({ error: "Authentication required." }, 401);
    if (!env.OBPAY_SECRET_KEY || !env.OBPAY_WEBHOOK_SIGNING_SECRET) {
      return json({ configured: false, error: "ObPay credentials are not fully configured." }, 503);
    }
    try {
      const response = await fetch("https://obpay.online/api/public/v1/ping", {
        method: "GET",
        headers: { "Authorization": "Bearer " + env.OBPAY_SECRET_KEY, "Accept": "application/json" }
      });
      const raw = await response.text();
      let providerData = {};
      try { providerData = JSON.parse(raw); } catch { providerData = {}; }
      return json({
        configured: true,
        reachable: response.ok,
        authenticated: response.ok,
        providerHttpStatus: response.status,
        providerMessage: typeof providerData.message === "string" ? providerData.message.slice(0, 160) : null
      }, response.ok ? 200 : 502);
    } catch (error) {
      console.error("ObPay credential check failed:", error);
      return json({ configured: true, reachable: false, authenticated: false, error: "Could not reach ObPay." }, 502);
    }
  }

  if (request.method === "POST" && url.pathname === "/obpay/webhook") return handleObpayWebhook(request, env);


  if (request.method === "POST" && url.pathname.startsWith("/api/admin/withdrawals/") && url.pathname.endsWith("/approve")) {
    const admin=await currentAdmin(request,env);if(!admin)return json({error:"Authentication required."},401);
    if(!["super_admin","finance_admin"].includes(admin.role))return json({error:"Your administrator role cannot approve payouts."},403);
    const id=url.pathname.split("/")[4];const row=await env.DB.prepare("SELECT * FROM withdrawal_requests WHERE id=? LIMIT 1").bind(id).first();
    if(!row||row.status!=="pending")return json({error:"Pending withdrawal not found."},404);
    try{
      const reviewedAt=new Date().toISOString();
      await env.DB.prepare("UPDATE withdrawal_requests SET status='approved',reviewed_by_admin_id=?,reviewed_at=?,updated_at=? WHERE id=? AND status='pending'")
        .bind(admin.id,reviewedAt,reviewedAt,id).run();
      const result=await obpay(env,"/payouts","POST",{reference:row.reference,amount:Number(row.payout_amount_minor??row.amount_minor),currency:"UGX",phone:row.payout_phone_e164,callback_url:new URL("/obpay/webhook",url).toString(),description:"Lifeline Care Supply withdrawal"});
      await env.DB.prepare("UPDATE withdrawal_requests SET provider_reference=?,provider_status=?,updated_at=? WHERE id=? AND status='approved'")
        .bind(String(result.provider_reference||result.reference||row.reference),String(result.status||"pending"),new Date().toISOString(),id).run();
      const verified=await obpay(env,"/transactions/"+encodeURIComponent(row.reference));
      const verifiedStatus=providerStatus(verified.status||verified.payment_status);
      if(verified.reference&&String(verified.reference)!==row.reference)throw new Error("Payout verification reference mismatch.");
      if(verified.amount!==undefined&&Number(verified.amount)!==Number(row.payout_amount_minor??row.amount_minor))throw new Error("Payout verification amount mismatch.");
      if(verified.currency&&String(verified.currency).toUpperCase()!=="UGX")throw new Error("Payout verification currency mismatch.");
      if(verifiedStatus==="success"){await settleWithdrawal(env,{...row,payout_amount_minor:row.payout_amount_minor??row.amount_minor,tax_amount_minor:row.tax_amount_minor||0});await env.DB.prepare("UPDATE withdrawal_requests SET status='completed',provider_status='successful',updated_at=? WHERE id=? AND status='approved'").bind(new Date().toISOString(),id).run();}
      if(verifiedStatus==="failed")await releaseWithdrawal(env,{...row,status:"approved"},"ObPay payout failed");
      return json({ok:true,status:verifiedStatus==="success"?"completed":verifiedStatus==="failed"?"rejected":"approved",provider:result});
    }catch(error){console.error("ObPay payout initiation failed:",error);return json({error:"ObPay payout was not accepted. Funds remain reserved; inspect provider status before retrying."},502);}
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/admin/withdrawals/") && url.pathname.endsWith("/reject")) {
    const admin=await currentAdmin(request,env);if(!admin)return json({error:"Authentication required."},401);
    if(!["super_admin","finance_admin"].includes(admin.role))return json({error:"Your administrator role cannot reject payouts."},403);
    const id=url.pathname.split("/")[4];const row=await env.DB.prepare("SELECT * FROM withdrawal_requests WHERE id=? LIMIT 1").bind(id).first();
    if(!row||!["pending","approved"].includes(row.status))return json({error:"Withdrawal cannot be rejected in its current state."},409);
    await releaseWithdrawal(env,row,"Withdrawal rejected by administrator");
    await env.DB.prepare("UPDATE withdrawal_requests SET reviewed_by_admin_id=?,reviewed_at=?,review_note='Rejected by administrator' WHERE id=?").bind(admin.id,new Date().toISOString(),id).run();
    return json({ok:true,status:"rejected"});
  }
  if (request.method === "POST" && url.pathname.startsWith("/api/admin/packages/") && url.pathname.endsWith("/publish")) {
    const admin=await currentAdmin(request,env);if(!admin)return json({error:"Authentication required."},401);
    if(!["super_admin","investment_manager"].includes(admin.role))return json({error:"Your administrator role cannot publish investment packages."},403);
    const id=url.pathname.split("/")[4];const pkg=await env.DB.prepare("SELECT * FROM investment_packages WHERE id=? AND status IN ('draft','paused')").bind(id).first();
    if(!pkg)return json({error:"Package not found or cannot be published."},404);
    const price=Number(pkg.investment_amount),terms=(()=>{try{return JSON.parse(pkg.return_structure||"{}");}catch{return {};}})();
    if(!Number.isSafeInteger(price)||price<=0||!Number.isSafeInteger(Number(pkg.duration_days))||Number(pkg.duration_days)<=0||!Number.isSafeInteger(Number(terms.daily_income_ugx))||Number(terms.daily_income_ugx)<=0||!pkg.terms_version||!pkg.risk_disclosure)return json({error:"Package terms are incomplete. Update the package before publishing."},409);
    const now=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare("UPDATE investment_packages SET status='published',published_at=?,updated_at=? WHERE id=?").bind(now,now,id),
      env.DB.prepare("INSERT INTO audit_logs(id,actor_admin_id,action,entity_type,entity_id,metadata,created_at) VALUES(?,?,'investment_package.published','investment_package',?,?,?)").bind(crypto.randomUUID(),admin.id,id,JSON.stringify({code:pkg.code,termsVersion:pkg.terms_version}),now)
    ]);
    return json({ok:true,status:"published"});
  }

  if (request.method === "GET" && url.pathname === "/api/admin/data") {
    const admin = await currentAdmin(request, env);
    if (!admin) return json({ error: "Authentication required." }, 401);
    const section = url.searchParams.get("section") || "overview";
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
    const pageLimit = Math.floor(limit);
    const eat = "Africa/Kampala";
    if (section === "overview") {
      const [investors, activeInvestments, pendingDeposits, pendingWithdrawals, successfulDeposits, successfulWithdrawals, todayDeposits, todayWithdrawals, referrals, activeInvestmentTerms] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM investments WHERE status = 'active'").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM deposit_requests WHERE status IN ('pending','under_review')").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM withdrawal_requests WHERE status IN ('pending','under_review')").first(),
        env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM deposit_requests WHERE status = 'completed'").first(),
        env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM withdrawal_requests WHERE status = 'completed'").first(),
        env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM deposit_requests WHERE status = 'completed' AND date(created_at,'+3 hours') = date('now','+3 hours')").first(),
        env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM withdrawal_requests WHERE status = 'completed' AND date(created_at,'+3 hours') = date('now','+3 hours')").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM referrals").first(),
        env.DB.prepare("SELECT package_snapshot FROM investments WHERE status='active'").all()
      ]);
      const nextMidnightEarningsMinor=(activeInvestmentTerms.results||[]).reduce((sum,item)=>{try{const snapshot=JSON.parse(item.package_snapshot||"{}");const terms=typeof snapshot.returnStructure==="string"?JSON.parse(snapshot.returnStructure):snapshot.returnStructure||{};const amount=Number(terms.daily_income_ugx);return sum+(Number.isSafeInteger(amount)&&amount>0?amount:0);}catch{return sum;}},0);
      return json({ section, metrics: {
        totalInvestors: Number(investors?.count || 0),
        activeInvestments: Number(activeInvestments?.count || 0),
        pendingDeposits: Number(pendingDeposits?.count || 0),
        pendingWithdrawals: Number(pendingWithdrawals?.count || 0),
        successfulDepositsMinor: Number(successfulDeposits?.total || 0),
        successfulWithdrawalsMinor: Number(successfulWithdrawals?.total || 0),
        todayDepositsMinor: Number(todayDeposits?.total || 0),
        todayWithdrawalsMinor: Number(todayWithdrawals?.total || 0),
        referrals: Number(referrals?.count || 0),
        nextMidnightEarningsMinor
      }, timezone: eat, paymentActions: "enabled" });
    }
    const queries = {
      investors: "SELECT u.id, u.phone_e164, u.status, u.created_at, p.first_name, p.middle_name, p.last_name FROM users u JOIN investor_profiles p ON p.user_id=u.id ORDER BY u.created_at DESC LIMIT ?",
      packages: "SELECT id, code, name, currency, investment_amount, duration_days, return_structure, risk_disclosure, terms_version, status, published_at, created_at, updated_at FROM investment_packages ORDER BY created_at ASC LIMIT ?",
      investments: "SELECT i.id, i.reference, i.investor_id, u.phone_e164, p.name AS package_name, i.principal_amount, i.currency, i.status, i.started_at, i.matures_at, i.created_at FROM investments i JOIN users u ON u.id=i.investor_id LEFT JOIN investment_packages p ON p.id=i.package_id ORDER BY i.created_at DESC LIMIT ?",
      deposits: "SELECT d.id, d.reference, d.investor_id, u.phone_e164, d.amount_minor, d.currency, d.payment_method, d.provider_reference, d.status, d.created_at, d.updated_at FROM deposit_requests d JOIN users u ON u.id=d.investor_id ORDER BY d.created_at DESC LIMIT ?",
      withdrawals: "SELECT w.id,w.reference,w.investor_id,u.phone_e164,w.amount_minor,w.currency,w.payout_method,w.payout_phone_e164,w.provider_reference,w.provider_status,w.status,w.created_at,w.updated_at FROM withdrawal_requests w JOIN users u ON u.id=w.investor_id ORDER BY w.created_at DESC LIMIT ?",
      referrals: "SELECT r.id, r.referrer_user_id, ru.phone_e164 AS referrer_phone, r.referred_user_id, vu.phone_e164 AS referred_phone, r.status, r.registered_at, r.qualified_at FROM referrals r JOIN users ru ON ru.id=r.referrer_user_id JOIN users vu ON vu.id=r.referred_user_id ORDER BY r.registered_at DESC LIMIT ?",
      audit: "SELECT l.id, l.actor_admin_id, l.actor_user_id, a.email AS admin_email, u.phone_e164 AS investor_phone, l.action, l.entity_type, l.entity_id, l.reason, l.metadata, l.created_at FROM audit_logs l LEFT JOIN admin_users a ON a.id=l.actor_admin_id LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT ?"
    };

    queries.all_deposits = "SELECT d.id,d.reference,d.investor_id,u.phone_e164,d.amount_minor,d.currency,d.payment_method,d.provider_reference,d.provider_status,d.status,d.created_at,d.updated_at FROM deposit_requests d JOIN users u ON u.id=d.investor_id ORDER BY d.created_at DESC LIMIT ?";
    queries.successful_deposits = "SELECT d.id,d.reference,d.investor_id,u.phone_e164,d.amount_minor,d.currency,d.payment_method,d.provider_reference,d.provider_status,d.status,d.created_at,d.updated_at FROM deposit_requests d JOIN users u ON u.id=d.investor_id WHERE d.status='completed' ORDER BY d.created_at DESC LIMIT ?";
    queries.all_withdrawals = "SELECT w.id,w.reference,w.investor_id,u.phone_e164,w.amount_minor,w.currency,w.payout_method,w.payout_phone_e164,w.provider_reference,w.provider_status,w.status,w.created_at,w.updated_at FROM withdrawal_requests w JOIN users u ON u.id=w.investor_id ORDER BY w.created_at DESC LIMIT ?";
    queries.successful_withdrawals = "SELECT w.id,w.reference,w.investor_id,u.phone_e164,w.amount_minor,w.currency,w.payout_method,w.payout_phone_e164,w.provider_reference,w.provider_status,w.status,w.created_at,w.updated_at FROM withdrawal_requests w JOIN users u ON u.id=w.investor_id WHERE w.status='completed' ORDER BY w.created_at DESC LIMIT ?";
    queries.active_customers = "SELECT DISTINCT u.id,u.phone_e164,u.status,u.created_at,p.first_name,p.middle_name,p.last_name FROM users u JOIN investor_profiles p ON p.user_id=u.id JOIN investments i ON i.investor_id=u.id WHERE i.status='active' ORDER BY u.created_at DESC LIMIT ?";

    if (!queries[section]) return json({ error: "Unknown data section." }, 400);
    const result = await env.DB.prepare(queries[section]).bind(pageLimit).all();
    return json({ section, records: result.results || [], timezone: eat, paymentActions: "read_only" });
  }

  if (request.method === "POST" && url.pathname === "/api/admin/auth/logout") {
    const token = cookieValue(request, "lcs_session");
    if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const firstName = typeof data.firstName === "string" ? data.firstName.trim() : "";
    const middleName = typeof data.middleName === "string" ? data.middleName.trim() : null;
    const lastName = typeof data.lastName === "string" ? data.lastName.trim() : "";
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const password = data.password;
    if (!validName(firstName) || !validName(lastName) || !validName(middleName, true) ||
        !validPhone(phone) || !passwordValid(password)) {
      return json({ error: "Enter your first and last names, a valid international phone number, and a password with at least 12 characters including uppercase, lowercase and a number." }, 400);
    }
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateKey = "register:" + await sha256(ip);
    if (!await rateLimit(env, rateKey, 5, 3600)) return json({ error: "Too many registration attempts. Try again later." }, 429);

    const referralCodeInput = typeof data.referralCode === "string" ? data.referralCode.trim().toUpperCase() : "";
    const referrer = referralCodeInput
      ? await env.DB.prepare("SELECT owner_user_id FROM referral_codes WHERE code = ? AND is_active = 1 LIMIT 1").bind(referralCodeInput).first()
      : null;
    if (referralCodeInput && !referrer) return json({ error: "That referral code is invalid or inactive." }, 400);
    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await passwordHash(password, salt);
    const ownReferralCode = "LCS" + randomToken(9).replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 9);
    try {
      const statements = [
        env.DB.prepare("INSERT INTO users (id, phone_e164, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)").bind(userId, phone, now, now),
        env.DB.prepare("INSERT INTO investor_profiles (user_id, first_name, middle_name, last_name, verification_state, created_at, updated_at) VALUES (?, ?, ?, ?, 'not_started', ?, ?)").bind(userId, firstName, middleName || null, lastName, now, now),
        env.DB.prepare("INSERT INTO user_credentials (user_id, password_hash, password_salt, password_iterations, password_changed_at) VALUES (?, ?, ?, ?, ?)").bind(userId, hash, bytesToBase64(salt), PASSWORD_ITERATIONS, now),
        env.DB.prepare("INSERT INTO ledger_accounts (id, owner_user_id, account_code, currency, account_name, created_at) VALUES (?, ?, 'WALLET_AVAILABLE', 'UGX', 'Available wallet balance', ?)").bind("wallet-" + userId, userId, now),
        env.DB.prepare("INSERT INTO referral_codes (id, owner_user_id, code, is_active, created_at) VALUES (?, ?, ?, 1, ?)").bind(crypto.randomUUID(), userId, ownReferralCode, now),
        env.DB.prepare("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, 'investor.registered', 'user', ?, ?, ?)").bind(crypto.randomUUID(), userId, userId, JSON.stringify({ channel: "phone_password", welcomeBonusPending: true, referralCodeIssued: true }), now)
      ];
      if (referrer) {
        statements.push(env.DB.prepare("INSERT INTO referrals (id, referral_code_id, referrer_user_id, referred_user_id, status, registered_at) SELECT ?, id, ?, ?, 'registered', ? FROM referral_codes WHERE code = ? AND is_active = 1")
          .bind(crypto.randomUUID(), referrer.owner_user_id, userId, now, referralCodeInput));
      }
      await env.DB.batch(statements);
    } catch (error) {
      console.error("Investor registration transaction failed:", error);
      if (String(error).includes("UNIQUE")) return json({ error: "Unable to create account with those details. Check the phone number or sign in." }, 409);
      return json({ error: "Account registration could not be completed." }, 500);
    }
    const sessionToken = await createSession(env, userId);
    return json({
      ok: true,
      investor: { id: userId, firstName, middleName: middleName || null, lastName, phone },
      message: "Account created."
    }, 201, { "set-cookie": cookie(sessionToken) });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/login") {
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const password = typeof data.password === "string" ? data.password : "";
    if (!validPhone(phone) || password.length < 1 || password.length > 128) return json({ error: "Invalid phone number or password." }, 400);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const rateKey = "login:" + await sha256(ip + ":" + phone);
    if (!await rateLimit(env, rateKey, 10, 900)) return json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, 429);
    const row = await env.DB.prepare(`
      SELECT u.id, u.status, c.password_hash, c.password_salt, c.password_iterations
      FROM users u JOIN user_credentials c ON c.user_id = u.id
      WHERE u.phone_e164 = ? LIMIT 1
    `).bind(phone).first();
    let valid = false;
    if (row) {
      const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
      const bits = await crypto.subtle.deriveBits({
        name: "PBKDF2",
        salt: base64ToBytes(row.password_salt),
        iterations: row.password_iterations,
        hash: "SHA-256"
      }, key, 256);
      valid = constantTimeEqual(bytesToBase64(new Uint8Array(bits)), row.password_hash);
    } else {
      // Comparable password-hash work for unknown phone numbers.
      await passwordHash(password, crypto.getRandomValues(new Uint8Array(16)));
    }
    if (!row || !valid || row.status !== "active") return json({ error: "Invalid phone number or password." }, 401);
    try {
      await grantWelcomeBonus(env, row.id);
    } catch (error) {
      console.error("Welcome bonus posting failed after successful authentication:", error);
      return json({ error: "Sign-in could not be completed because account setup is incomplete. Please try again shortly." }, 503);
    }
    const sessionToken = await createSession(env, row.id);
    return json({ ok: true }, 200, { "set-cookie": cookie(sessionToken) });
  }

  if ((request.method === "GET" || request.method === "PUT") && url.pathname === "/api/investor/profile-photo") {
    const investor = await currentInvestor(request, env);
    if (!investor) return json({ error: "Authentication required." }, 401);
    if (request.method === "GET") {
      const row = await env.DB.prepare("SELECT profile_photo_data FROM investor_profiles WHERE user_id = ? LIMIT 1")
        .bind(investor.id).first();
      return json({ photo: row?.profile_photo_data || null });
    }
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid photo upload." }, 400); }
    const photo = typeof data.photo === "string" ? data.photo : "";
    if (!photo || photo.length > 350000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo)) {
      return json({ error: "Upload a valid JPEG profile photo under the size limit." }, 400);
    }
    await env.DB.prepare("UPDATE investor_profiles SET profile_photo_data = ?, updated_at = ? WHERE user_id = ?")
      .bind(photo, new Date().toISOString(), investor.id).run();
    return json({ ok: true });
  }


  if (request.method === "POST" && url.pathname === "/api/investor/deposits") {
    const investor=await currentInvestor(request,env); if(!investor)return json({error:"Authentication required."},401);
    let data;try{data=await request.json();}catch{return json({error:"Invalid request."},400);}
    const amount=Number(data.amount), phone=typeof data.phone==="string"?data.phone.trim():investor.phone_e164;
    const min=Number(await setting(env,"minimum_deposit_ugx","10000"));
    if(!Number.isSafeInteger(amount)||amount<min||amount>100000000||!validPhone(phone))return json({error:"Enter a valid mobile-money number and deposit amount of at least UGX "+min+"."},400);
    const id=crypto.randomUUID(),reference="LCSDEP"+Date.now().toString(36).toUpperCase()+randomToken(5).replace(/[^A-Z0-9]/gi,"").toUpperCase();
    const now=new Date().toISOString();
    await env.DB.prepare("INSERT INTO deposit_requests(id,reference,investor_id,amount_minor,currency,payment_method,provider_reference,status,payment_phone_e164,created_at,updated_at) VALUES(?,?,?,?,'UGX','ObPay Mobile Money',?,'pending',?,?,?)")
      .bind(id,reference,investor.id,amount,reference,phone,now,now).run();
    try{
      const result=await obpay(env,"/collect","POST",{reference,amount,currency:"UGX",phone,callback_url:new URL("/obpay/webhook",url).toString(),description:"Lifeline Care Supply wallet deposit"});
      await env.DB.prepare("UPDATE deposit_requests SET provider_reference=?,provider_status=?,updated_at=? WHERE id=?")
        .bind(String(result.provider_reference||result.reference||reference),String(result.status||"pending"),new Date().toISOString(),id).run();
      return json({ok:true,reference,status:"pending",provider:result},201);
    }catch(error){
      console.error("ObPay collection initiation failed:",error);
      await env.DB.prepare("UPDATE deposit_requests SET provider_status='initiation_failed',updated_at=? WHERE id=?").bind(new Date().toISOString(),id).run();
      return json({error:"ObPay could not start this payment. No wallet credit was made.",reference},502);
    }
  }
  if (request.method === "POST" && url.pathname === "/api/investor/withdrawals") {
    const investor=await currentInvestor(request,env); if(!investor)return json({error:"Authentication required."},401);
    let data;try{data=await request.json();}catch{return json({error:"Invalid request."},400);}
    const amount=Number(data.amount),phone=typeof data.phone==="string"?data.phone.trim():investor.phone_e164;
    const min=Number(await setting(env,"minimum_withdrawal_ugx","2000"));
    if(!Number.isSafeInteger(amount)||amount<min||amount>100000000||!validPhone(phone))return json({error:"Enter a valid amount and registered mobile-money number."},400);
    const deposit=await env.DB.prepare("SELECT id FROM deposit_requests WHERE investor_id=? AND status='completed' LIMIT 1").bind(investor.id).first();
    const active=await env.DB.prepare("SELECT id FROM investments WHERE investor_id=? AND status='active' LIMIT 1").bind(investor.id).first();
    if(!deposit||!active)return json({error:"Withdrawal eligibility requires a successful deposit and at least one active investment."},403);
    const balance=await walletBalance(env,investor.id);if(balance<amount)return json({error:"Insufficient available wallet balance."},400);
    const taxBps=Number(await setting(env,"withdrawal_tax_bps","1500"));
    const tax=Math.floor(amount*taxBps/10000),payoutAmount=amount-tax;
    if(!Number.isSafeInteger(taxBps)||taxBps<0||taxBps>5000||payoutAmount<=0)return json({error:"Withdrawal tax configuration is invalid."},503);
    const id=crypto.randomUUID(),reference="LCSWDR"+Date.now().toString(36).toUpperCase()+randomToken(5).replace(/[^A-Z0-9]/gi,"").toUpperCase(),now=new Date().toISOString();
    const clearing=await ensurePlatformAccount(env,"PLATFORM_WITHDRAWAL_CLEARING","ObPay withdrawal clearing");
    const wallet="wallet-"+investor.id;
    await env.DB.prepare("INSERT INTO withdrawal_requests(id,reference,investor_id,amount_minor,currency,payout_method,payout_phone_e164,payout_amount_minor,tax_amount_minor,status,created_at,updated_at) VALUES(?,?,?,?,'UGX','ObPay Mobile Money',?,?,?,'pending',?,?)")
      .bind(id,reference,investor.id,amount,phone,payoutAmount,tax,now,now).run();
    try{
      await postLedger(env,{id:"withdrawal-reserve-"+id,reference:"WRES-"+reference,key:"withdrawal_reserve:"+id,type:"withdrawal_reserve",userId:investor.id,description:"Reserve wallet funds for withdrawal request",debitAccount:wallet,creditAccount:clearing,amount});
    }catch(error){await env.DB.prepare("DELETE FROM withdrawal_requests WHERE id=?").bind(id).run();throw error;}
    return json({ok:true,reference,status:"pending",grossAmount:amount,taxAmount:tax,payoutAmount, taxRateBps:taxBps,message:"Withdrawal request submitted for administrator review."},201);
  }
  if (request.method === "POST" && url.pathname === "/api/investor/investments") {
    const investor=await currentInvestor(request,env);if(!investor)return json({error:"Authentication required."},401);
    let data;try{data=await request.json();}catch{return json({error:"Invalid request."},400);}
    const pkg=await env.DB.prepare("SELECT * FROM investment_packages WHERE id=? AND status='published' LIMIT 1").bind(String(data.packageId||"")).first();
    if(!pkg)return json({error:"This investment package is not currently available."},404);
    const amount=Number(pkg.investment_amount);if(!Number.isSafeInteger(amount)||amount<=0)return json({error:"Package configuration is invalid."},409);
    const balance=await walletBalance(env,investor.id);if(balance<amount)return json({error:"Insufficient wallet balance. Deposit first."},400);
    const id=crypto.randomUUID(),reference="LCSINV"+Date.now().toString(36).toUpperCase()+randomToken(5).replace(/[^A-Z0-9]/gi,"").toUpperCase();
    const now=new Date().toISOString(),started=now,matures=new Date(Date.now()+Number(pkg.duration_days||90)*86400000).toISOString();
    const platform=await ensurePlatformAccount(env,"PLATFORM_INVESTMENT_PRINCIPAL","Investment principal holding");
    const wallet="wallet-"+investor.id;
    const snapshot=JSON.stringify({id:pkg.id,code:pkg.code,name:pkg.name,amountUGX:amount,durationDays:pkg.duration_days,returnStructure:pkg.return_structure,termsVersion:pkg.terms_version,riskDisclosure:pkg.risk_disclosure});
    await env.DB.prepare("INSERT INTO investments(id,reference,investor_id,package_id,package_snapshot,principal_amount,currency,status,terms_version,terms_accepted_at,started_at,matures_at,created_at,updated_at) VALUES(?,?,?,?,?,?,'UGX','active',?,?,?,?,?,?)")
      .bind(id,reference,investor.id,pkg.id,snapshot,String(amount),pkg.terms_version,now,started,matures,now,now).run();
    await postLedger(env,{id:"investment-purchase-"+id,reference:"IP-"+reference,key:"investment_purchase:"+id,type:"investment_purchase",userId:investor.id,description:"Purchase "+pkg.name,debitAccount:wallet,creditAccount:platform,amount});
    return json({ok:true,reference,status:"active",maturesAt:matures},201);
  }

  if (request.method === "GET" && url.pathname === "/api/investor/dashboard") {
    const investor = await currentInvestor(request, env);
    if (!investor) return json({ error: "Authentication required." }, 401);

    const investorId = investor.id;
    const [investmentsResult, depositsResult, withdrawalsResult, referralsResult, referralCode, packagesResult, walletBalance, earningsSummary, referralEarnings, earningsHistory, commissionHistory] = await Promise.all([
      env.DB.prepare(`
        SELECT i.id, i.reference, i.principal_amount, i.currency, i.status,
               i.terms_version, i.terms_accepted_at, i.started_at, i.matures_at,
               i.created_at, p.name AS package_name
        FROM investments i
        LEFT JOIN investment_packages p ON p.id = i.package_id
        WHERE i.investor_id = ?
        ORDER BY i.created_at DESC LIMIT 50
      `).bind(investorId).all(),
      env.DB.prepare(`
        SELECT id, reference, amount_minor, currency, payment_method, status, created_at, updated_at
        FROM deposit_requests WHERE investor_id = ?
        ORDER BY created_at DESC LIMIT 50
      `).bind(investorId).all(),
      env.DB.prepare(`
        SELECT id, reference, amount_minor, currency, payout_method, status, created_at, updated_at
        FROM withdrawal_requests WHERE investor_id = ?
        ORDER BY created_at DESC LIMIT 50
      `).bind(investorId).all(),
      env.DB.prepare(`
        SELECT r.id, r.status, r.registered_at, r.qualified_at, u.phone_e164
        FROM referrals r
        JOIN users u ON u.id = r.referred_user_id
        WHERE r.referrer_user_id = ?
        ORDER BY r.registered_at DESC LIMIT 50
      `).bind(investorId).all(),
      env.DB.prepare("SELECT code, is_active, created_at FROM referral_codes WHERE owner_user_id = ? LIMIT 1")
        .bind(investorId).first(),
      env.DB.prepare(`
        SELECT id, code, name, description, currency, investment_amount,
               duration_days, return_structure, risk_disclosure, terms_version
        FROM investment_packages WHERE status = 'published'
        ORDER BY created_at ASC LIMIT 50
      `).all(),
      env.DB.prepare(`
        SELECT COALESCE(SUM(CASE WHEN e.side = 'credit' THEN e.amount_minor ELSE -e.amount_minor END), 0) AS balance_minor
        FROM ledger_accounts a
        LEFT JOIN ledger_entries e ON e.account_id = a.id AND e.currency = a.currency
        WHERE a.owner_user_id = ? AND a.account_code = 'WALLET_AVAILABLE' AND a.currency = 'UGX'
      `).bind(investorId).first(),
      env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total,COALESCE(SUM(CASE WHEN earning_date=? THEN amount_minor ELSE 0 END),0) AS today FROM investment_earnings WHERE investor_id=?")
        .bind(new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Kampala",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date()),investorId).first(),
      env.DB.prepare("SELECT COALESCE(SUM(amount_minor),0) AS total FROM referral_commissions WHERE referrer_user_id=?")
        .bind(investorId).first(),
      env.DB.prepare("SELECT id,investment_id,earning_date,amount_minor,created_at FROM investment_earnings WHERE investor_id=? ORDER BY earning_date DESC LIMIT 50")
        .bind(investorId).all(),
      env.DB.prepare("SELECT id,deposit_request_id,referred_user_id,level,rate_bps,amount_minor,created_at FROM referral_commissions WHERE referrer_user_id=? ORDER BY created_at DESC LIMIT 50")
        .bind(investorId).all()
    ]);

    const investments = investmentsResult.results || [];
    const deposits = depositsResult.results || [];
    const withdrawals = withdrawalsResult.results || [];
    const referrals = referralsResult.results || [];
    const activeInvestments = investments.filter(item => item.status === "active").length;
    const nextEarningsMinor = investments.filter(item => item.status === "active").reduce((sum,item)=>{try{const snapshot=JSON.parse(item.package_snapshot||"{}");const terms=typeof snapshot.returnStructure==="string"?JSON.parse(snapshot.returnStructure):snapshot.returnStructure||{};const amount=Number(terms.daily_income_ugx);return sum+(Number.isSafeInteger(amount)&&amount>0?amount:0);}catch{return sum;}},0);
    const depositCount = deposits.length;
    const withdrawalCount = withdrawals.length;
    const qualifiedReferrals = referrals.filter(item => item.status === "qualified").length;
    const transactions = [
      ...deposits.map(item => ({ id: item.id, reference: item.reference, type: "Deposit", amountMinor: item.amount_minor, currency: item.currency, status: item.status, createdAt: item.created_at })),
      ...withdrawals.map(item => ({ id: item.id, reference: item.reference, type: "Withdrawal", amountMinor: item.amount_minor, currency: item.currency, status: item.status, createdAt: item.created_at }))
    ].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 50);

    return json({
      authenticated: true,
      profile: {
        id: investor.id,
        phone: investor.phone_e164,
        status: investor.status,
        createdAt: investor.created_at,
        phoneVerified: Boolean(investor.phone_verified_at),
        displayName: [investor.first_name, investor.middle_name, investor.last_name]
          .filter(Boolean).join(" ").replace(/^Investor Account$/, "Investor") || "Investor"
      },
      metrics: {
        activeInvestments,
        totalInvestments: investments.length,
        depositRequests: depositCount,
        withdrawalRequests: withdrawalCount,
        referrals: referrals.length,
        qualifiedReferrals,
        walletBalanceMinor: Number(walletBalance?.balance_minor || 0),
        walletCurrency: "UGX",\n        investmentEarningsMinor: Number(earningsSummary?.total||0),\n        todayEarningsMinor: Number(earningsSummary?.today||0),\n        referralEarningsMinor: Number(referralEarnings?.total||0),\n        totalEarningsMinor: Number(earningsSummary?.total||0)+Number(referralEarnings?.total||0),\n        nextEarningsMinor
      },
      investments,
      deposits,
      withdrawals,
      transactions,
      referrals,
      earnings: earningsHistory.results || [],
      referralCommissions: commissionHistory.results || [],
      referralCode: referralCode || null,
      packages: packagesResult.results || []
    });
  }

  if (request.method === "POST" && url.pathname === "/api/auth/logout") {
    const token = cookieValue(request, "lcs_session");
    if (token) await env.DB.prepare("DELETE FROM auth_sessions WHERE token_hash = ?").bind(await sha256(token)).run();
    return json({ ok: true }, 200, { "set-cookie": cookie("", 0) });
  }

  if (request.method === "GET" && url.pathname === "/api/auth/me") {
    const investor = await currentInvestor(request, env);
    if (!investor) return json({ authenticated: false }, 401);
    return json({
      authenticated: true,
      investor: {
        id: investor.id,
        phone: investor.phone_e164,
        firstName: investor.first_name,
        middleName: investor.middle_name,
        lastName: investor.last_name,
        phoneVerified: Boolean(investor.phone_verified_at)
      }
    });
  }
  return json({ error: "Not found." }, 404);
}

export default {
  async scheduled(controller, env, ctx) {
    ctx.waitUntil((async()=>{await reconcilePendingObpay(env);if(controller.cron==="0 21 * * *")await postDailyEarnings(env,new Date(controller.scheduledTime||Date.now()));})());
  },
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/admin/setup" || url.pathname === "/admin/setup/") {
      const adminCount = await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_users").first();
      if (Number(adminCount?.count || 0) > 0) return new Response("Not found.", { status: 404, headers: { "cache-control": "no-store" } });
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Initial administrator setup</title><style>
      *{box-sizing:border-box}body{margin:0;min-height:100vh;background:#f3f6f8;color:#17212b;font:16px system-ui,-apple-system,sans-serif;display:grid;place-items:center;padding:20px}.card{width:100%;max-width:440px;background:#fff;border:1px solid #e1e7ec;border-radius:18px;padding:26px;box-shadow:0 12px 36px #14212b12}h1{font-size:23px;margin:0 0 8px}p{color:#5d6b78;line-height:1.5;margin:0 0 22px}.field{display:block;margin:16px 0 6px;font-weight:600;font-size:14px}input{width:100%;padding:13px;border:1px solid #cbd5df;border-radius:10px;font:inherit;background:white;color:#17212b}button{width:100%;padding:14px;border:0;border-radius:10px;background:#123b32;color:white;font-weight:700;font-size:16px;margin-top:22px}button:disabled{opacity:.6}.note{font-size:12px;margin-top:16px;color:#667582}#result{white-space:pre-wrap;overflow-wrap:anywhere;margin-top:18px;padding:12px;border-radius:9px;background:#f2f5f7;display:none}#result.ok{background:#e8f5ed;color:#155b32}#result.err{background:#fff0ef;color:#922b24}</style></head><body><main class="card"><h1>Initial administrator setup</h1><p>Create the first Lifeline Care Supply super administrator. This one-time setup is available only while no administrator exists.</p><form id="setup"><label class="field" for="email">Administrator email</label><input id="email" type="email" autocomplete="username" required><label class="field" for="password">Administrator password</label><input id="password" type="password" autocomplete="new-password" minlength="12" required><label class="field" for="secret">Cloudflare bootstrap secret</label><input id="secret" type="password" autocomplete="off" minlength="32" required><button id="submit" type="submit">Create Administrator</button></form><div id="result" role="status"></div><div class="note">Use a unique password. Your secret and password are sent directly to this website over HTTPS and are not saved by this page.</div></main><script>
      const form=document.getElementById('setup'),button=document.getElementById('submit'),result=document.getElementById('result');
      form.addEventListener('submit',async e=>{e.preventDefault();button.disabled=true;button.textContent='Creating account…';result.style.display='none';
      try{const response=await fetch('/api/admin/bootstrap',{method:'POST',headers:{'Content-Type':'application/json','X-Admin-Bootstrap-Secret':document.getElementById('secret').value},body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});
      const data=await response.json().catch(()=>({error:'The server returned an unreadable response.'}));result.textContent=data.message||data.error||('HTTP '+response.status);result.className=response.ok?'ok':'err';result.style.display='block';
      if(response.ok){form.reset();button.textContent='Administrator created';}else{button.disabled=false;button.textContent='Create Administrator';}
      }catch(error){result.textContent='Could not reach the server. Check your internet connection and try again.';result.className='err';result.style.display='block';button.disabled=false;button.textContent='Create Administrator';}});
      </script></body></html>`;
      return new Response(html,{headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
    }
    const adminDashboardPaths = ["/admin", "/admin/", "/admin/index.html"];
    const isAdminDashboard = adminDashboardPaths.includes(url.pathname);
    const isAdminLogin = url.pathname === "/admin/login" || url.pathname === "/admin/login/";
    if (isAdminDashboard || isAdminLogin) {
      const admin = await currentAdmin(request, env);
      if (isAdminDashboard && !admin) {
        const loginUrl = new URL("/admin/login/", url);
        return env.ASSETS ? env.ASSETS.fetch(new Request(loginUrl, { method: "GET", headers: request.headers })) : Response.redirect(loginUrl, 302);
      }
      if (isAdminLogin && admin) return Response.redirect(new URL("/admin/", url), 302);
      if (isAdminDashboard && admin && url.pathname !== "/admin/") return Response.redirect(new URL("/admin/", url), 302);
    }
    if (url.pathname === "/obpay/webhook" && request.method === "POST") {
      try { return await handleObpayWebhook(request, env); }
      catch (error) { console.error("ObPay webhook handler error:", error); return json({ error: "Webhook processing failed." }, 503); }
    }
    if (url.pathname.startsWith("/api/")) {
      try {
        return await authApi(request, env, url);
      } catch (error) {
        console.error("Investor authentication request failed:", error);
        return json({ error: "The account service encountered an unexpected error. Please try again shortly." }, 500);
      }
    }

    if (url.pathname === "/health") {
      try {
        if (!env.DB) throw new Error("D1 binding is missing");
        const result = await env.DB.prepare("SELECT 1 AS ok").first();
        if (result?.ok !== 1) throw new Error("D1 health query failed");
        return json({ status: "ok", service: "lifeline-care-supply", database: "connected", environment: "production" });
      } catch {
        return json({ status: "degraded", service: "lifeline-care-supply", database: "unavailable" }, 503);
      }
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "API route not implemented yet." }, 404);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response("Lifeline Care Supply is being prepared.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }
};
