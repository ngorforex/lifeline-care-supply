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
async function currentInvestor(request, env) {
  const token = cookieValue(request, "lcs_session");
  if (!token) return null;
  const tokenHash = await sha256(token);
  const now = new Date().toISOString();
  const session = await env.DB.prepare(`
    SELECT u.id, u.phone_e164, u.status, u.phone_verified_at,
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

  if (request.method === "POST" && url.pathname === "/api/auth/register") {
    let data;
    try { data = await request.json(); } catch { return json({ error: "Invalid request." }, 400); }
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    const password = data.password;
    if (!validPhone(phone) || !passwordValid(password)) {
      return json({ error: "Enter a valid phone number in international format (+country code) and a password with at least 12 characters including uppercase, lowercase and a number." }, 400);
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
        env.DB.prepare("INSERT INTO investor_profiles (user_id, first_name, middle_name, last_name, verification_state, created_at, updated_at) VALUES (?, 'Investor', NULL, 'Account', 'not_started', ?, ?)")
          .bind(userId, now, now),
        env.DB.prepare("INSERT INTO user_credentials (user_id, password_hash, password_salt, password_iterations, password_changed_at) VALUES (?, ?, ?, ?, ?)")
          .bind(userId, hash, bytesToBase64(salt), PASSWORD_ITERATIONS, now),
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
      investor: { id: userId, phone },
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
    if (url.pathname.startsWith("/api/auth/")) {
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
