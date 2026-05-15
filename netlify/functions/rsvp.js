import { GoogleAuth } from "google-auth-library";

const SHEET_ID = "1zbf88gIdxoCO1JGdpkCQE8zwcWI3f3hjr1A5Yap565s";

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  try {
    const { row_index, p1_attending, p1_dietary, p2_attending, p2_dietary, poem } = await req.json();

    const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
    const auth = new GoogleAuth({
      credentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();

    const timestamp = new Date().toLocaleString("en-AU", { timeZone: "Australia/Melbourne" });
    const range = `rsvps!D${row_index}:H${row_index}`;

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          range,
          majorDimension: "ROWS",
          values: [[
            p1_attending === "yes" ? "Attending" : "Declined",
            p1_dietary || "",
            p2_attending ? (p2_attending === "yes" ? "Attending" : "Declined") : "",
            p2_dietary || "",
            timestamp,
          ]],
        }),
      }
    );

    if (!res.ok) throw new Error(await res.text());

    if (poem) {
      const poemRange = `rsvps!J${row_index}`;
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(poemRange)}?valueInputOption=USER_ENTERED`,
        {
          method: "PUT",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ range: poemRange, majorDimension: "ROWS", values: [[poem]] }),
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { "Content-Type": "application/json" } });
  } catch (err) {
    console.error("RSVP error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
}

export const config = { path: "/api/rsvp" };
