import { useState, useEffect, useRef } from "react";

const CREAM = "#F5EDE0";
const TERRA = "#C4714A";

const fetchSheet = async name => {
  const res = await fetch(`/api/sheets?sheet=${encodeURIComponent(name)}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet "${name}" not found`);
  const rows = await res.json();
  if (rows.length < 2) return [];
  const headers = rows[0].map(h => String(h).trim());
  return rows.slice(1).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])));
};

const buildSystemPrompt = (details, context) => {
  const facts = context.map(r => `• ${r.fact}`).join("\n");
  return `You are the Wedding Butler — warm, charming, and just a little cheeky. You're ${details.partner1} and ${details.partner2}'s deeply informed best friend who's had one glass of something nice.

WEDDING DETAILS:
• Couple: ${details.partner1} & ${details.partner2}
• Date: ${details.date_display}, ${details.time_display}
• Venue: ${details.venue_name}, ${details.venue_location}
• Dress code: ${details.dress_code}

ABOUT THE COUPLE & EVENT:
${facts}

YOUR STYLE:
• Keep replies to 2–3 sentences max
• Playful, never stuffy
• If unsure of something, say "I'll check with the couple"`;
};

const FALLBACK = {
  details: {
    partner1: "Alex", partner2: "Courtney",
    date_display: "Friday, 9 April 2027",
    date_iso: "2027-04-09T16:00:00+11:00",
    time_display: "4:00pm",
    venue_name: "The Farm Yarra Valley",
    venue_location: "Warrandyte South, Victoria",
    dress_code: "Cocktail attire",
  },
  faqs: [
    { question: "Where can I stay?", answer: "The Yarra Valley has beautiful accommodation to suit all budgets — Healesville, Warrandyte, and Lilydale are all close by. Book early, April is lovely up here." },
    { question: "Can I take a taxi or Uber?", answer: "Uber works but can be limited given the rural setting — especially late at night. We recommend staying nearby or carpooling. More details to come." },
    { question: "What's the dress code?", answer: "Cocktail attire. Bring a layer for the April evening, and think about the farm terrain if you're in heels." },
    { question: "Are children welcome?", answer: "Babes in arms are absolutely welcome. For older little ones who are walking and talking, we'd love this to be a night off for parents — please reach out if you have questions." },
  ],
  context: [
    { fact: "Reggie is their border collie who acts exactly like a golden retriever and will be very pleased to meet everyone" },
    { fact: "Alex follows the Melbourne Demons (AFL) and has many allergies" },
    { fact: "Courtney follows the Western Bulldogs (AFL) and is very serious about her cafe lattes" },
    { fact: "The Farm Yarra Valley is a stunning working farm with rolling hills and golden hour light" },
  ],
};

// ── Botanical SVG decorations ─────────────────────────────────────────────────
const Botanical = ({ pos }) => {
  const configs = {
    topLeft: {
      s: { position: "absolute", top: -8, left: -8, width: 210, height: 210, opacity: 0.22, pointerEvents: "none" },
      paths: [
        "M 14 198 Q 38 158 55 118 Q 72 80 95 52",
        "M 95 52 C 118 24 172 8 178 30 C 184 52 120 72 95 52 Z",
        "M 95 52 L 175 30",
        "M 68 84 C 46 60 6 62 6 82 C 6 102 44 108 68 84 Z",
        "M 68 84 L 7 82",
        "M 52 118 C 76 98 126 100 126 118 C 126 136 80 138 52 118 Z",
        "M 52 118 L 124 118",
        "M 36 154 C 14 136 2 154 5 172 C 8 190 34 182 36 154 Z",
        "M 36 154 L 6 170",
        "M 80 74 C 64 54 50 48 54 62 C 58 76 72 82 80 74 Z",
        "M 80 74 L 54 62",
      ],
    },
    bottomRight: {
      s: { position: "absolute", bottom: -8, right: -8, width: 210, height: 210, opacity: 0.22, pointerEvents: "none" },
      paths: ["M192 15 Q155 75 100 118","M100 118 Q78 150 56 175","M100 118 Q122 140 99 163","M99 163 Q82 180 70 168","M99 163 Q110 185 88 191","M56 175 Q38 192 26 180","M56 175 Q66 195 44 199","M138 84 Q154 100 136 114","M136 114 Q120 126 126 138","M162 54 Q178 66 165 80"],
    },
    topRight: {
      s: { position: "absolute", top: -8, right: -8, width: 160, height: 160, opacity: 0.18, pointerEvents: "none" },
      paths: ["M185 18 Q145 62 102 94","M102 94 Q82 114 60 136","M102 94 Q124 83 118 65","M118 65 Q132 46 120 36","M60 136 Q44 152 32 140"],
    },
  };
  const { s, paths } = configs[pos];
  return (
    <svg viewBox="0 0 200 200" style={s}>
      <g fill="none" stroke={CREAM} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        {paths.map((d, i) => <path key={i} d={d} />)}
      </g>
    </svg>
  );
};

const pad = n => String(n ?? 0).padStart(2, "0");

const INPUT = {
  background: "rgba(0,0,0,0.14)", border: "1px solid rgba(245,237,224,0.22)",
  borderRadius: 4, color: CREAM, fontFamily: "'Jost', sans-serif",
  fontSize: 14, fontWeight: 300, padding: "12px 16px", outline: "none",
  width: "100%", boxSizing: "border-box",
};

export default function WeddingInvite() {
  const [tab, setTab]                 = useState("invite");
  const [timeLeft, setTimeLeft]       = useState({});
  const [sheetData, setSheetData]     = useState(null);
  const [messages, setMessages]       = useState([{
    role: "assistant",
    content: "G'day! I'm the Wedding Butler 🐾 Ask me anything — dress code, the venue, whether Reggie will be there (yes, obviously, and he's very excited).",
  }]);
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [inviteCode]                  = useState(() => new URLSearchParams(window.location.search).get("invite") || "");
  const [guestRecord, setGuestRecord] = useState(() => new URLSearchParams(window.location.search).get("invite") ? null : false);
  const [rsvp, setRsvp]               = useState({ p1_attending: "yes", p1_dietary: "", p2_attending: "yes", p2_dietary: "" });
  const [rsvpStep, setRsvpStep]       = useState("form");
  const [poem, setPoem]               = useState("");
  const [faqOpen, setFaqOpen]         = useState(null);
  const chatEndRef                    = useRef(null);

  // ── Fonts + CSS ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400;1,600&family=Jost:wght@300;400;500&display=swap";
    document.head.appendChild(link);
    const style = document.createElement("style");
    style.textContent = `
      input::placeholder { color: rgba(245,237,224,0.4); }
      * { box-sizing: border-box; } body { margin: 0; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-thumb { background: rgba(245,237,224,0.2); border-radius: 2px; }
      @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
      @keyframes pulse  { 0%,100%{opacity:0.4} 50%{opacity:1} }
      .fade-up { animation: fadeUp 0.5s ease forwards; }
      .tab-btn:hover  { opacity: 1 !important; }
      .rsvp-opt:hover { background: rgba(245,237,224,0.15) !important; }
      .cta-btn:hover  { background: rgba(245,237,224,0.12) !important; }
    `;
    document.head.appendChild(style);
  }, []);

  // ── Fetch Google Sheets ───────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([
      fetchSheet("details"),
      fetchSheet("faqs"),
      fetchSheet("butler_context"),
    ]).then(([detailsRows, faqs, context]) => {
      const details = Object.fromEntries(detailsRows.map(r => [r.key, r.value]));
      setSheetData({ details, faqs, context });
    }).catch(err => { console.warn("Sheet fetch failed, using fallback:", err); setSheetData({}); });
  }, []);

  // ── Countdown ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const iso = sheetData?.details?.date_iso ?? FALLBACK.details.date_iso;
    const target = new Date(iso);
    const tick = () => {
      const diff = target - new Date();
      if (diff <= 0) { setTimeLeft({ done: true }); return; }
      setTimeLeft({
        days:  Math.floor(diff / 86400000),
        hours: Math.floor((diff % 86400000) / 3600000),
        mins:  Math.floor((diff % 3600000)  / 60000),
        secs:  Math.floor((diff % 60000)    / 1000),
      });
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [sheetData]);

  // ── Guest lookup by invite code ───────────────────────────────────────────────
  useEffect(() => {
    if (!inviteCode) return;
    fetchSheet("rsvps").then(rows => {
      const idx = rows.findIndex(r => r.invite_code?.trim() === inviteCode.trim());
      if (idx === -1) { setGuestRecord(false); return; }
      const r = rows[idx];
      setGuestRecord({ p1_name: r.p1_name || "", p2_name: r.p2_name || "", row_index: idx + 2 });
    }).catch(() => setGuestRecord(false));
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  // ── Derived data ──────────────────────────────────────────────────────────────
  const details   = sheetData?.details  ?? FALLBACK.details;
  const faqs      = sheetData?.faqs     ?? FALLBACK.faqs;
  const context   = sheetData?.context  ?? FALLBACK.context;
  const sysPrompt = buildSystemPrompt(details, context);

  // ── Chat ──────────────────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetch("/api/anthropic/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: sysPrompt,
          messages: updated.map(m => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      setMessages([...updated, { role: "assistant", content: data.content?.[0]?.text || "One moment..." }]);
    } catch {
      setMessages([...updated, { role: "assistant", content: "The champagne went to my circuits — try again!" }]);
    }
    setChatLoading(false);
  };

  // ── RSVP submit ───────────────────────────────────────────────────────────────
  const submitRsvp = async () => {
    if (!guestRecord) return;
    setRsvpStep("loading");

    fetch("/api/rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invite_code:  inviteCode,
        row_index:    guestRecord.row_index,
        p1_attending: rsvp.p1_attending,
        p1_dietary:   rsvp.p1_dietary,
        p2_attending: guestRecord.p2_name ? rsvp.p2_attending : "",
        p2_dietary:   guestRecord.p2_name ? rsvp.p2_dietary   : "",
      }),
    }).catch(() => {});

    const facts  = context.map(r => r.fact).join("; ");
    const guests = [
      { name: guestRecord.p1_name, attending: rsvp.p1_attending === "yes", dietary: rsvp.p1_dietary },
      ...(guestRecord.p2_name ? [{ name: guestRecord.p2_name, attending: rsvp.p2_attending === "yes", dietary: rsvp.p2_dietary }] : []),
    ];
    const allYes  = guests.every(g => g.attending);
    const allNo   = guests.every(g => !g.attending);
    const nameStr = guests.length === 1 ? guests[0].name : `${guests[0].name} and ${guests[1].name}`;
    const dietary = guests.filter(g => g.attending && g.dietary).map(g => `${g.name}: ${g.dietary}`).join("; ");

    let prompt;
    if (allYes) {
      prompt = `Write a warm, funny 4-line rhyming poem welcoming ${nameStr} to ${details.partner1} & ${details.partner2}'s wedding at ${details.venue_name} on ${details.date_display}. Draw from these facts: ${facts}. Celebratory.${dietary ? ` Dietary notes: ${dietary}.` : ""} Return only the poem.`;
    } else if (allNo) {
      prompt = `Write a warm, funny 4-line rhyming poem for ${nameStr} who sadly cannot attend ${details.partner1} & ${details.partner2}'s wedding. Draw from: ${facts}. Sweet and sympathetic. Return only the poem.`;
    } else {
      const yes = guests.filter(g =>  g.attending).map(g => g.name).join(" and ");
      const no  = guests.filter(g => !g.attending).map(g => g.name).join(" and ");
      prompt = `Write a warm, funny 4-line rhyming poem: ${yes} will celebrate at ${details.partner1} & ${details.partner2}'s wedding but ${no} sadly cannot make it. Draw from: ${facts}. Bittersweet but warm. Return only the poem.`;
    }

    try {
      const res = await fetch("/api/anthropic/v1/messages", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      setPoem(data.content?.[0]?.text || "You are the poem. See you there. 🌿");
    } catch {
      setPoem("The Yarra Valley awaits.\nUntil then 🌿");
    }
    setRsvpStep("poem");
  };

  // ── Nav ───────────────────────────────────────────────────────────────────────
  const NavBar = () => (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, display: "flex",
      justifyContent: "center", background: "rgba(150,80,45,0.88)",
      backdropFilter: "blur(12px)", borderTop: "1px solid rgba(245,237,224,0.12)", zIndex: 100,
    }}>
      {[["invite","Invite"],["chat","Butler"],["rsvp","RSVP"],["faq","FAQs"]].map(([t, label]) => (
        <button key={t} className="tab-btn" onClick={() => setTab(t)} style={{
          flex: 1, maxWidth: 120, background: "transparent", border: "none", color: CREAM,
          fontFamily: "'Jost', sans-serif", fontWeight: 400, letterSpacing: "0.14em",
          fontSize: 10, textTransform: "uppercase", padding: "14px 0", cursor: "pointer",
          opacity: tab === t ? 1 : 0.42,
          borderTop: tab === t ? `2px solid ${CREAM}` : "2px solid transparent",
          transition: "all 0.2s",
        }}>
          {label}
        </button>
      ))}
    </div>
  );

  // ── Render ────────────────────────────────────────────────────────────────────
  if (sheetData === null) return (
    <div style={{ background: TERRA, minHeight: "100vh" }} />
  );

  return (
    <div style={{ background: TERRA, minHeight: "100vh", fontFamily: "'Cormorant Garamond', Georgia, serif", color: CREAM }}>

      {/* ── INVITE ── */}
      {tab === "invite" && (
        <div className="fade-up" style={{
          position: "relative", minHeight: "100vh", overflow: "hidden",
          display: "flex", flexDirection: "column", alignItems: "center",
          justifyContent: "center", padding: "60px 28px 100px",
        }}>
          <Botanical pos="topLeft" />
          <Botanical pos="bottomRight" />

          <p style={{ fontStyle: "italic", fontWeight: 300, fontSize: 15, letterSpacing: "0.06em", opacity: 0.72, margin: "0 0 10px" }}>
            together with their families
          </p>
          <h1 style={{ fontSize: "clamp(56px, 15vw, 96px)", fontWeight: 300, margin: 0, lineHeight: 0.95, textAlign: "center" }}>
            {details.partner1}
          </h1>
          <p style={{ fontStyle: "italic", fontWeight: 300, fontSize: "clamp(20px, 4.5vw, 28px)", opacity: 0.65, margin: "8px 0", letterSpacing: "0.04em" }}>
            &amp;
          </p>
          <h1 style={{ fontSize: "clamp(56px, 15vw, 96px)", fontWeight: 300, margin: "0 0 36px", lineHeight: 0.95, textAlign: "center" }}>
            {details.partner2}
          </h1>

          <div style={{ width: 52, height: 1, background: CREAM, opacity: 0.35, marginBottom: 30 }} />

          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, letterSpacing: "0.14em", fontSize: 11, textTransform: "uppercase", opacity: 0.65, margin: "0 0 8px", textAlign: "center" }}>
            {details.date_display} · {details.time_display}
          </p>
          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: 14, opacity: 0.82, margin: "0 0 4px" }}>
            {details.venue_name}
          </p>
          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: 12, opacity: 0.55, margin: "0 0 40px" }}>
            {details.venue_location}
          </p>

          {!timeLeft.done && timeLeft.days !== undefined && (
            <div style={{ display: "flex", gap: 24, marginBottom: 48 }}>
              {[["days", timeLeft.days],["hrs", timeLeft.hours],["min", timeLeft.mins],["sec", timeLeft.secs]].map(([label, val]) => (
                <div key={label} style={{ textAlign: "center", minWidth: 44 }}>
                  <div style={{ fontSize: "clamp(30px, 8vw, 46px)", fontWeight: 300, lineHeight: 1 }}>{pad(val)}</div>
                  <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.5, marginTop: 5 }}>{label}</div>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <button className="cta-btn" onClick={() => setTab("rsvp")} style={{
              background: "transparent", border: `1px solid ${CREAM}`, color: CREAM,
              fontFamily: "'Jost',sans-serif", fontWeight: 400, letterSpacing: "0.2em",
              fontSize: 11, textTransform: "uppercase", padding: "13px 44px", cursor: "pointer",
            }}>
              RSVP
            </button>
            <button onClick={() => setTab("chat")} style={{
              background: "transparent", border: "none", color: CREAM,
              fontFamily: "'Jost',sans-serif", fontWeight: 300, letterSpacing: "0.1em",
              fontSize: 11, textTransform: "uppercase", opacity: 0.6, cursor: "pointer",
              textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 5,
            }}>
              Chat with the Wedding Butler
            </button>
          </div>

          <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, letterSpacing: "0.1em", fontSize: 10, opacity: 0.42, marginTop: 52, textTransform: "uppercase" }}>
            {details.dress_code}
          </p>
        </div>
      )}

      {/* ── CHAT ── */}
      {tab === "chat" && (
        <div className="fade-up" style={{ minHeight: "100vh", display: "flex", flexDirection: "column", maxWidth: 580, margin: "0 auto" }}>
          <div style={{ padding: "32px 24px 18px", borderBottom: "1px solid rgba(245,237,224,0.12)", position: "relative", overflow: "hidden" }}>
            <Botanical pos="topRight" />
            <h2 style={{ margin: 0, fontWeight: 300, fontSize: 32, lineHeight: 1 }}>Wedding Butler</h2>
            <p style={{ margin: "6px 0 0", fontFamily: "'Jost',sans-serif", fontSize: 11, fontWeight: 300, opacity: 0.52, letterSpacing: "0.06em" }}>
              Powered by Claude · Knows all the things
            </p>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "22px 24px", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 110 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "80%",
                background: m.role === "user" ? "rgba(245,237,224,0.16)" : "rgba(0,0,0,0.16)",
                borderRadius: m.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                padding: "11px 15px", fontSize: 15, lineHeight: 1.58, fontWeight: 300,
                animation: "fadeUp 0.3s ease",
              }}>
                {m.content}
              </div>
            ))}
            {chatLoading && (
              <div style={{ alignSelf: "flex-start", background: "rgba(0,0,0,0.16)", borderRadius: "18px 18px 18px 4px", padding: "11px 18px", animation: "pulse 1.2s infinite", fontSize: 18, opacity: 0.6 }}>···</div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div style={{
            position: "fixed", bottom: 48, left: "50%", transform: "translateX(-50%)",
            width: "100%", maxWidth: 580, padding: "14px 20px",
            background: "rgba(150,80,45,0.88)", backdropFilter: "blur(12px)",
            borderTop: "1px solid rgba(245,237,224,0.1)", display: "flex", gap: 10,
          }}>
            <input
              value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && sendChat()}
              placeholder="Ask anything about the day..."
              style={{ ...INPUT, flex: 1 }}
            />
            <button onClick={sendChat} disabled={chatLoading || !chatInput.trim()} style={{
              background: "rgba(245,237,224,0.14)", border: "1px solid rgba(245,237,224,0.2)",
              color: CREAM, borderRadius: 4, padding: "0 20px", cursor: "pointer",
              fontFamily: "'Jost',sans-serif", fontSize: 11, letterSpacing: "0.1em",
              textTransform: "uppercase", opacity: chatLoading || !chatInput.trim() ? 0.35 : 1,
              transition: "opacity 0.2s", whiteSpace: "nowrap",
            }}>
              Send
            </button>
          </div>
        </div>
      )}

      {/* ── RSVP ── */}
      {tab === "rsvp" && (
        <div className="fade-up" style={{
          minHeight: "100vh", display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          padding: "60px 28px 110px", position: "relative", overflow: "hidden",
        }}>
          <Botanical pos="topLeft" />

          {/* No invite code */}
          {!inviteCode && (
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <h2 style={{ fontSize: "clamp(38px,10vw,60px)", fontWeight: 300, margin: "0 0 20px", lineHeight: 1.05 }}>Your invitation</h2>
              <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: 14, opacity: 0.72, lineHeight: 1.8 }}>
                Use the QR code on your invitation or the personal link you were sent to RSVP.
              </p>
            </div>
          )}

          {/* Looking up invite code */}
          {inviteCode && guestRecord === null && (
            <p style={{ fontStyle: "italic", fontWeight: 300, fontSize: 16, opacity: 0.55 }}>Finding your invitation...</p>
          )}

          {/* Code not found */}
          {inviteCode && guestRecord === false && (
            <div style={{ textAlign: "center", maxWidth: 360 }}>
              <h2 style={{ fontSize: "clamp(32px,8vw,48px)", fontWeight: 300, margin: "0 0 16px", lineHeight: 1.05 }}>Hmm...</h2>
              <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: 14, opacity: 0.72, lineHeight: 1.8 }}>
                We couldn't find this invitation — double-check the QR code or link from your invitation.
              </p>
            </div>
          )}

          {/* Form */}
          {rsvpStep === "form" && guestRecord && (
            <div style={{ width: "100%", maxWidth: 400 }}>
              <p style={{ fontStyle: "italic", opacity: 0.65, margin: "0 0 6px", fontSize: 15, fontWeight: 300 }}>kindly reply</p>
              <h2 style={{ fontSize: "clamp(38px,10vw,60px)", fontWeight: 300, margin: "0 0 36px", lineHeight: 1.05 }}>
                Will you join us?
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {[
                  { name: guestRecord.p1_name, aKey: "p1_attending", dKey: "p1_dietary" },
                  ...(guestRecord.p2_name ? [{ name: guestRecord.p2_name, aKey: "p2_attending", dKey: "p2_dietary" }] : []),
                ].map(({ name, aKey, dKey }) => (
                  <div key={aKey}>
                    <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", opacity: 0.55, margin: "0 0 12px" }}>
                      {name}
                    </p>
                    <div style={{ display: "flex", gap: 10, marginBottom: rsvp[aKey] === "yes" ? 10 : 0 }}>
                      {[["yes","Joyfully accepts"],["no","Regretfully declines"]].map(([val, label]) => (
                        <button key={val} className="rsvp-opt" onClick={() => setRsvp({ ...rsvp, [aKey]: val })} style={{
                          flex: 1, background: rsvp[aKey] === val ? "rgba(245,237,224,0.18)" : "transparent",
                          border: `1px solid ${rsvp[aKey] === val ? CREAM : "rgba(245,237,224,0.28)"}`,
                          color: CREAM, fontFamily: "'Jost',sans-serif", fontWeight: 300,
                          letterSpacing: "0.06em", fontSize: 12, padding: "13px 10px",
                          cursor: "pointer", borderRadius: 4, transition: "all 0.2s",
                        }}>
                          {label}
                        </button>
                      ))}
                    </div>
                    {rsvp[aKey] === "yes" && (
                      <input value={rsvp[dKey]} onChange={e => setRsvp({ ...rsvp, [dKey]: e.target.value })}
                        placeholder="Dietary requirements (optional)" style={INPUT} />
                    )}
                  </div>
                ))}
                <button onClick={submitRsvp} style={{
                  background: "transparent", border: `1px solid ${CREAM}`, color: CREAM,
                  fontFamily: "'Jost',sans-serif", fontWeight: 400, letterSpacing: "0.18em",
                  fontSize: 11, textTransform: "uppercase", padding: "14px",
                  cursor: "pointer", marginTop: 6,
                }}>
                  Send RSVP
                </button>
              </div>
            </div>
          )}

          {rsvpStep === "loading" && (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 19, fontWeight: 300, fontStyle: "italic", opacity: 0.75 }}>The butler is composing something just for you...</p>
              <p style={{ fontSize: 26, animation: "pulse 1.4s infinite", marginTop: 12 }}>🌿</p>
            </div>
          )}

          {rsvpStep === "poem" && (
            <div className="fade-up" style={{ textAlign: "center", maxWidth: 420 }}>
              <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, letterSpacing: "0.14em", fontSize: 10, textTransform: "uppercase", opacity: 0.55, marginBottom: 24 }}>
                {(() => {
                  const attending = [rsvp.p1_attending === "yes", guestRecord?.p2_name && rsvp.p2_attending === "yes"].filter(Boolean).length;
                  const total     = guestRecord?.p2_name ? 2 : 1;
                  if (attending === total) return "See you in the Yarra Valley 🌿";
                  if (attending === 0)     return "You'll be greatly missed 🐾";
                  return "See some of you there 🌿";
                })()}
              </p>
              <div style={{ fontSize: "clamp(17px, 3.5vw, 21px)", fontWeight: 300, lineHeight: 1.85, fontStyle: "italic", whiteSpace: "pre-line" }}>
                {poem}
              </div>
              <div style={{ width: 44, height: 1, background: CREAM, opacity: 0.28, margin: "32px auto" }} />
              <p style={{ fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.1em", opacity: 0.45, textTransform: "uppercase" }}>
                {[guestRecord?.p1_name, guestRecord?.p2_name].filter(Boolean).join(" & ")} · {details.date_display}
              </p>
              <button onClick={() => setTab("chat")} style={{
                marginTop: 28, background: "none", border: "none", color: CREAM,
                fontFamily: "'Jost',sans-serif", fontSize: 10, letterSpacing: "0.12em",
                textTransform: "uppercase", cursor: "pointer", opacity: 0.55,
                textDecoration: "underline", textDecorationStyle: "dotted", textUnderlineOffset: 4,
              }}>
                Chat with the Wedding Butler
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── FAQs ── */}
      {tab === "faq" && (
        <div className="fade-up" style={{
          minHeight: "100vh", maxWidth: 580, margin: "0 auto",
          padding: "32px 24px 110px", display: "flex", flexDirection: "column",
          position: "relative", overflow: "hidden",
        }}>
          <Botanical pos="topRight" />
          <div style={{ paddingTop: 8 }}>
            <h2 style={{ margin: "0 0 6px", fontWeight: 300, fontSize: 32, lineHeight: 1 }}>Good questions</h2>
            <p style={{ margin: "0 0 36px", fontFamily: "'Jost',sans-serif", fontSize: 11, fontWeight: 300, opacity: 0.52, letterSpacing: "0.06em" }}>
              Everything you need to know
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {faqs.map((faq, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} style={{
                  borderTop: "1px solid rgba(245,237,224,0.15)",
                  ...(i === faqs.length - 1 ? { borderBottom: "1px solid rgba(245,237,224,0.15)" } : {}),
                }}>
                  <button onClick={() => setFaqOpen(open ? null : i)} style={{
                    width: "100%", background: "transparent", border: "none", color: CREAM,
                    cursor: "pointer", display: "flex", justifyContent: "space-between",
                    alignItems: "center", padding: "20px 0", textAlign: "left", gap: 16,
                  }}>
                    <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: "clamp(17px, 3.5vw, 20px)", fontWeight: 300, lineHeight: 1.3 }}>
                      {faq.question}
                    </span>
                    <span style={{
                      fontSize: 18, opacity: 0.55, flexShrink: 0, display: "inline-block",
                      transform: open ? "rotate(45deg)" : "rotate(0deg)", transition: "transform 0.25s ease",
                    }}>+</span>
                  </button>
                  {open && (
                    <div className="fade-up" style={{
                      paddingBottom: 22, fontFamily: "'Jost',sans-serif", fontWeight: 300,
                      fontSize: 14, lineHeight: 1.75, opacity: 0.82, letterSpacing: "0.02em",
                    }}>
                      {faq.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 48, paddingTop: 32, borderTop: "1px solid rgba(245,237,224,0.12)" }}>
            <p style={{ fontFamily: "'Jost',sans-serif", fontWeight: 300, fontSize: 12, opacity: 0.55, lineHeight: 1.7, marginBottom: 16 }}>
              Still have a question? Chat with the Wedding Butler — he knows everything.
            </p>
            <button onClick={() => setTab("chat")} style={{
              background: "transparent", border: `1px solid rgba(245,237,224,0.4)`, color: CREAM,
              fontFamily: "'Jost',sans-serif", fontWeight: 400, letterSpacing: "0.18em",
              fontSize: 10, textTransform: "uppercase", padding: "12px 28px", cursor: "pointer",
            }}>
              Ask the Butler
            </button>
          </div>
        </div>
      )}

      <NavBar />
    </div>
  );
}
