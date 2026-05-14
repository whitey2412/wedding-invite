import { GoogleAuth } from "google-auth-library";

const SHEET_ID = "1zbf88gIdxoCO1JGdpkCQE8zwcWI3f3hjr1A5Yap565s";

export default async function handler(req) {
  const sheet = new URL(req.url).searchParams.get("sheet");
  if (!sheet) return new Response("Missing sheet param", { status: 400 });

  try {
    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(sheet)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) {
      const err = await res.text();
      return new Response(`Sheet error: ${err}`, { status: res.status });
    }

    const { values = [] } = await res.json();
    return new Response(JSON.stringify(values), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}

export const config = { path: "/api/sheets" };
