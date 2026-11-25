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
async function authApi(request, env, url) {
  if (!env.DB) return json({ error: "Service temporarily unavailable." }, 503);
  if (!checkOrigin(request, url)) return json({ error: "Request origin rejected." }, 403);

  if (request.method === "POST" && url.pathname === "/api/admin/auth/login") {
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const email = typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
    const password = typeof data.password === "string" ? data.password : "";
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email) || password.length < 1 || password.length > 128) {
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

  if (request.method === "GET" && url.pathname === "/api/admin/data") {
    const admin = await currentAdmin(request, env);
    if (!admin) return json({ error: "Authentication required." }, 401);
    const section = url.searchParams.get("section") || "overview";
    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit")) || 100));
    const pageLimit = Math.floor(limit);
    const eat = "Africa/Kampala";
    if (section === "overview") {
      const [investors, activeInvestments, pendingDeposits, pendingWithdrawals, deposits, withdrawals, referrals] = await Promise.all([
        env.DB.prepare("SELECT COUNT(*) AS count FROM users").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM investments WHERE status = 'active'").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM deposit_requests WHERE status IN ('pending','under_review')").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM withdrawal_requests WHERE status IN ('pending','under_review')").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM deposit_requests").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM withdrawal_requests").first(),
        env.DB.prepare("SELECT COUNT(*) AS count FROM referrals").first()
      ]);
      return json({ section, metrics: {
        totalInvestors: Number(investors?.count || 0),
        activeInvestments: Number(activeInvestments?.count || 0),
        pendingDeposits: Number(pendingDeposits?.count || 0),
        pendingWithdrawals: Number(pendingWithdrawals?.count || 0),
        totalDeposits: Number(deposits?.count || 0),
        totalWithdrawals: Number(withdrawals?.count || 0),
        referrals: Number(referrals?.count || 0)
      }, timezone: eat, paymentActions: "read_only" });
    }
    const queries = {
      investors: "SELECT u.id, u.phone_e164, u.status, u.created_at, p.first_name, p.middle_name, p.last_name FROM users u JOIN investor_profiles p ON p.user_id=u.id ORDER BY u.created_at DESC LIMIT ?",
      packages: "SELECT id, code, name, currency, investment_amount, duration_days, return_structure, risk_disclosure, terms_version, status, published_at, created_at, updated_at FROM investment_packages ORDER BY created_at ASC LIMIT ?",
      investments: "SELECT i.id, i.reference, i.investor_id, u.phone_e164, p.name AS package_name, i.principal_amount, i.currency, i.status, i.started_at, i.matures_at, i.created_at FROM investments i JOIN users u ON u.id=i.investor_id LEFT JOIN investment_packages p ON p.id=i.package_id ORDER BY i.created_at DESC LIMIT ?",
      deposits: "SELECT d.id, d.reference, d.investor_id, u.phone_e164, d.amount_minor, d.currency, d.payment_method, d.provider_reference, d.status, d.created_at, d.updated_at FROM deposit_requests d JOIN users u ON u.id=d.investor_id ORDER BY d.created_at DESC LIMIT ?",
      withdrawals: "SELECT w.id, w.reference, w.investor_id, u.phone_e164, w.amount_minor, w.currency, w.payout_method, w.status, w.created_at, w.updated_at FROM withdrawal_requests w JOIN users u ON u.id=w.investor_id ORDER BY w.created_at DESC LIMIT ?",
      referrals: "SELECT r.id, r.referrer_user_id, ru.phone_e164 AS referrer_phone, r.referred_user_id, vu.phone_e164 AS referred_phone, r.status, r.registered_at, r.qualified_at FROM referrals r JOIN users ru ON ru.id=r.referrer_user_id JOIN users vu ON vu.id=r.referred_user_id ORDER BY r.registered_at DESC LIMIT ?",
      audit: "SELECT l.id, l.actor_admin_id, l.actor_user_id, a.email AS admin_email, u.phone_e164 AS investor_phone, l.action, l.entity_type, l.entity_id, l.reason, l.metadata, l.created_at FROM audit_logs l LEFT JOIN admin_users a ON a.id=l.actor_admin_id LEFT JOIN users u ON u.id=l.actor_user_id ORDER BY l.created_at DESC LIMIT ?"
    };
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

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hash = await passwordHash(password, salt);
    try {
      await env.DB.batch([
        env.DB.prepare("INSERT INTO users (id, phone_e164, status, created_at, updated_at) VALUES (?, ?, 'active', ?, ?)")
          .bind(userId, phone, now, now),
        env.DB.prepare("INSERT INTO investor_profiles (user_id, first_name, middle_name, last_name, verification_state, created_at, updated_at) VALUES (?, ?, ?, ?, 'not_started', ?, ?)")
          .bind(userId, firstName, middleName || null, lastName, now, now),
        env.DB.prepare("INSERT INTO user_credentials (user_id, password_hash, password_salt, password_iterations, password_changed_at) VALUES (?, ?, ?, ?, ?)")
          .bind(userId, hash, bytesToBase64(salt), PASSWORD_ITERATIONS, now),
        env.DB.prepare("INSERT INTO ledger_accounts (id, owner_user_id, account_code, currency, account_name, created_at) VALUES (?, ?, 'WALLET_AVAILABLE', 'UGX', 'Available wallet balance', ?)").bind("wallet-" + userId, userId, now),
        env.DB.prepare("INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, metadata, created_at) VALUES (?, ?, 'investor.registered', 'user', ?, ?, ?)")
          .bind(crypto.randomUUID(), userId, userId, JSON.stringify({ channel: "phone_password" }), now)
      ]);
    } catch (error) {
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

  if (request.method === "GET" && url.pathname === "/api/investor/dashboard") {
    const investor = await currentInvestor(request, env);
    if (!investor) return json({ error: "Authentication required." }, 401);

    const investorId = investor.id;
    const [investmentsResult, depositsResult, withdrawalsResult, referralsResult, referralCode, packagesResult, walletBalance] = await Promise.all([
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
      `).bind(investorId).first()
    ]);

    const investments = investmentsResult.results || [];
    const deposits = depositsResult.results || [];
    const withdrawals = withdrawalsResult.results || [];
    const referrals = referralsResult.results || [];
    const activeInvestments = investments.filter(item => item.status === "active").length;
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
        walletCurrency: "UGX"
      },
      investments,
      deposits,
      withdrawals,
      transactions,
      referrals,
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
  async fetch(request, env) {
    const url = new URL(request.url);
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
