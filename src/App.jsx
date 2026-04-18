import { useState, useRef, useCallback } from "react";

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY;

const SUPER_7 = [
  { spanish: "hay", english: "there is / there are", example: "Hay un elefante." },
  { spanish: "es", english: "is (description)", example: "El elefante es grande." },
  { spanish: "está", english: "is (feeling/location)", example: "Carlos está feliz." },
  { spanish: "tiene", english: "has", example: "El elefante tiene una nariz larga." },
  { spanish: "va", english: "goes", example: "Carlos va al parque." },
  { spanish: "quiere", english: "wants", example: "El ratón quiere un amigo." },
  { spanish: "le gusta", english: "likes", example: "Le gusta el chocolate." },
];

const INIT_WORDS = SUPER_7.map((w, i) => ({
  id: i + 1, ...w, episode: "Season 1 – Super 7", seen: 0, known: false,
}));

const TRANSCRIPT = `Hay un chico. El chico está en el parque. El nombre del chico es Carlos. Carlos está en el parque. Muchas personas están en el parque. Las personas corren en el parque. Carlos no corre en el parque. Carlos se sienta en el parque. Carlos mira las personas que corren, pero Carlos no corre. Carlos se sienta y mira.

En el parque, Carlos mira un elefante. El elefante no se sienta, el elefante corre. El elefante corre en el parque. Carlos se levanta y mira el elefante. Carlos corre también. Carlos corre al elefante.

El elefante mira Carlos. El elefante para – no corre más. El elefante se sienta y mira Carlos. Carlos corre. Carlos corre al elefante. El elefante se levanta y Carlos para.

El elefante mira a Carlos. Carlos mira el elefante. Carlos toca el elefante. El elefante toca Carlos. El elefante se sienta en el parque. Carlos se sienta en el elefante.

Entonces el elefante se levanta. Se levanta con Carlos. El elefante corre. Corre con Carlos.

Ahora Carlos se sienta en un elefante en el parque. Hay muchas personas en el parque. Carlos no mira las personas. Carlos mira el elefante. Las personas miran el elefante con el chico.

El fin.`;

const TENSES = [
  { key: "present", label: "Present", es: "presente" },
  { key: "preterite", label: "Past", es: "pretérito indefinido" },
  { key: "perfect", label: "Present Perfect", es: "pretérito perfecto" },
];

const TABS = ["📖 Words", "🃏 Cards", "🔀 Conjugation", "📄 Transcript", "➕ Add"];

async function claudeJSON(prompt) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  const txt = data.content?.map(b => b.text || "").join("") || "";
  const m = txt.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("No JSON in response");
  return JSON.parse(m[0]);
}

function SpeakBtn({ text, phonetic, setPhonetic }) {
  const ph = phonetic[text];
  const busy = ph === "…";
  const onClick = async () => {
    if (ph && ph !== "…") return;
    setPhonetic(p => ({ ...p, [text]: "…" }));
    try {
      const r = await claudeJSON(`Phonetic pronunciation of Spanish "${text}" for an English beginner. Reply ONLY with raw JSON: {"phonetic":"EL-eh-FAN-teh"}`);
      setPhonetic(p => ({ ...p, [text]: r.phonetic || "?" }));
    } catch { setPhonetic(p => ({ ...p, [text]: "?" })); }
  };
  return (
    <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center" }}>
      <button onClick={onClick} style={s.speakBtn}>{busy ? "⏳" : "🔊"}</button>
      {ph && ph !== "…" && <span style={s.phonetic}>{ph}</span>}
    </span>
  );
}

export default function App() {
  const [words, setWords] = useState(INIT_WORDS);
  const [tab, setTab] = useState(0);
  const [filter, setFilter] = useState("all");
  const [cardIdx, setCardIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [toast, setToast] = useState("");
  const [phonetic, setPhonetic] = useState({});

  const [selWord, setSelWord] = useState(null);
  const [lookup, setLookup] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);

  const [conjVerb, setConjVerb] = useState("");
  const [conjTense, setConjTense] = useState("present");
  const [conjData, setConjData] = useState(null);
  const [conjLoading, setConjLoading] = useState(false);
  const [conjIdx, setConjIdx] = useState(0);
  const [conjAnswer, setConjAnswer] = useState("");
  const [conjResult, setConjResult] = useState(null);
  const [conjScore, setConjScore] = useState({ correct: 0, total: 0 });

  const [form, setForm] = useState({ spanish: "", english: "", example: "", episode: "" });
  const [addLooking, setAddLooking] = useState(false);
  const addTimer = useRef(null);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const addWord = useCallback((wd) => {
    if (!wd.spanish || !wd.english) { showToast("Spanish & English required"); return false; }
    setWords(p => [{ id: Date.now(), spanish: wd.spanish.trim(), english: wd.english.trim(), example: wd.example?.trim() || "", episode: wd.episode?.trim() || "Manual", seen: 0, known: false }, ...p]);
    showToast(`Added "${wd.spanish.trim()}" ✓`);
    return true;
  }, []);

  const filtered = filter === "known" ? words.filter(w => w.known) : filter === "learning" ? words.filter(w => !w.known) : words;
  const fcWords = words.filter(w => !w.known);
  const curCard = fcWords[cardIdx % Math.max(fcWords.length, 1)];
  const knownCount = words.filter(w => w.known).length;
  const progress = Math.round((knownCount / words.length) * 100);
  const sp = { phonetic, setPhonetic };

  const markKnown = id => { setWords(p => p.map(w => w.id === id ? { ...w, known: true } : w)); setFlipped(false); setCardIdx(i => i + 1); showToast("¡Perfecto! 🎉"); };
  const markSeen = id => { setWords(p => p.map(w => w.id === id ? { ...w, seen: w.seen + 1 } : w)); setFlipped(false); setCardIdx(i => i + 1); };

  const handleWordTap = async raw => {
    const clean = raw.replace(/[.,!?¿¡"""''()\n–—]/g, "").trim().toLowerCase();
    if (clean.length < 2) return;
    setSelWord(clean); setLookup(null); setLookingUp(true);
    try {
      const r = await claudeJSON(`Spanish teacher for beginners. Word: "${clean}". Reply ONLY raw JSON: {"spanish":"${clean}","english":"simple meaning","type":"part of speech","example":"short example","beginner_tip":"one tip"}`);
      setLookup(r);
      if (!words.some(w => w.spanish.toLowerCase() === clean)) addWord({ spanish: r.spanish, english: r.english, example: r.example, episode: "Transcript" });
    } catch { setLookup({ spanish: clean, english: "Look-up failed", type: "", example: "", beginner_tip: "" }); }
    setLookingUp(false);
  };

  const loadConj = async (verb, tense) => {
    const v = verb || conjVerb; const t = tense || conjTense;
    if (!v.trim()) return;
    setConjLoading(true); setConjData(null); setConjIdx(0); setConjAnswer(""); setConjResult(null);
    const ti = TENSES.find(x => x.key === t);
    try {
      const r = await claudeJSON(`The user typed: "${v.trim()}". May be English or Spanish, may be conjugated. 1) Translate to Spanish if needed. 2) Find the infinitive. 3) Give ${ti.es} conjugation. Reply ONLY raw JSON: {"infinitive":"correr","meaning":"to run","tense":"${ti.label}","detected_input":"${v.trim()}","conjugations":[{"pronoun":"yo","form":"corro"},{"pronoun":"tú","form":"corres"},{"pronoun":"él/ella","form":"corre"},{"pronoun":"nosotros","form":"corremos"},{"pronoun":"vosotros","form":"corréis"},{"pronoun":"ellos/ellas","form":"corren"}]}`);
      setConjData(r);
      if (r.infinitive) setConjVerb(r.infinitive);
      setConjScore({ correct: 0, total: 0 });
    } catch (e) { showToast("Error: " + e.message); }
    setConjLoading(false);
  };

  const checkConj = () => {
    if (!conjData || conjResult) return;
    const ok = conjAnswer.toLowerCase().trim() === conjData.conjugations[conjIdx].form.toLowerCase().trim();
    setConjResult(ok ? "correct" : "wrong");
    setConjScore(sc => ({ correct: sc.correct + (ok ? 1 : 0), total: sc.total + 1 }));
  };
  const nextConj = () => { setConjIdx(i => (i + 1) % conjData.conjugations.length); setConjAnswer(""); setConjResult(null); };

  const handleAddSpanish = val => {
    setForm(f => ({ ...f, spanish: val, english: "", example: "" }));
    if (addTimer.current) clearTimeout(addTimer.current);
    if (val.trim().length < 2) return;
    addTimer.current = setTimeout(async () => {
      setAddLooking(true);
      try {
        const r = await claudeJSON(`Spanish word: "${val.trim()}". Reply ONLY raw JSON: {"english":"simple English meaning","example":"short Spanish example sentence"}`);
        setForm(f => ({ ...f, english: r.english || "", example: r.example || "" }));
      } catch {}
      setAddLooking(false);
    }, 700);
  };

  const curConj = conjData?.conjugations[conjIdx];

  if (!ANTHROPIC_API_KEY) {
    return (
      <div style={{ fontFamily: "Georgia, serif", maxWidth: 480, margin: "40px auto", padding: 24, background: "#fff3cd", borderRadius: 12, border: "1px solid #ffc107" }}>
        <h2 style={{ color: "#c0392b" }}>⚠️ API Key Missing</h2>
        <p>Create a <code>.env</code> file in the project root with:</p>
        <pre style={{ background: "#f8f9fa", padding: 12, borderRadius: 8 }}>VITE_ANTHROPIC_API_KEY=your_key_here</pre>
        <p>Get your API key at <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">console.anthropic.com</a></p>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.headerTop}><span style={{ fontSize: 36 }}>🌮</span><div><div style={s.title}>Mi Vocabulario</div><div style={s.subtitle}>Simple Stories in Spanish</div></div></div>
        <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${progress}%` }} /></div>
        <div style={s.progressLabel}>{knownCount}/{words.length} known · {progress}%</div>
      </div>

      <div style={s.content}>
        {tab === 0 && (
          <div>
            <div style={s.filterRow}>
              {["all","learning","known"].map(f => <button key={f} style={{ ...s.filterBtn, ...(filter===f?s.filterActive:{}) }} onClick={() => setFilter(f)}>{f==="all"?"All":f==="learning"?"Learning":"Known"}</button>)}
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filtered.length===0 && <div style={s.empty}>No words here yet!</div>}
              {filtered.map(w => (
                <div key={w.id} style={{ ...s.card, ...(w.known?{opacity:0.6}:{}) }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap" }}>
                        <span style={s.spanish}>{w.spanish}</span>
                        <SpeakBtn text={w.spanish} {...sp} />
                      </div>
                      <div style={s.english}>{w.english}</div>
                    </div>
                    <button style={{ ...s.badge, ...(w.known?s.badgeKnown:s.badgeLearning) }} onClick={() => setWords(p => p.map(x => x.id===w.id?{...x,known:!x.known}:x))}>
                      {w.known?"✓ Known":"Learning"}
                    </button>
                  </div>
                  {w.example && <div style={s.example}>"{w.example}"</div>}
                  <div style={s.episodeTag}>{w.episode} · seen {w.seen}×</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 1 && (
          fcWords.length === 0
          ? <div style={{ textAlign:"center", paddingTop:60, display:"flex", flexDirection:"column", alignItems:"center", gap:12 }}>
              <div style={{ fontSize:56 }}>🎊</div>
              <div style={{ fontSize:22, fontWeight:"bold", color:"#27ae60" }}>¡Lo sabes todo!</div>
              <div style={{ color:"#888", fontSize:14 }}>All words known. Add more from transcripts!</div>
            </div>
          : <div style={{ display:"flex", flexDirection:"column", alignItems:"center", paddingTop:20, gap:16 }}>
              <div style={{ color:"#aaa", fontSize:13 }}>{fcWords.length} left to learn</div>
              <div style={s.fcCard} onClick={() => setFlipped(f=>!f)}>
                {!flipped
                  ? <div style={{ textAlign:"center" }}><div style={{ fontSize:42, fontWeight:"bold", color:"#c0392b" }}>{curCard.spanish}</div><div style={{ fontSize:13, color:"#ccc", marginTop:12 }}>tap to reveal</div></div>
                  : <div style={{ textAlign:"center" }}><div style={{ fontSize:26, color:"#333", fontWeight:"bold" }}>{curCard.english}</div>{curCard.example&&<div style={{ fontSize:14, color:"#888", fontStyle:"italic", marginTop:12 }}>"{curCard.example}"</div>}</div>
                }
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}><SpeakBtn text={curCard.spanish} {...sp} /><span style={{ fontSize:13, color:"#aaa" }}>tap for pronunciation</span></div>
              <div style={{ fontSize:12, color:"#bbb" }}>{curCard.episode}</div>
              {flipped && <div style={{ display:"flex", gap:12, width:"100%" }}>
                <button style={s.fcStill} onClick={() => markSeen(curCard.id)}>Still learning</button>
                <button style={s.fcKnow} onClick={() => markKnown(curCard.id)}>I know it! ✓</button>
              </div>}
            </div>
        )}

        {tab === 2 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={s.sectionTitle}>🔀 Conjugation Quizzer</div>
            <div style={s.tipBox}>Type a verb (English or Spanish) and quiz yourself on all 6 forms.</div>
            <div style={{ display:"flex", gap:8 }}>
              <input style={{ ...s.input, flex:1 }} placeholder="e.g. run, correr, corrió…" value={conjVerb} onChange={e => setConjVerb(e.target.value)} onKeyDown={e => e.key==="Enter" && loadConj(conjVerb, conjTense)} />
              <button style={s.goBtn} onClick={() => loadConj(conjVerb, conjTense)}>{conjLoading?"…":"Go"}</button>
            </div>
            <div style={{ display:"flex", gap:8 }}>
              {TENSES.map(t => (
                <button key={t.key} style={{ ...s.tenseBtn, ...(conjTense===t.key?s.tenseBtnActive:{}) }} onClick={() => { setConjTense(t.key); if (conjVerb.trim()) loadConj(conjVerb, t.key); }}>{t.label}</button>
              ))}
            </div>
            <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
              {["ser","estar","tener","ir","querer","hablar","comer","vivir","poder","hacer"].map(v => (
                <button key={v} style={s.chipBtn} onClick={() => { setConjVerb(v); loadConj(v, conjTense); }}>{v}</button>
              ))}
            </div>
            <button style={{ ...s.chipBtn, color:"#1a73e8", borderColor:"#1a73e8", width:"100%", padding:"8px 0" }}
              onClick={() => conjVerb.trim() && window.open(`https://translate.google.com/?sl=auto&tl=es&text=${encodeURIComponent(conjVerb)}`, "_blank")}>
              🔍 Look up in Google Translate
            </button>
            {conjLoading && <div style={{ textAlign:"center", color:"#aaa", padding:20 }}>Loading…</div>}
            {conjData && !conjLoading && (
              <>
                <div style={s.conjScoreBar}>
                  <span>📊 {conjScore.correct}/{conjScore.total} correct</span>
                  <div style={{ textAlign:"right" }}>
                    {conjData.detected_input?.toLowerCase() !== conjData.infinitive?.toLowerCase() && <div style={{ fontSize:11, color:"#aaa" }}>"{conjData.detected_input}" → <strong>{conjData.infinitive}</strong></div>}
                    <span style={{ color:"#c0392b", fontWeight:"bold" }}>{conjData.infinitive} – {conjData.meaning}</span>
                  </div>
                </div>
                {words.some(w => w.spanish.toLowerCase() === conjData.infinitive?.toLowerCase())
                  ? <div style={s.autoAddedBadge}>✓ Already in My Words</div>
                  : <button style={s.addFromConjBtn} onClick={() => addWord({ spanish: conjData.infinitive, english: conjData.meaning, example: "", episode: "Conjugation tab" })}>＋ Add "{conjData.infinitive}" to My Words</button>
                }
                <div style={s.conjTable}>
                  {conjData.conjugations.map((c, i) => (
                    <div key={i} style={{ ...s.conjRow, ...(i===conjIdx?{ background:"#fdf0dc" }:{}) }}>
                      <span style={s.pronoun}>{c.pronoun}</span>
                      <span style={{ flex:1, fontSize:17, fontWeight:"bold", color:"#c0392b" }}>{c.form}</span>
                      <SpeakBtn text={`${c.pronoun} ${c.form}`} {...sp} />
                    </div>
                  ))}
                </div>
                <div style={s.sectionTitle}>Quiz Mode</div>
                <div style={s.conjCard}>
                  <div style={{ fontSize:32, fontWeight:"bold", color:"#555" }}>{curConj.pronoun}</div>
                  <div style={{ fontSize:15, color:"#aaa", fontStyle:"italic" }}>{conjData.infinitive}</div>
                  <input style={{ ...s.input, textAlign:"center", fontSize:20, marginTop:10, borderColor: conjResult==="correct"?"#27ae60":conjResult==="wrong"?"#e74c3c":"#ddd" }}
                    placeholder="Type the form…" value={conjAnswer}
                    onChange={e => { setConjAnswer(e.target.value); setConjResult(null); }}
                    onKeyDown={e => e.key==="Enter" && (conjResult ? nextConj() : checkConj())}
                    disabled={!!conjResult} />
                  {conjResult==="correct" && <div style={s.feedbackGood}>✓ ¡Correcto! — <strong>{curConj.form}</strong></div>}
                  {conjResult==="wrong" && <div style={s.feedbackBad}>✗ Answer: <strong>{curConj.form}</strong></div>}
                  <div style={{ display:"flex", gap:8, marginTop:12, width:"100%" }}>
                    {!conjResult ? <button style={s.fcKnow} onClick={checkConj}>Check ✓</button> : <button style={s.fcKnow} onClick={nextConj}>Next →</button>}
                    <span style={{ display:"flex", alignItems:"center" }}><SpeakBtn text={`${curConj.pronoun} ${curConj.form}`} {...sp} /></span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 3 && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={s.sectionTitle}>📄 Transcript Reader</div>
            <div style={s.tipBox}>💡 Tap any word to look it up and add to your list automatically.</div>
            <div style={s.storyBox}>
              <div style={{ fontSize:11, color:"#bbb", marginBottom:10 }}>
                <span style={{ color:"#e67e22" }}>■</span> saved &nbsp;·&nbsp; <span style={{ color:"#27ae60" }}>■</span> known
              </div>
              <div style={s.storyText}>
                {TRANSCRIPT.split(/(\s+)/).map((token, i) => {
                  const clean = token.replace(/[.,!?¿¡"""''()\n–—]/g,"").trim().toLowerCase();
                  const isWord = clean.length > 1;
                  const isSel = clean === selWord;
                  const isKnown = words.some(w => w.spanish.toLowerCase()===clean && w.known);
                  const isSaved = words.some(w => w.spanish.toLowerCase()===clean);
                  return <span key={i} onClick={() => isWord && handleWordTap(token)}
                    style={{ ...s.token, ...(isWord?{ cursor:"pointer" }:{}), ...(isSel?s.tokSel:isKnown?s.tokKnown:isSaved?s.tokSaved:{}) }}>{token}</span>;
                })}
              </div>
            </div>
            {selWord && (
              <div style={s.lookupPanel}>
                {lookingUp
                  ? <div style={{ color:"#aaa", textAlign:"center", padding:"12px 0" }}>Looking up <strong style={{ color:"#c0392b" }}>{selWord}</strong>…</div>
                  : lookup && <>
                      <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                        <span style={s.spanish}>{lookup.spanish}</span>
                        <span style={{ fontSize:13, color:"#aaa" }}>{lookup.type}</span>
                        <SpeakBtn text={lookup.spanish} {...sp} />
                      </div>
                      <div style={{ fontSize:18, color:"#333", marginTop:4 }}>{lookup.english}</div>
                      {lookup.example && <div style={s.example}>"{lookup.example}"</div>}
                      {lookup.beginner_tip && <div style={s.tipBox}>💡 {lookup.beginner_tip}</div>}
                      <div style={s.autoAddedBadge}>✓ Added to My Words &amp; Flashcards</div>
                    </>
                }
              </div>
            )}
          </div>
        )}

        {tab === 4 && (
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={s.sectionTitle}>Add a word manually</div>
            <div>
              <label style={s.label}>Spanish word *</label>
              <input style={s.input} placeholder="e.g. correr" value={form.spanish} onChange={e => handleAddSpanish(e.target.value)} />
            </div>
            <div>
              <label style={s.label}>English meaning {addLooking && <span style={{ color:"#e67e22", fontSize:11 }}>⏳ looking up…</span>}</label>
              <input style={s.input} placeholder={addLooking ? "Fetching…" : "e.g. to run"} value={form.english} onChange={e => setForm(f => ({ ...f, english: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Example sentence</label>
              <input style={s.input} placeholder="e.g. El elefante corre." value={form.example} onChange={e => setForm(f => ({ ...f, example: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Episode</label>
              <input style={s.input} placeholder="e.g. S1 E1" value={form.episode} onChange={e => setForm(f => ({ ...f, episode: e.target.value }))} />
            </div>
            <button style={s.addBtn} onClick={() => { if (addWord(form)) { setForm({ spanish:"", english:"", example:"", episode:"" }); setTab(0); } }}>Add Word ➕</button>
          </div>
        )}
      </div>

      <div style={s.nav}>
        {TABS.map((t,i) => <button key={i} style={{ ...s.navBtn, ...(tab===i?s.navActive:{}) }} onClick={() => setTab(i)}>{t}</button>)}
      </div>
      {toast && <div style={s.toast}>{toast}</div>}
    </div>
  );
}

const s = {
  root:{ fontFamily:"Georgia,serif", background:"#fdf6ee", minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:480, margin:"0 auto" },
  header:{ background:"linear-gradient(135deg,#c0392b,#e74c3c)", color:"#fff", padding:"20px 20px 14px" },
  headerTop:{ display:"flex", alignItems:"center", gap:12, marginBottom:14 },
  title:{ fontSize:22, fontWeight:"bold" }, subtitle:{ fontSize:12, opacity:0.85, marginTop:2 },
  progressBar:{ background:"rgba(255,255,255,0.3)", borderRadius:99, height:8, overflow:"hidden" },
  progressFill:{ background:"#fff", height:"100%", borderRadius:99, transition:"width 0.5s ease" },
  progressLabel:{ fontSize:12, opacity:0.9, marginTop:6, textAlign:"right" },
  content:{ flex:1, overflowY:"auto", padding:"14px 16px 90px" },
  nav:{ position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:480, background:"#fff", borderTop:"1px solid #e8ddd0", display:"flex", padding:"8px 0 10px" },
  navBtn:{ flex:1, border:"none", background:"none", fontSize:10, color:"#aaa", cursor:"pointer", padding:"6px 2px", fontFamily:"Georgia,serif" },
  navActive:{ color:"#c0392b", fontWeight:"bold" },
  toast:{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background:"#2ecc71", color:"#fff", padding:"10px 20px", borderRadius:99, fontSize:14, whiteSpace:"nowrap", boxShadow:"0 4px 12px rgba(0,0,0,0.15)", zIndex:100 },
  filterRow:{ display:"flex", gap:8, marginBottom:14 },
  filterBtn:{ flex:1, border:"1px solid #ddd", background:"#fff", borderRadius:8, padding:"8px 0", fontSize:13, color:"#888", cursor:"pointer", fontFamily:"Georgia,serif" },
  filterActive:{ background:"#c0392b", color:"#fff", borderColor:"#c0392b" },
  card:{ background:"#fff", borderRadius:12, padding:"14px 16px", border:"1px solid #ecdfd2", boxShadow:"0 1px 4px rgba(0,0,0,0.05)" },
  spanish:{ fontSize:20, fontWeight:"bold", color:"#c0392b" },
  english:{ fontSize:14, color:"#555", marginTop:2 },
  example:{ fontSize:13, color:"#888", fontStyle:"italic", marginTop:8 },
  episodeTag:{ fontSize:11, color:"#bbb", marginTop:8 },
  badge:{ borderRadius:99, border:"none", padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"Georgia,serif", whiteSpace:"nowrap" },
  badgeLearning:{ background:"#fdf0dc", color:"#c0392b" }, badgeKnown:{ background:"#d5f5e3", color:"#27ae60" },
  speakBtn:{ background:"none", border:"none", cursor:"pointer", fontSize:16, padding:"0 2px" },
  phonetic:{ fontSize:11, color:"#e67e22", fontStyle:"italic", textAlign:"center", maxWidth:80, wordBreak:"break-word" },
  empty:{ textAlign:"center", color:"#ccc", padding:40, fontSize:15 },
  fcCard:{ width:"100%", minHeight:200, background:"#fff", borderRadius:20, border:"2px solid #e8ddd0", boxShadow:"0 4px 20px rgba(0,0,0,0.08)", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:24, boxSizing:"border-box" },
  fcStill:{ flex:1, padding:"14px 0", borderRadius:12, border:"2px solid #e8ddd0", background:"#fff", color:"#888", fontSize:15, cursor:"pointer", fontFamily:"Georgia,serif" },
  fcKnow:{ flex:1, padding:"14px 0", borderRadius:12, border:"none", background:"#c0392b", color:"#fff", fontSize:15, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia,serif" },
  sectionTitle:{ fontSize:20, fontWeight:"bold", color:"#c0392b" },
  label:{ fontSize:13, color:"#888", display:"block", marginBottom:5 },
  input:{ width:"100%", border:"1px solid #ddd", borderRadius:10, padding:"11px 14px", fontSize:15, fontFamily:"Georgia,serif", outline:"none", background:"#fff", boxSizing:"border-box" },
  tipBox:{ background:"#fef9ec", border:"1px solid #f0e0b0", borderRadius:10, padding:"10px 14px", fontSize:13, color:"#8a6d00", lineHeight:1.5 },
  addBtn:{ background:"#c0392b", color:"#fff", border:"none", borderRadius:12, padding:"14px 0", fontSize:16, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia,serif", width:"100%" },
  storyBox:{ background:"#fff", borderRadius:12, border:"1px solid #ecdfd2", padding:"14px 16px" },
  storyText:{ fontSize:17, lineHeight:2.2, color:"#333" },
  token:{ display:"inline" },
  tokSel:{ background:"#fdf0dc", color:"#c0392b", fontWeight:"bold", borderRadius:4 },
  tokKnown:{ background:"#d5f5e3", borderRadius:4 },
  tokSaved:{ background:"#fef9ec", borderRadius:4 },
  lookupPanel:{ background:"#fff", borderRadius:14, border:"2px solid #e8ddd0", padding:"16px 18px", display:"flex", flexDirection:"column", gap:8 },
  autoAddedBadge:{ background:"#d5f5e3", color:"#27ae60", borderRadius:10, padding:"12px 0", fontSize:15, fontWeight:"bold", textAlign:"center" },
  goBtn:{ background:"#c0392b", color:"#fff", border:"none", borderRadius:10, padding:"11px 20px", fontSize:15, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia,serif", whiteSpace:"nowrap" },
  tenseBtn:{ flex:1, border:"1px solid #ecdfd2", background:"#fff", borderRadius:8, padding:"9px 0", fontSize:12, color:"#888", cursor:"pointer", fontFamily:"Georgia,serif" },
  tenseBtnActive:{ background:"#c0392b", color:"#fff", borderColor:"#c0392b", fontWeight:"bold" },
  chipBtn:{ background:"#fff", border:"1px solid #ecdfd2", borderRadius:99, padding:"5px 12px", fontSize:13, cursor:"pointer", fontFamily:"Georgia,serif", color:"#c0392b" },
  conjScoreBar:{ display:"flex", justifyContent:"space-between", alignItems:"center", background:"#fff", borderRadius:10, padding:"10px 14px", border:"1px solid #ecdfd2", fontSize:13, flexWrap:"wrap", gap:6 },
  conjTable:{ background:"#fff", borderRadius:12, border:"1px solid #ecdfd2", overflow:"hidden" },
  conjRow:{ display:"flex", alignItems:"center", padding:"10px 14px", borderBottom:"1px solid #f5ede4" },
  pronoun:{ width:90, fontSize:14, color:"#888", fontStyle:"italic" },
  conjCard:{ background:"#fff", borderRadius:16, border:"2px solid #ecdfd2", padding:"20px 18px", display:"flex", flexDirection:"column", alignItems:"center", gap:4 },
  feedbackGood:{ background:"#d5f5e3", color:"#27ae60", borderRadius:8, padding:"10px 14px", fontSize:15, textAlign:"center", width:"100%", boxSizing:"border-box", marginTop:4 },
  feedbackBad:{ background:"#fde8e8", color:"#e74c3c", borderRadius:8, padding:"10px 14px", fontSize:15, textAlign:"center", width:"100%", boxSizing:"border-box", marginTop:4 },
  addFromConjBtn:{ background:"#c0392b", color:"#fff", border:"none", borderRadius:10, padding:"12px 0", fontSize:15, fontWeight:"bold", cursor:"pointer", fontFamily:"Georgia,serif", width:"100%" },
};