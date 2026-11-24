// GoTrue-compatible auth against plain Postgres auth.users (bcrypt hashes).

import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { randomUUID, createHash, randomBytes } from "crypto";
import { query } from "./pool";
import { authJwtSecret } from "./mode";

const ACCESS_TTL_SEC = 60 * 60 * 24 * 7; // 7 days
const REFRESH_TTL_SEC = 60 * 60 * 24 * 30; // 30 days

export interface AuthUser {
  id: string;
  aud: string;
  role: string;
  email: string;
  phone: string;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  confirmed_at: string | null;
  last_sign_in_at: string | null;
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  identities: unknown[];
  created_at: string;
  updated_at: string;
}

export interface SessionTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at: number;
  token_type: "bearer";
  user: AuthUser;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(authJwtSecret());
}

function rowToUser(row: Record<string, any>, appRole?: string | null): AuthUser {
  const meta =
    typeof row.raw_user_meta_data === "string"
      ? JSON.parse(row.raw_user_meta_data || "{}")
      : row.raw_user_meta_data || {};
  const appMeta =
    typeof row.raw_app_meta_data === "string"
      ? JSON.parse(row.raw_app_meta_data || "{}")
      : row.raw_app_meta_data || {};
  if (appRole) {
    appMeta.role = appRole;
  }
  return {
    id: row.id,
    aud: "authenticated",
    role: "authenticated",
    email: row.email || "",
    phone: row.phone || "",
    email_confirmed_at: row.email_confirmed_at || null,
    phone_confirmed_at: row.phone_confirmed_at || null,
    confirmed_at: row.email_confirmed_at || row.phone_confirmed_at || null,
    last_sign_in_at: row.last_sign_in_at || null,
    app_metadata: appMeta,
    user_metadata: meta,
    identities: [],
    created_at: row.created_at,
    updated_at: row.updated_at || row.created_at,
  };
}

async function loadAppRole(userId: string): Promise<string | null> {
  try {
    const { rows } = await query<{ role: string }>(
      `SELECT role FROM profiles WHERE id = $1 LIMIT 1`,
      [userId]
    );
    return rows[0]?.role ?? null;
  } catch {
    return null;
  }
}

async function mintSession(userRow: Record<string, any>): Promise<SessionTokens> {
  const appRole = await loadAppRole(userRow.id);
  const user = rowToUser(userRow, appRole);
  const now = Math.floor(Date.now() / 1000);
  const sessionId = randomUUID();

  const access_token = await new SignJWT({
    aud: "authenticated",
    role: "authenticated",
    email: user.email,
    phone: user.phone,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
    session_id: sessionId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + ACCESS_TTL_SEC)
    .sign(secretKey());

  const refresh_token = await new SignJWT({
    typ: "refresh",
    session_id: sessionId,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(user.id)
    .setIssuedAt(now)
    .setExpirationTime(now + REFRESH_TTL_SEC)
    .sign(secretKey());

  return {
    access_token,
    refresh_token,
    expires_in: ACCESS_TTL_SEC,
    expires_at: now + ACCESS_TTL_SEC,
    token_type: "bearer",
    user,
  };
}

export async function verifyAccessToken(
  token: string
): Promise<{ userId: string; payload: Record<string, any> } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (payload.typ === "refresh") return null;
    const userId = typeof payload.sub === "string" ? payload.sub : null;
    if (!userId) return null;
    return { userId, payload: payload as Record<string, any> };
  } catch {
    return null;
  }
}

export async function getUserById(userId: string): Promise<AuthUser | null> {
  const { rows } = await query(
    `SELECT id, email, phone, encrypted_password, email_confirmed_at,
            phone_confirmed_at, last_sign_in_at, raw_app_meta_data,
            raw_user_meta_data, created_at, updated_at
     FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [userId]
  );
  if (!rows[0]) return null;
  const appRole = await loadAppRole(userId);
  return rowToUser(rows[0], appRole);
}

export async function signInWithPassword(
  email: string,
  password: string
): Promise<{ session: SessionTokens | null; error: string | null }> {
  const normalized = email.trim().toLowerCase();
  const { rows } = await query(
    `SELECT id, email, phone, encrypted_password, email_confirmed_at,
            phone_confirmed_at, last_sign_in_at, raw_app_meta_data,
            raw_user_meta_data, created_at, updated_at
     FROM auth.users
     WHERE lower(email) = $1 AND deleted_at IS NULL
     LIMIT 1`,
    [normalized]
  );
  const row = rows[0];
  if (!row?.encrypted_password) {
    return { session: null, error: "Invalid login credentials" };
  }
  const ok = bcrypt.compareSync(password, row.encrypted_password);
  if (!ok) {
    return { session: null, error: "Invalid login credentials" };
  }

  await query(
    `UPDATE auth.users SET last_sign_in_at = now(), updated_at = now() WHERE id = $1`,
    [row.id]
  ).catch(() => {});

  const session = await mintSession(row);
  return { session, error: null };
}

export async function signUpWithPassword(opts: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
}): Promise<{ session: SessionTokens | null; user: AuthUser | null; error: string | null }> {
  const email = opts.email.trim().toLowerCase();
  if (!email || !opts.password || opts.password.length < 6) {
    return { session: null, user: null, error: "Email and password (min 6 chars) required" };
  }

  const existing = await query(`SELECT id FROM auth.users WHERE lower(email) = $1 LIMIT 1`, [
    email,
  ]);
  if (existing.rows[0]) {
    return { session: null, user: null, error: "User already registered" };
  }

  const id = randomUUID();
  const hash = bcrypt.hashSync(opts.password, 10);
  const meta = opts.data || {};

  await query(
    `INSERT INTO auth.users (
       id, instance_id, aud, role, email, encrypted_password,
       email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
       created_at, updated_at, confirmation_token, recovery_token,
       email_change_token_new, email_change
     ) VALUES (
       $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
       $2, $3, now(), '{"provider":"email","providers":["email"]}'::jsonb, $4::jsonb,
       now(), now(), '', '', '', ''
     )`,
    [id, email, hash, JSON.stringify(meta)]
  );

  // Ensure profile row exists (app expects profiles.id = auth.users.id)
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    [meta.first_name, meta.last_name].filter((v) => typeof v === "string" && v.trim()).join(" ").trim() ||
    email.split("@")[0];
  await query(
    `INSERT INTO profiles (id, email, full_name, phone, role, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'customer', now(), now())
     ON CONFLICT (id) DO UPDATE SET
       full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
       phone = COALESCE(NULLIF(profiles.phone, ''), EXCLUDED.phone),
       updated_at = now()`,
    [id, email, fullName, typeof meta.phone === "string" && meta.phone.trim() ? meta.phone.trim() : null]
  ).catch(() => {});

  const { rows } = await query(`SELECT * FROM auth.users WHERE id = $1`, [id]);
  const session = await mintSession(rows[0]);
  return { session, user: session.user, error: null };
}

export async function refreshSession(
  refreshToken: string
): Promise<{ session: SessionTokens | null; error: string | null }> {
  try {
    const { payload } = await jwtVerify(refreshToken, secretKey());
    if (payload.typ !== "refresh") {
      return { session: null, error: "Invalid refresh token" };
    }
    const userId = payload.sub;
    if (!userId || typeof userId !== "string") {
      return { session: null, error: "Invalid refresh token" };
    }
    const { rows } = await query(
      `SELECT id, email, phone, encrypted_password, email_confirmed_at,
              phone_confirmed_at, last_sign_in_at, raw_app_meta_data,
              raw_user_meta_data, created_at, updated_at
       FROM auth.users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [userId]
    );
    if (!rows[0]) return { session: null, error: "User not found" };
    const session = await mintSession(rows[0]);
    return { session, error: null };
  } catch {
    return { session: null, error: "Invalid refresh token" };
  }
}

export async function updateUserPassword(
  userId: string,
  password: string
): Promise<{ user: AuthUser | null; error: string | null }> {
  if (!password || password.length < 6) {
    return { user: null, error: "Password must be at least 6 characters" };
  }
  const hash = bcrypt.hashSync(password, 10);
  await query(
    `UPDATE auth.users SET encrypted_password = $1, updated_at = now() WHERE id = $2`,
    [hash, userId]
  );
  const user = await getUserById(userId);
  return { user, error: null };
}

export async function updateUserMetadata(
  userId: string,
  data: Record<string, unknown>
): Promise<{ user: AuthUser | null; error: string | null }> {
  await query(
    `UPDATE auth.users
     SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || $1::jsonb,
         updated_at = now()
     WHERE id = $2`,
    [JSON.stringify(data), userId]
  );
  if (typeof data.full_name === "string" || typeof data.phone === "string") {
    await query(
      `UPDATE profiles SET
         full_name = COALESCE($1, full_name),
         phone = COALESCE($2, phone),
         updated_at = now()
       WHERE id = $3`,
      [
        typeof data.full_name === "string" ? data.full_name : null,
        typeof data.phone === "string" ? data.phone : null,
        userId,
      ]
    ).catch(() => {});
  }
  const user = await getUserById(userId);
  return { user, error: null };
}

// ---------------------------------------------------------------------------
// Password reset. The emailed token is random; only its SHA-256 is stored
// (auth.users.recovery_token), and it works once, for one hour.
// ---------------------------------------------------------------------------

const RECOVERY_TTL_MIN = 60;
const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Make a reset token for this email. Null when there is no such user, or one
 *  was sent in the last minute (stops inbox flooding). */
export async function createRecoveryToken(
  emailRaw: string
): Promise<{ token: string; email: string } | null> {
  const email = String(emailRaw || "").trim().toLowerCase();
  if (!email) return null;
  const { rows } = await query(
    `SELECT id, email, recovery_sent_at FROM auth.users
      WHERE lower(email) = $1 AND deleted_at IS NULL LIMIT 1`,
    [email]
  );
  const user = rows[0];
  if (!user) return null;
  if (user.recovery_sent_at && Date.now() - new Date(user.recovery_sent_at).getTime() < 60_000) {
    return null;
  }
  const token = randomBytes(32).toString("base64url");
  await query(
    `UPDATE auth.users SET recovery_token = $1, recovery_sent_at = now(), updated_at = now() WHERE id = $2`,
    [sha256(token), user.id]
  );
  return { token, email: user.email };
}

/** Set a new password using an emailed token. The token is cleared on use. */
export async function resetPasswordWithToken(
  token: string,
  password: string
): Promise<{ ok: boolean; error: string | null }> {
  if (!token || token.length < 20) return { ok: false, error: "This reset link is not valid." };
  if (!password || password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters" };
  }
  const { rows } = await query(
    `UPDATE auth.users
        SET encrypted_password = $1, recovery_token = '', recovery_sent_at = NULL, updated_at = now()
      WHERE recovery_token = $2
        AND recovery_sent_at > now() - ($3 || ' minutes')::interval
        AND deleted_at IS NULL
      RETURNING id`,
    [bcrypt.hashSync(password, 10), sha256(token), String(RECOVERY_TTL_MIN)]
  );
  if (!rows[0]) {
    return { ok: false, error: "This reset link has expired or was already used. Ask for a new one." };
  }
  return { ok: true, error: null };
}

// ---------------------------------------------------------------------------
// Google sign-in. Google has already checked the email, so a verified Google
// email signs in to the account with that email, or makes a new one.
// ---------------------------------------------------------------------------

export interface GoogleProfile {
  sub: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  givenName?: string;
  familyName?: string;
  picture?: string;
}

export async function signInWithGoogle(
  p: GoogleProfile
): Promise<{ session: SessionTokens | null; isNew: boolean; error: string | null }> {
  const email = String(p.email || "").trim().toLowerCase();
  if (!p.sub || !email) return { session: null, isNew: false, error: "Google did not share an email address." };
  if (!p.emailVerified) {
    return { session: null, isNew: false, error: "This Google account's email is not verified." };
  }

  const fullName = (p.name || [p.givenName, p.familyName].filter(Boolean).join(" ")).trim();
  const { rows: found } = await query(
    `SELECT id FROM auth.users
      WHERE deleted_at IS NULL
        AND (raw_app_meta_data->>'google_sub' = $1 OR lower(email) = $2)
      ORDER BY (raw_app_meta_data->>'google_sub' = $1) DESC NULLS LAST
      LIMIT 1`,
    [p.sub, email]
  );

  let id: string;
  let isNew = false;
  if (found[0]) {
    id = found[0].id;
    // Link Google to the account and keep any name/photo already saved.
    await query(
      `UPDATE auth.users
          SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                || jsonb_build_object(
                     'google_sub', $2::text,
                     'providers', (
                       SELECT jsonb_agg(DISTINCT v) FROM jsonb_array_elements_text(
                         COALESCE(raw_app_meta_data->'providers', '[]'::jsonb) || '["google"]'::jsonb
                       ) AS v
                     )
                   ),
              raw_user_meta_data = jsonb_strip_nulls(jsonb_build_object(
                     'full_name', NULLIF($3, ''), 'first_name', NULLIF($4, ''),
                     'last_name', NULLIF($5, ''), 'avatar_url', NULLIF($6, '')
                   )) || COALESCE(raw_user_meta_data, '{}'::jsonb),
              email_confirmed_at = COALESCE(email_confirmed_at, now()),
              last_sign_in_at = now(),
              updated_at = now()
        WHERE id = $1`,
      [id, p.sub, fullName, p.givenName || "", p.familyName || "", p.picture || ""]
    );
    await query(
      `INSERT INTO profiles (id, email, full_name, avatar_url, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'customer', now(), now())
       ON CONFLICT (id) DO UPDATE SET
         full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
         avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url)`,
      [id, email, fullName || email.split("@")[0], p.picture || null]
    ).catch(() => {});
  } else {
    id = randomUUID();
    isNew = true;
    const meta = {
      full_name: fullName || undefined,
      first_name: p.givenName || undefined,
      last_name: p.familyName || undefined,
      avatar_url: p.picture || undefined,
    };
    // No password: they sign in with Google, or set one with "Forgot password".
    await query(
      `INSERT INTO auth.users (
         id, instance_id, aud, role, email, encrypted_password,
         email_confirmed_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
         created_at, updated_at, confirmation_token, recovery_token,
         email_change_token_new, email_change
       ) VALUES (
         $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         $2, NULL, now(), now(),
         jsonb_build_object('provider', 'google', 'providers', '["google"]'::jsonb, 'google_sub', $3::text),
         $4::jsonb, now(), now(), '', '', '', ''
       )`,
      [id, email, p.sub, JSON.stringify(meta)]
    );
    await query(
      `INSERT INTO profiles (id, email, full_name, avatar_url, role, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'customer', now(), now())
       ON CONFLICT (id) DO UPDATE SET
         full_name = COALESCE(NULLIF(profiles.full_name, ''), EXCLUDED.full_name),
         avatar_url = COALESCE(profiles.avatar_url, EXCLUDED.avatar_url),
         updated_at = now()`,
      [id, email, fullName || email.split("@")[0], p.picture || null]
    ).catch(() => {});
  }

  const { rows } = await query(`SELECT * FROM auth.users WHERE id = $1`, [id]);
  if (!rows[0]) return { session: null, isNew, error: "Could not sign in. Please try again." };
  const session = await mintSession(rows[0]);
  return { session, isNew, error: null };
}
