import { createSign } from "node:crypto";

const toBase64Url = str =>
  Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const sigToBase64Url = sig =>
  sig.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function getAccessToken(serviceAccountJson) {
  const sa  = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);

  const header  = toBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = toBase64Url(JSON.stringify({
    iss:   sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud:   "https://oauth2.googleapis.com/token",
    exp:   now + 3600,
    iat:   now,
  }));

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  const signature = sigToBase64Url(signer.sign(sa.private_key, "base64"));

  const jwt  = `${header}.${payload}.${signature}`;
  const body = `grant_type=${encodeURIComponent("urn:ietf:params:oauth2:grant-type:jwt-bearer")}&assertion=${encodeURIComponent(jwt)}`;

  const res  = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = await res.json();
  if (!data.access_token) throw new Error(`Token error: ${JSON.stringify(data)}`);
  return data.access_token;
}

const SHEET_ID = "1zbf88gIdxoCO1JGdpkCQE8zwcWI3f3hjr1A5Yap565s";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { name, attending, dietary } = await req.json();

    const token     = await getAccessToken(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const timestamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" });

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/rsvps!A:D:append?valueInputOption=USER_ENTERED`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ values: [[timestamp, name, attending === "yes" ? "Attending" : "Declined", dietary || ""]] }),
      }
    );

    if (!res.ok) throw new Error(await res.text());
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("RSVP error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export const config = { path: "/api/rsvp" };
