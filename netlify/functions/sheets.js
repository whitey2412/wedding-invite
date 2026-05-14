const SHEET_ID = "1zbf88gIdxoCO1JGdpkCQE8zwcWI3f3hjr1A5Yap565s";

export default async function handler(req) {
  const sheet = new URL(req.url).searchParams.get("sheet");
  if (!sheet) return new Response("Missing sheet param", { status: 400 });

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) return new Response(`Sheet "${sheet}" not found`, { status: 404 });

  return new Response(await res.text(), {
    status: 200,
    headers: { "Content-Type": "text/csv" },
  });
}

export const config = { path: "/api/sheets" };
