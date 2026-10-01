import { useEffect, useMemo, useRef, useState } from "react";
import {
  Moon, Brain, Dumbbell, Droplets, Apple, BookOpen, Smartphone, Snowflake, Pencil, ClipboardCheck,
  Flame, Bell, BellRing, Trash2, Plus, Volume2, X, Target, Check, TrendingUp, ChevronUp, ChevronDown, Quote, Minus, Play, Activity, Music, User, Flower2, Sun, Leaf,
} from "lucide-react";
import logo from "./logo.png";

const KEY = "winterArc:v1";
const SLEEP_TARGET = 7;
const WIN_PCT = 70; // a day is won at 70% of your habits
const MONTH_GOAL = 0.8; // win 80% of the days in each month

const DEFAULT_HABITS = [
  { id: "sleep", label: "Sleep on schedule" }, { id: "work", label: "Deep work block" },
  { id: "workout", label: "Workout" }, { id: "water", label: "Hydration" },
  { id: "food", label: "Clean nutrition" }, { id: "skill", label: "Skill building" },
  { id: "detox", label: "Dopamine detox" }, { id: "cold", label: "Cold shower / breathwork" },
  { id: "reflect", label: "Evening reflection" }, { id: "log", label: "Accountability log" },
];
const ICONS = { sleep: Moon, work: Brain, workout: Dumbbell, water: Droplets, food: Apple, skill: BookOpen, detox: Smartphone, cold: Snowflake, reflect: Pencil, log: ClipboardCheck };
const QUOTES = [
  "Nobody is coming to save your season. Start anyway.",
  "Comfort is a slow way to lose. Do the hard thing first.",
  "You don't need motivation. You need the next rep.",
  "Cold mornings build warm futures.",
  "Miss one day and you've had a bad day. Miss two and you've started a habit.",
  "Your future self is watching what you do tonight.",
  "Small wins stacked daily beat big plans made once.",
  "Be the person who shows up when it's dark and cold.",
  "Discipline is a promise to yourself, kept quietly.",
  "Tired is temporary. Regret is not.",
];
const TABS = [["today", "Today", Check], ["progress", "Progress", TrendingUp], ["sleep", "Sleep", Moon], ["track", "Track", Activity], ["alarms", "Alarms", Bell]];
const TUNES = [
  { id: "chime", name: "Soft chime" }, { id: "beep", name: "Digital beep" }, { id: "siren", name: "Siren" },
  { id: "rise", name: "Rising melody" }, { id: "pulse", name: "Pulse" },
];
const DAYN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
// four seasons, three months each; the app follows the current one automatically
const SEASONS = [
  { name: "Spring Arc", months: "Jan–Mar", icon: Flower2 }, { name: "Summer Arc", months: "Apr–Jun", icon: Sun },
  { name: "Autumn Arc", months: "Jul–Sep", icon: Leaf }, { name: "Winter Arc", months: "Oct–Dec", icon: Snowflake },
];
const ageOf = (dob) => {
  if (!dob) return null;
  const b = new Date(dob + "T00:00:00"), t = new Date();
  if (isNaN(b)) return null;
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a >= 0 && a <= 120 ? a : null;
};

const pad = (n) => String(n).padStart(2, "0");
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const span = (s, c) => Array.from({ length: c }, (_, i) => addDays(s, i));
const itemsOf = (g) => g?.items || (g?.text ? [{ id: "legacy", text: g.text, done: false }] : []);
const mean = (a) => (a.length ? Math.round(a.reduce((s, v) => s + v, 0) / a.length) : 0);

const SCREEN = { id: "screen", name: "Screen time", unit: "h", target: 3, mode: "max" };
function load() {
  try {
    const r = JSON.parse(localStorage.getItem(KEY));
    return {
      logs: r?.logs || {}, sleep: r?.sleep || {}, alarms: r?.alarms || [], habits: r?.habits?.length ? r.habits : DEFAULT_HABITS,
      goals: r?.goals || {}, rings: r?.rings || [], profile: r?.profile || { name: "", dob: "", phone: "" },
      trackers: Array.isArray(r?.trackers) ? r.trackers : [{ ...SCREEN, target: r?.screenLimit ?? 3 }],
      tracks: r?.tracks || (r?.screen ? { screen: r.screen } : {}),
    };
  } catch { return { logs: {}, sleep: {}, alarms: [], habits: DEFAULT_HABITS, goals: {}, rings: [], profile: { name: "", dob: "", phone: "" }, trackers: [SCREEN], tracks: {} }; }
}

// user ringtones live in IndexedDB (too big for localStorage)
const idb = () => new Promise((res, rej) => { const r = indexedDB.open("winterArc", 1); r.onupgradeneeded = () => r.result.createObjectStore("rings"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const ringPut = async (id, v) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction("rings", "readwrite"); tx.objectStore("rings").put(v, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); };
const ringGet = async (id) => { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction("rings").objectStore("rings").get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
const ringDel = async (id) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction("rings", "readwrite"); tx.objectStore("rings").delete(id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); }); };

const TuneOptions = ({ rings }) => (
  <>
    {TUNES.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
    {rings.length > 0 && <optgroup label="From your device">{rings.map((r) => <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>)}</optgroup>}
  </>
);

function useChime() {
  const ctx = useRef(null);
  const unlock = () => {
    try {
      if (!ctx.current) ctx.current = new (window.AudioContext || window.webkitAudioContext)();
      if (ctx.current.state === "suspended") ctx.current.resume();
    } catch { /* audio unavailable */ }
  };
  const play = (tune = "chime") => {
    unlock();
    const c = ctx.current;
    if (!c) return;
    const t0 = c.currentTime;
    const note = (f, at, dur, type = "sine", vol = 0.3, f2) => {
      const o = c.createOscillator(), g = c.createGain(), t = t0 + at;
      o.type = type; o.frequency.setValueAtTime(f, t);
      if (f2) o.frequency.linearRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
    };
    if (tune === "beep") [0, 0.25, 0.5, 0.75].forEach((t) => note(1000, t, 0.15, "square", 0.25));
    else if (tune === "siren") { note(600, 0, 1, "sawtooth", 0.25, 1000); note(1000, 1, 1, "sawtooth", 0.25, 600); }
    else if (tune === "rise") [523, 659, 784, 1047].forEach((f, i) => note(f, i * 0.3, 0.45, "triangle", 0.35));
    else if (tune === "pulse") [0, 0.4, 0.8, 1.2].forEach((t, i) => note(i % 2 ? 660 : 880, t, 0.35, "square", 0.22));
    else [660, 880, 1320].forEach((f, i) => note(f, i * 0.22, 0.4, "sine", 0.3));
  };
  const el = useRef(null);
  const stop = () => { if (el.current) { el.current.a.pause(); URL.revokeObjectURL(el.current.url); el.current = null; } };
  const playCustom = async (id, loop = true) => {
    stop();
    try {
      const v = await ringGet(id);
      if (!v?.blob) return false;
      const url = URL.createObjectURL(v.blob), a = new Audio(url);
      a.loop = loop; el.current = { a, url };
      await a.play();
      return true;
    } catch { return false; }
  };
  return { unlock, play, playCustom, stop };
}

function LineChart({ points, max = 100, ticks = [0, 50, 100], target, tLabel = "target", unit = "h", showVals }) {
  const W = 320, H = 170, L = 28, R = 10, T = 16, B = 26, n = points.length;
  const x = (i) => L + (n === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (n - 1));
  const y = (v) => T + (1 - Math.min(v, max) / max) * (H - T - B);
  const segs = []; let cur = [];
  points.forEach((p, i) => {
    if (p.v == null) { if (cur.length) segs.push(cur); cur = []; } else cur.push([x(i), y(p.v)]);
  });
  if (cur.length) segs.push(cur);
  const step = Math.ceil(n / 7);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Line chart">
      <defs>
        <linearGradient id="lg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#ef4444" stopOpacity=".4" /><stop offset="1" stopColor="#ef4444" stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="#262626" />
          <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize="9" fill="#737373">{t}</text>
        </g>
      ))}
      {target != null && (
        <g>
          <line x1={L} x2={W - R} y1={y(target)} y2={y(target)} stroke="#fbbf24" strokeDasharray="4 4" />
          <text x={W - R} y={y(target) - 4} textAnchor="end" fontSize="9" fill="#fbbf24">{target}{unit} {tLabel}</text>
        </g>
      )}
      {segs.map((s, i) => (
        <g key={i}>
          {s.length > 1 && <path d={`M${s[0][0]},${H - B} ${s.map((p) => `L${p[0]},${p[1]}`).join(" ")} L${s[s.length - 1][0]},${H - B} Z`} fill="url(#lg)" />}
          <polyline points={s.map((p) => p.join(",")).join(" ")} fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
      {points.map((p, i) => (
        <g key={i}>
          {p.v != null && <circle cx={x(i)} cy={y(p.v)} r="3" fill="#000" stroke="#ef4444" strokeWidth="2" />}
          {p.v != null && showVals && <text x={x(i)} y={y(p.v) - 8} textAnchor="middle" fontSize="10" fill="#e5e5e5">{p.v}</text>}
          {i % step === 0 && <text x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#737373">{p.l}</text>}
        </g>
      ))}
    </svg>
  );
}

const Card = ({ title, icon: Icon, right, children }) => (
  <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-200"><Icon size={16} className="text-red-500" /> {title}</h2>
      {right}
    </div>
    {children}
  </section>
);

const Bar = ({ value, className = "bg-red-500" }) => (
  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-800">
    <div className={`h-full rounded-full transition-all duration-500 ${className}`} style={{ width: `${Math.min(100, value)}%` }} />
  </div>
);

export default function LifeArc() {
  const [data, setData] = useState(load);
  const [now, setNow] = useState(new Date());
  const [alert, setAlert] = useState(null);
  const [time, setTime] = useState("06:00");
  const [habit, setHabit] = useState("");
  const [tab, setTab] = useState("today");
  const [range, setRange] = useState("week");
  const [profOpen, setProfOpen] = useState(false);
  const [perm, setPerm] = useState("unknown");
  const [edit, setEdit] = useState(false);
  const [newH, setNewH] = useState("");
  const [snoozes, setSnoozes] = useState([]);
  const [tune, setTune] = useState("chime");
  const [days, setDays] = useState([]);
  const [trk, setTrk] = useState("screen");
  const [addingT, setAddingT] = useState(false);
  const [nt, setNt] = useState({ name: "", unit: "h", target: "1", mode: "min" });
  const [gIn, setGIn] = useState({});
  const alarmsRef = useRef([]);
  const { unlock, play, playCustom, stop } = useChime();
  const [ringMsg, setRingMsg] = useState("");

  const today = dk(now);
  const H = data.habits, n = H.length;
  const ids = H.map((h) => h.id);
  const score = (k) => ids.filter((id) => data.logs[k]?.[id]).length;
  const pctOf = (k) => Math.round((score(k) / n) * 100);
  const label = (id) => H.find((h) => h.id === id)?.label || "Habit";
  alarmsRef.current = data.alarms;
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* storage blocked */ }
  }, [data]);

  // notification permission: asked on first launch in the Android app, by button in the browser
  const readPerm = async () => {
    try {
      const LN = window.__LN;
      if (LN) { const r = await LN.checkPermissions(); setPerm(r.display === "granted" ? "granted" : r.display === "denied" ? "denied" : "prompt"); }
      else if (typeof Notification !== "undefined") setPerm(Notification.permission === "default" ? "prompt" : Notification.permission);
      else setPerm("unsupported");
    } catch { setPerm("unsupported"); }
  };
  const askPerm = async () => {
    unlock();
    try {
      if (window.__LN) await window.__LN.requestPermissions();
      else if (typeof Notification !== "undefined") await Notification.requestPermission();
    } catch { /* ignore */ }
    readPerm();
  };
  useEffect(() => { readPerm(); if (window.__LN) askPerm(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // native background alarms (Android app only)
  useEffect(() => {
    const LN = window.__LN;
    if (!LN) return;
    (async () => {
      try {
        const perm = await LN.requestPermissions();
        if (perm.display !== "granted") return;
        for (const t of TUNES) await LN.createChannel({ id: `alarm_${t.id}`, name: `Alarm: ${t.name}`, importance: 5, sound: `${t.id}.wav`, vibration: true, visibility: 1 });
        const pend = await LN.getPending();
        if (pend.notifications.length) await LN.cancel({ notifications: pend.notifications });
        const list = [];
        for (const a of data.alarms.filter((x) => x.armed)) {
          const [h, m] = a.time.split(":").map(Number);
          const rg = a.tune?.startsWith("custom:") ? dataRef.current.rings.find((r) => `custom:${r.id}` === a.tune) : null;
          const tn = rg ? "chime" : a.tune || "chime";
          let channelId = `alarm_${tn}`, sound = `${tn}.wav`;
          if (rg?.uri && window.__RP) {
            channelId = `alarm_sys_${[...rg.uri].reduce((x, c) => (x * 31 + c.charCodeAt(0)) | 0, 7).toString(36)}`;
            sound = undefined;
            await window.__RP.channel({ id: channelId, name: `Alarm: ${rg.name}`, uri: rg.uri });
          }
          const base = { title: "Life Arc", body: label(a.habit), channelId, sound, extra: { alarmId: a.id } };
          const slots = a.days?.length ? a.days.map((d) => ({ weekday: d + 1, hour: h, minute: m })) : [{ hour: h, minute: m }];
          slots.forEach((on, i) => list.push({ ...base, id: (a.id % 100000000) * 10 + i, schedule: { on, allowWhileIdle: true } }));
        }
        if (list.length) await LN.schedule({ notifications: list });
      } catch { /* notifications unavailable */ }
    })();
  }, [data.alarms]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // in-app alarm check: chosen weekdays (or every day), once per day, plus snoozed alarms
  useEffect(() => {
    const hm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const due = snoozes.find((x) => x.at <= now.getTime());
    if (due) { setSnoozes((q) => q.filter((x) => x !== due)); setAlert(due.alarm); return; }
    const hit = data.alarms.find((a) => a.armed && a.time === hm && a.fired !== today && (!a.days?.length || a.days.includes(now.getDay())));
    if (!hit) return;
    setData((d) => ({ ...d, alarms: d.alarms.map((a) => (a.id === hit.id ? { ...a, fired: today } : a)) }));
    setAlert(hit);
    try { if (!window.__LN && typeof Notification !== "undefined" && Notification.permission === "granted") new Notification("Life Arc", { body: label(hit.habit) }); } catch { /* unsupported */ }
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  // ring like a real alarm: loop tune (built-in or your own) + vibrate + keep screen awake
  useEffect(() => {
    if (!alert) return;
    const tn = alert.tune || "chime", custom = tn.startsWith("custom:");
    const vib = () => { try { navigator.vibrate?.([500, 200, 500, 200, 500]); } catch { /* unsupported */ } };
    let t, dead = false;
    const synth = () => { const r = () => { play(custom ? "chime" : tn); vib(); }; r(); t = setInterval(r, 2500); };
    const rg = custom ? dataRef.current.rings.find((r) => `custom:${r.id}` === tn) : null;
    if (rg?.uri && window.__RP) {
      vib(); t = setInterval(vib, 2500);
      window.__RP.play({ uri: rg.uri, loop: true }).catch(() => { if (!dead) { clearInterval(t); synth(); } });
    } else if (custom) {
      vib(); t = setInterval(vib, 2500);
      playCustom(tn.slice(7)).then((ok) => { if (!ok && !dead) { clearInterval(t); synth(); } });
    } else synth();
    let lock;
    try { navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {}); } catch { /* unsupported */ }
    return () => { dead = true; clearInterval(t); stop(); window.__RP?.stop().catch(() => {}); try { lock?.release(); navigator.vibrate?.(0); } catch { /* ignore */ } };
  }, [alert]); // eslint-disable-line react-hooks/exhaustive-deps

  // Android notification tap / delivery opens the ring screen
  useEffect(() => {
    const h = (e) => { const a = alarmsRef.current.find((x) => x.id === e.detail?.alarmId); if (a) setAlert(a); };
    window.addEventListener("wa-ring", h);
    return () => window.removeEventListener("wa-ring", h);
  }, []);

  const todayScore = score(today);
  const pct = pctOf(today);
  const need = Math.ceil((n * WIN_PCT) / 100);
  const toggle = (id) => setData((d) => ({ ...d, logs: { ...d.logs, [today]: { ...d.logs[today], [id]: !d.logs[today]?.[id] } } }));

  // habit list editing
  const setH = (fn) => setData((d) => ({ ...d, habits: fn(d.habits) }));
  const rename = (id, l) => setH((hs) => hs.map((h) => (h.id === id ? { ...h, label: l } : h)));
  const del = (id) => setH((hs) => (hs.length > 1 ? hs.filter((h) => h.id !== id) : hs));
  const move = (i, dir) => setH((hs) => { const a = [...hs], j = i + dir; if (j < 0 || j >= a.length) return hs; [a[i], a[j]] = [a[j], a[i]]; return a; });
  const addHabit = () => {
    const t = newH.trim();
    if (!t || n >= 20) return;
    setH((hs) => [...hs, { id: "h" + Date.now(), label: t }]);
    setNewH("");
  };

  const stats = useMemo(() => {
    const keys = Object.keys(data.logs).sort();
    const fk = keys[0] || today;
    const at = (d) => { const k = dk(d); return k < fk || k > today ? null : pctOf(k); };

    let cur = new Date(now), streak = 0;
    if (pctOf(dk(cur)) < WIN_PCT) cur = addDays(cur, -1);
    while (pctOf(dk(cur)) >= WIN_PCT) { streak++; cur = addDays(cur, -1); }

    const span0 = Math.max(1, Math.round((new Date(today + "T00:00:00") - new Date(fk + "T00:00:00")) / 864e5) + 1);
    const rate = keys.length ? Math.round((keys.reduce((s, k) => s + score(k), 0) / (span0 * n)) * 100) : 0;

    const ys = now.getFullYear(), mo = now.getMonth();
    const sq = Math.floor(mo / 3), sStart = new Date(ys, sq * 3, 1), sDays = Math.round((new Date(ys, sq * 3 + 3, 1) - sStart) / 864e5);
    const periods = {
      week: span(addDays(now, -6), 7),
      month: span(new Date(ys, mo, 1), new Date(ys, mo + 1, 0).getDate()),
      season: span(sStart, sDays),
    };
    const chart = {
      week: periods.week.map((d) => ({ l: d.toLocaleDateString(undefined, { weekday: "short" }), v: at(d) })),
      month: periods.month.map((d) => ({ l: String(d.getDate()), v: at(d) })),
      season: Array.from({ length: Math.ceil(sDays / 7) }, (_, w) => {
        const vs = periods.season.slice(w * 7, w * 7 + 7).map(at).filter((v) => v != null);
        return { l: `W${w + 1}`, v: vs.length ? mean(vs) : null };
      }),
    };
    const cons = {};
    Object.keys(periods).forEach((r) => {
      const t = periods[r].map(dk).filter((k) => k >= fk && k <= today);
      cons[r] = H.map((h) => ({ ...h, p: t.length ? Math.round((100 * t.filter((k) => data.logs[k]?.[h.id]).length) / t.length) : 0 }));
    });
    const months = [0, 1, 2].map((i) => {
      const m = sq * 3 + i;
      const total = new Date(ys, m + 1, 0).getDate();
      const prefix = `${ys}-${pad(m + 1)}`, goal = data.goals[prefix]?.days ?? Math.ceil(total * MONTH_GOAL);
      return { name: new Date(ys, m, 1).toLocaleDateString(undefined, { month: "long" }), goal, prefix, total, items: itemsOf(data.goals[prefix]), wins: keys.filter((k) => k.startsWith(prefix) && pctOf(k) >= WIN_PCT).length };
    });
    const seasons = SEASONS.map((se, q) => {
      const st = new Date(ys, q * 3, 1), len = Math.round((new Date(ys, q * 3 + 3, 1) - st) / 864e5);
      const vs = span(st, len).map(at).filter((v) => v != null);
      return { ...se, avg: mean(vs), wins: vs.filter((v) => v >= WIN_PCT).length, days: vs.length, current: q === sq };
    });
    return { streak, rate, chart, cons, months, seasons };
  }, [data.logs, data.habits, data.goals, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const pts = stats.chart[range];
  const vals = pts.map((p) => p.v).filter((v) => v != null);
  const consList = [...stats.cons[range]].sort((a, b) => a.p - b.p);

  // sleep
  const week = span(addDays(now, -6), 7).map((d) => ({ key: dk(d), day: d.toLocaleDateString(undefined, { weekday: "short" }), hrs: data.sleep[dk(d)] }));
  const logged = week.filter((w) => w.hrs != null);
  const avg = logged.length ? (logged.reduce((s, w) => s + w.hrs, 0) / logged.length).toFixed(1) : "–";
  const setSleep = (key, v) =>
    setData((d) => {
      const sleep = { ...d.sleep };
      if (v === "" || isNaN(+v)) delete sleep[key]; else sleep[key] = Math.min(16, Math.max(0, +v));
      return { ...d, sleep };
    });

  // tracks + monthly goals
  const curT = data.trackers.find((t) => t.id === trk) || data.trackers[0];
  const tVals = curT ? data.tracks[curT.id] || {} : {};
  const tWeek = week.map((w) => ({ key: w.key, day: w.day, v: tVals[w.key] }));
  const tLogged = tWeek.filter((w) => w.v != null);
  const tAvg = tLogged.length ? +(tLogged.reduce((t, w) => t + w.v, 0) / tLogged.length).toFixed(1) : 0;
  const tOk = (v) => (curT.mode === "max" ? v <= curT.target : v >= curT.target);
  const tTop = Math.ceil(curT ? Math.max(curT.target * 1.4, ...tLogged.map((w) => w.v), 1) : 1);
  const setTV = (key, v) =>
    setData((d) => {
      const cur = { ...(d.tracks[curT.id] || {}) };
      if (v === "" || isNaN(+v)) delete cur[key]; else cur[key] = Math.min(999, Math.max(0, +v));
      return { ...d, tracks: { ...d.tracks, [curT.id]: cur } };
    });
  const patchT = (patch) => setData((d) => ({ ...d, trackers: d.trackers.map((t) => (t.id === curT.id ? { ...t, ...patch } : t)) }));
  const addTracker = () => {
    const name = nt.name.trim();
    if (!name || data.trackers.length >= 8) return;
    const id = "t" + Date.now();
    setData((d) => ({ ...d, trackers: [...d.trackers, { id, name, unit: nt.unit.trim() || "h", target: Math.max(0, +nt.target || 0), mode: nt.mode }] }));
    setTrk(id); setAddingT(false); setNt({ name: "", unit: "h", target: "1", mode: "min" });
  };
  const delTracker = () => setData((d) => { const tr = { ...d.tracks }; delete tr[curT.id]; return { ...d, trackers: d.trackers.filter((t) => t.id !== curT.id), tracks: tr }; });

  const setGoal = (p, patch) => setData((d) => ({ ...d, goals: { ...d.goals, [p]: { ...d.goals[p], ...patch } } }));
  const setItems = (p, fn) => setData((d) => { const g = d.goals[p] || {}; return { ...d, goals: { ...d.goals, [p]: { ...g, items: fn(itemsOf(g)) } } }; });
  const addGoal = (p) => {
    const t = (gIn[p] || "").trim();
    if (!t) return;
    setItems(p, (it) => (it.length >= 10 ? it : [...it, { id: "g" + Date.now(), text: t, done: false }]));
    setGIn((x) => ({ ...x, [p]: "" }));
  };

  // alarms
  const addAlarm = () => {
    unlock();
    setData((d) => ({ ...d, alarms: [...d.alarms, { id: Date.now(), time, habit: habit || d.habits[0].id, tune, days, armed: true, fired: null }] }));
  };
  const toggleAlarm = (id) => { unlock(); setData((d) => ({ ...d, alarms: d.alarms.map((a) => (a.id === id ? { ...a, armed: !a.armed, fired: null } : a)) })); };
  const previewT = (tn) => {
    stop(); window.__RP?.stop().catch(() => {});
    const rg = data.rings.find((r) => `custom:${r.id}` === tn);
    if (rg?.uri && window.__RP) window.__RP.play({ uri: rg.uri, loop: false }).then(() => setTimeout(() => window.__RP.stop().catch(() => {}), 6000)).catch(() => {});
    else if (tn.startsWith("custom:")) playCustom(tn.slice(7), false).then((ok) => ok && setTimeout(stop, 6000));
    else play(tn);
  };
  const pickSys = async () => {
    try {
      const r = await window.__RP.pick();
      const ex = data.rings.find((x) => x.uri === r.uri);
      const id = ex ? ex.id : "s" + Date.now();
      if (!ex) {
        if (data.rings.length >= 10) return setRingMsg("Limit of 10 ringtones. Remove one first.");
        setData((d) => ({ ...d, rings: [...d.rings, { id, name: r.title, uri: r.uri }] }));
      }
      setTune(`custom:${id}`); setRingMsg("");
    } catch { /* cancelled */ }
  };
  const pickRing = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (data.rings.length >= 10) return setRingMsg("Limit of 10 ringtones. Remove one first.");
    if (!f.type.startsWith("audio/") && !/\.(mp3|m4a|aac|wav|ogg|opus|flac)$/i.test(f.name)) return setRingMsg("That file isn't an audio file.");
    if (f.size > 20 * 1024 * 1024) return setRingMsg("File is over 20 MB. Pick a shorter clip.");
    const id = "r" + Date.now();
    try {
      await ringPut(id, { blob: f });
      setData((d) => ({ ...d, rings: [...d.rings, { id, name: f.name.replace(/\.[^.]+$/, "").slice(0, 28) }] }));
      setTune(`custom:${id}`); setRingMsg("");
    } catch { setRingMsg("Couldn't save the ringtone on this device."); }
  };
  const delRing = async (id) => {
    try { await ringDel(id); } catch { /* ignore */ }
    setData((d) => ({ ...d, rings: d.rings.filter((r) => r.id !== id), alarms: d.alarms.map((a) => (a.tune === `custom:${id}` ? { ...a, tune: "chime" } : a)) }));
    setTune("chime"); stop();
  };
  const setAlarmTune = (id, t) => { setData((d) => ({ ...d, alarms: d.alarms.map((a) => (a.id === id ? { ...a, tune: t } : a)) })); previewT(t); };
  const snooze = () => { setSnoozes((q) => [...q, { alarm: alert, at: Date.now() + 5 * 60000 }]); setAlert(null); };
  const delAlarm = (id) => setData((d) => ({ ...d, alarms: d.alarms.filter((a) => a.id !== id) }));

  const ys = now.getFullYear();
  const sq0 = Math.floor(now.getMonth() / 3), SE = SEASONS[sq0], sStart0 = new Date(ys, sq0 * 3, 1);
  const sLen = Math.round((new Date(ys, sq0 * 3 + 3, 1) - sStart0) / 864e5);
  const dayN = Math.floor((new Date(today + "T00:00:00") - sStart0) / 864e5) + 1;
  const P = data.profile, age = ageOf(P.dob);
  const initials = P.name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const digits = P.phone.replace(/\D/g, "").length;
  const phoneBad = P.phone && (/[^\d\s+-]/.test(P.phone) || digits < 7 || digits > 15);
  const setProf = (patch) => setData((d) => ({ ...d, profile: { ...d.profile, ...patch } }));
  const inp = "mt-1 w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-red-500";
  const gItems = itemsOf(data.goals[`${ys}-${pad(now.getMonth() + 1)}`]);
  const gDone = gItems.filter((g) => g.done).length, gNext = gItems.find((g) => !g.done);
  const doy = Math.floor((now - new Date(ys, 0, 0)) / 864e5);

  return (
    <div className="min-h-screen bg-black px-4 pb-28 text-neutral-100">
      <div className="mx-auto max-w-xl space-y-4">
        <header className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-neutral-900 bg-black px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src={logo} alt="Life Arc logo" className="h-14 w-14 rounded-2xl" />
              <div>
                <h1 className="text-2xl font-black leading-none tracking-tight">Life <span className="text-red-500">Arc</span></h1>
                <p className="mt-1 text-[11px] font-medium text-neutral-400">Discipline | Consistency | Achieve</p>
              </div>
            </div>
            <button onClick={() => setProfOpen(true)} aria-label="Open profile" className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-800 text-sm font-bold text-neutral-200 active:bg-neutral-700">{initials || <User size={20} />}</button>
          </div>
          <div className="h-0.5 rounded-full bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
          <div className="flex items-end justify-between">
            <div>
              {P.name && <p className="text-base font-semibold">Hi, {P.name.trim().split(" ")[0]}{age != null && <span className="font-normal text-neutral-400"> · {age} yrs</span>}</p>}
              <p className="flex items-center gap-1 text-xs font-semibold text-red-400"><SE.icon size={12} /> {SE.name} · {SE.months}</p>
              <p className="text-sm text-neutral-400">{now.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            </div>
            <p className="text-2xl tabular-nums text-red-500">{pad(now.getHours())}:{pad(now.getMinutes())}<span className="text-sm text-neutral-600">:{pad(now.getSeconds())}</span></p>
          </div>
        </header>

        {tab === "today" && (
          <>
            <div className="rounded-2xl border-l-4 border-red-600 bg-red-950/30 p-4">
              <Quote size={16} className="mb-2 text-red-500" />
              <p className="text-base font-semibold leading-snug">{QUOTES[doy % QUOTES.length]}</p>
              <p className="mt-2 text-xs text-red-400">{SE.name} · Day {dayN} of {sLen} · {sLen - dayN} days left</p>
              {gItems.length > 0 && <p className="mt-1 text-sm text-neutral-200">Monthly goals: {gDone}/{gItems.length} achieved{gNext ? `. Next: ${gNext.text}` : ". All done."}</p>}
            </div>

            <Card title="Today's disciplines" icon={Check} right={
              <button onClick={() => setEdit(!edit)} className="flex items-center gap-1 rounded-lg border border-neutral-700 px-2 py-1 text-xs text-neutral-300 active:bg-neutral-800">
                {edit ? <><Check size={14} /> Done</> : <><Pencil size={14} /> Edit list</>}
              </button>}>
              {!edit && (
                <div className="mb-4">
                  <div className="mb-1 flex justify-between text-xs text-neutral-400">
                    <span>{todayScore >= need ? "Day won" : `${need - todayScore} more to win the day`}</span>
                    <span className="font-semibold text-red-500">{todayScore}/{n} · {pct}%</span>
                  </div>
                  <Bar value={pct} className="bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.7)]" />
                </div>
              )}
              <ul className="space-y-2">
                {H.map((h, i) => {
                  const Icon = ICONS[h.id] || Flame;
                  const on = !!data.logs[today]?.[h.id];
                  if (edit) return (
                    <li key={h.id} className="flex items-center gap-1.5">
                      <input value={h.label} maxLength={40} onChange={(e) => rename(h.id, e.target.value)}
                        className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500" />
                      <button onClick={() => move(i, -1)} aria-label="Move up" className="rounded-lg p-2 text-neutral-400 active:bg-neutral-800"><ChevronUp size={16} /></button>
                      <button onClick={() => move(i, 1)} aria-label="Move down" className="rounded-lg p-2 text-neutral-400 active:bg-neutral-800"><ChevronDown size={16} /></button>
                      <button onClick={() => del(h.id)} aria-label="Delete habit" className="rounded-lg p-2 text-red-500 active:bg-neutral-800"><Trash2 size={16} /></button>
                    </li>
                  );
                  return (
                    <li key={h.id}>
                      <button role="checkbox" aria-checked={on} onClick={() => toggle(h.id)}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left transition ${on ? "border-red-500/50 bg-red-500/10" : "border-neutral-800 bg-neutral-900 active:bg-neutral-800"}`}>
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${on ? "border-red-500 bg-red-500 text-white" : "border-neutral-600"}`}>{on && <Check size={16} strokeWidth={3} />}</span>
                        <Icon size={16} className={on ? "text-red-500" : "text-neutral-500"} />
                        <span className={`text-sm ${on ? "text-neutral-400 line-through decoration-neutral-600" : "text-neutral-100"}`}>{h.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {edit && (
                <div className="mt-3 flex gap-2">
                  <input value={newH} placeholder={n >= 20 ? "Limit of 20 reached" : "New habit"} disabled={n >= 20} maxLength={40}
                    onChange={(e) => setNewH(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHabit()}
                    className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500" />
                  <button onClick={addHabit} aria-label="Add habit" className="rounded-lg bg-red-600 px-3 text-white active:bg-red-500"><Plus size={18} /></button>
                </div>
              )}
            </Card>
          </>
        )}

        {tab === "progress" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="flex items-center gap-2 text-3xl font-black text-red-500"><Flame size={24} />{stats.streak}</p>
                <p className="text-xs text-neutral-400">day streak ({WIN_PCT}%+ of habits)</p>
              </div>
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
                <p className="text-3xl font-black text-red-500">{stats.rate}%</p>
                <p className="text-xs text-neutral-400">cumulative success rate</p>
              </div>
            </div>

            <Card title="Performance" icon={TrendingUp}>
              <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-black p-1">
                {[["week", "Week"], ["month", "Month"], ["season", "Season"]].map(([id, l]) => (
                  <button key={id} onClick={() => setRange(id)} className={`rounded-lg py-2 text-sm font-medium ${range === id ? "bg-red-600 text-white" : "text-neutral-400"}`}>{l}</button>
                ))}
              </div>
              <LineChart points={pts} showVals={pts.length <= 8} />
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[[mean(vals) + "%", "average"], [(vals.length ? Math.max(...vals) : 0) + "%", "best"], [range === "season" ? vals.filter((v) => v >= WIN_PCT).length + " wks" : vals.filter((v) => v >= WIN_PCT).length + " days", "won"]].map(([v, l]) => (
                  <div key={l} className="rounded-xl bg-black py-2"><p className="text-lg font-bold text-red-500">{v}</p><p className="text-[11px] text-neutral-500">{l}</p></div>
                ))}
              </div>
            </Card>

            <Card title="Habit consistency" icon={Check}>
              <ul className="space-y-3">
                {consList.map((h) => (
                  <li key={h.id}>
                    <div className="mb-1 flex justify-between text-xs text-neutral-400"><span>{h.label}</span><span className={h.p < 50 ? "text-red-400" : ""}>{h.p}%</span></div>
                    <Bar value={h.p} className={h.p >= 80 ? "bg-emerald-400" : "bg-red-500"} />
                  </li>
                ))}
              </ul>
              {consList.length > 1 && <p className="mt-3 text-xs text-neutral-500">Weakest this period: {consList[0].label}. Fix that one first.</p>}
            </Card>

            <Card title="Four seasons" icon={Snowflake}>
              <div className="grid grid-cols-2 gap-2">
                {stats.seasons.map((se) => {
                  const Icon = se.icon;
                  return (
                    <div key={se.name} className={`rounded-xl border p-3 ${se.current ? "border-red-500 bg-red-500/10" : "border-neutral-800 bg-black"}`}>
                      <p className="flex items-center gap-2 text-sm font-semibold"><Icon size={16} className={se.current ? "text-red-500" : "text-neutral-500"} />{se.name}</p>
                      <p className="text-[11px] text-neutral-500">{se.months}{se.current ? " · now" : ""}</p>
                      <p className="mt-2 text-xl font-bold text-red-500">{se.days ? `${se.avg}%` : "–"}</p>
                      <p className="text-[11px] text-neutral-500">{se.days ? `${se.wins} winning days` : "no data yet"}</p>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card title={`${SE.name}: monthly goals`} icon={Target}>
              <div className="space-y-4">
                {stats.months.map((m) => (
                  <div key={m.prefix}>
                    <div className="mb-1 flex items-center justify-between text-xs text-neutral-400">
                      <span className="text-sm font-semibold text-neutral-200">{m.name}</span>
                      <span className="flex items-center gap-2">
                        <button onClick={() => setGoal(m.prefix, { days: Math.max(1, m.goal - 1) })} aria-label="Lower goal" className="rounded border border-neutral-700 p-1"><Minus size={12} /></button>
                        {m.wins}/{m.goal} winning days
                        <button onClick={() => setGoal(m.prefix, { days: Math.min(m.total, m.goal + 1) })} aria-label="Raise goal" className="rounded border border-neutral-700 p-1"><Plus size={12} /></button>
                      </span>
                    </div>
                    <Bar value={(m.wins / m.goal) * 100} className={m.wins >= m.goal ? "bg-emerald-400" : "bg-red-500"} />
                    <ul className="mt-3 space-y-1.5">
                      {m.items.map((g) => (
                        <li key={g.id} className="flex items-center gap-2">
                          <button role="checkbox" aria-checked={g.done} onClick={() => setItems(m.prefix, (it) => it.map((x) => (x.id === g.id ? { ...x, done: !x.done } : x)))}
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${g.done ? "border-emerald-400 bg-emerald-400 text-black" : "border-neutral-600"}`}>{g.done && <Check size={16} strokeWidth={3} />}</button>
                          <span className={`min-w-0 flex-1 break-words text-sm ${g.done ? "text-neutral-500 line-through" : "text-neutral-100"}`}>{g.text}</span>
                          <button onClick={() => setItems(m.prefix, (it) => it.filter((x) => x.id !== g.id))} aria-label="Delete goal" className="p-1 text-neutral-600 hover:text-red-500"><Trash2 size={14} /></button>
                        </li>
                      ))}
                    </ul>
                    {m.items.length > 0 && <p className="mt-1 text-xs text-neutral-500">{m.items.filter((g) => g.done).length}/{m.items.length} goals achieved</p>}
                    <div className="mt-2 flex gap-2">
                      <input value={gIn[m.prefix] || ""} maxLength={60} placeholder={`Add a goal for ${m.name}`} onChange={(e) => setGIn((x) => ({ ...x, [m.prefix]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addGoal(m.prefix)}
                        className="min-w-0 flex-1 rounded-lg border border-neutral-800 bg-black px-3 py-2 text-sm outline-none focus:border-red-500" />
                      <button onClick={() => addGoal(m.prefix)} aria-label="Add goal" className="rounded-lg bg-red-600 px-3 text-white active:bg-red-500"><Plus size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {tab === "sleep" && (
          <Card title="Sleep, last 7 days" icon={Moon} right={<span className="text-sm text-neutral-400">avg {avg}h</span>}>
            <LineChart points={week.map((w) => ({ l: w.day, v: w.hrs }))} max={12} ticks={[0, 3, 6, 9, 12]} target={SLEEP_TARGET} showVals />
            <p className="mt-2 text-xs text-neutral-500">{logged.filter((w) => w.hrs >= SLEEP_TARGET).length} of {logged.length} logged nights hit {SLEEP_TARGET}h.</p>
            <div className="mt-3 grid grid-cols-7 gap-1.5">
              {week.map((w) => (
                <label key={w.key} className="text-center text-[10px] text-neutral-500">{w.day}
                  <input type="number" inputMode="decimal" step="0.5" min="0" max="16" placeholder="–" value={w.hrs ?? ""} onChange={(e) => setSleep(w.key, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-neutral-700 bg-black py-2 text-center text-sm text-neutral-100 outline-none focus:border-red-500" />
                </label>
              ))}
            </div>
          </Card>
        )}

        {tab === "track" && (
          <Card title="Track" icon={Activity} right={curT && !addingT && <button onClick={delTracker} aria-label="Delete this track" className="text-neutral-500 hover:text-red-500"><Trash2 size={16} /></button>}>
            <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
              {data.trackers.map((t) => (
                <button key={t.id} onClick={() => { setTrk(t.id); setAddingT(false); }} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${curT?.id === t.id && !addingT ? "bg-red-600 text-white" : "border border-neutral-700 text-neutral-300"}`}>{t.name}</button>
              ))}
              <button onClick={() => setAddingT(true)} disabled={data.trackers.length >= 8} className={`flex shrink-0 items-center gap-1 rounded-full border border-dashed border-red-500 px-3 py-1.5 text-sm text-red-400 ${addingT ? "bg-red-500/10" : ""}`}><Plus size={14} /> Add track</button>
            </div>
            {addingT && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {["Running", "Exercise", "Study", "Reading"].map((n) => <button key={n} onClick={() => setNt({ ...nt, name: n })} className="rounded-full border border-neutral-700 px-3 py-1 text-xs text-neutral-300 active:bg-neutral-800">{n}</button>)}
                </div>
                <input value={nt.name} maxLength={24} placeholder="Track name, e.g. Running" onChange={(e) => setNt({ ...nt, name: e.target.value })} className="w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500" />
                <div className="flex gap-2">
                  <input value={nt.unit} maxLength={6} placeholder="Unit" aria-label="Unit" onChange={(e) => setNt({ ...nt, unit: e.target.value })} className="w-20 rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500" />
                  <input type="number" inputMode="decimal" min="0" value={nt.target} aria-label="Daily target" onChange={(e) => setNt({ ...nt, target: e.target.value })} className="w-20 rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm outline-none focus:border-red-500" />
                  <select value={nt.mode} onChange={(e) => setNt({ ...nt, mode: e.target.value })} aria-label="Target type" className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-black px-2 py-2.5 text-sm outline-none focus:border-red-500">
                    <option value="min">Reach at least</option><option value="max">Stay under</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button onClick={addTracker} className="flex-1 rounded-xl bg-red-600 py-3 font-semibold text-white active:bg-red-500">Create track</button>
                  <button onClick={() => setAddingT(false)} className="rounded-xl border border-neutral-700 px-4 text-neutral-300">Cancel</button>
                </div>
              </div>
            )}
            {!addingT && !curT && <p className="text-sm text-neutral-500">No tracks yet. Add one, like Running or Exercise hours.</p>}
            {!addingT && curT && (
              <>
                <div className="mb-3 flex items-center justify-between rounded-xl bg-black px-3 py-2">
                  <span className="text-sm text-neutral-300">{curT.mode === "max" ? "Daily limit" : "Daily goal"}</span>
                  <span className="flex items-center gap-2">
                    <input type="number" inputMode="decimal" min="0" step="0.5" value={curT.target} aria-label="Daily target" onChange={(e) => patchT({ target: Math.max(0, +e.target.value) })} className="w-20 rounded-lg border border-neutral-700 bg-black py-1.5 text-center font-bold text-red-500 outline-none focus:border-red-500" />
                    <span className="text-sm text-neutral-400">{curT.unit}</span>
                  </span>
                </div>
                <LineChart points={tWeek.map((w) => ({ l: w.day, v: w.v }))} max={tTop} ticks={[0, +(tTop / 2).toFixed(1), tTop]} target={curT.target} unit={curT.unit} tLabel={curT.mode === "max" ? "limit" : "goal"} showVals />
                <p className="mt-2 text-xs text-neutral-500">
                  Average {tAvg}{curT.unit}. {tLogged.filter((w) => tOk(w.v)).length} of {tLogged.length} logged days {curT.mode === "max" ? "within the limit" : "hit the goal"}.
                  {curT.id === "screen" && " A web app can't read phone screen time, so copy it from Digital Wellbeing."}
                </p>
                <div className="mt-3 grid grid-cols-7 gap-1.5">
                  {tWeek.map((w) => (
                    <label key={w.key} className="text-center text-[10px] text-neutral-500">{w.day}
                      <input type="number" inputMode="decimal" step="0.5" min="0" placeholder="–" value={w.v ?? ""} onChange={(e) => setTV(w.key, e.target.value)} className="mt-1 w-full rounded-lg border border-neutral-700 bg-black py-2 text-center text-sm text-neutral-100 outline-none focus:border-red-500" />
                    </label>
                  ))}
                </div>
              </>
            )}
          </Card>
        )}

        {tab === "alarms" && (
          <>
          <div className={`rounded-2xl p-4 ${perm === "granted" ? "bg-neutral-900/60" : "bg-red-950/40"}`}>
            {perm === "granted" && <p className="flex items-center gap-2 text-sm text-emerald-400"><Check size={16} /> Notifications allowed</p>}
            {(perm === "prompt" || perm === "unknown") && (
              <>
                <p className="text-sm text-neutral-200">Allow notifications so alarms can alert you when the app is closed.</p>
                <button onClick={askPerm} className="mt-3 w-full rounded-xl bg-red-600 py-3 font-semibold text-white active:bg-red-500">Allow notifications</button>
              </>
            )}
            {perm === "denied" && <p className="text-sm text-neutral-200">Notifications are blocked. Turn them on in your phone's Settings, Apps, Life Arc, Notifications.</p>}
            {perm === "unsupported" && <p className="text-sm text-neutral-400">This browser can't show notifications. Alarms ring while this page is open.</p>}
          </div>
          <Card title="Alarms" icon={Bell}>
            <div className="flex gap-2">
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-36 shrink-0 rounded-lg border border-neutral-700 bg-black px-2 py-2 text-sm outline-none focus:border-red-500" />
              <select value={habit || ids[0]} onChange={(e) => setHabit(e.target.value)} className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-black px-2 py-2 text-sm outline-none focus:border-red-500">
                {H.map((h) => <option key={h.id} value={h.id}>{h.label}</option>)}
              </select>
            </div>
            <div className="mt-2 flex gap-2">
              <select value={tune} onChange={(e) => { setTune(e.target.value); previewT(e.target.value); }} aria-label="Alarm tune" className="min-w-0 flex-1 rounded-lg border border-neutral-700 bg-black px-2 py-2 text-sm outline-none focus:border-red-500">
                <TuneOptions rings={data.rings} />
              </select>
              <button onClick={() => previewT(tune)} aria-label="Preview tune" className="rounded-lg border border-neutral-700 px-3 text-neutral-300 active:bg-neutral-800"><Play size={16} /></button>
            </div>
            <div className="mt-2 flex gap-2">
              {window.__RP && <button onClick={pickSys} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-dashed border-red-500 py-2.5 text-sm text-red-400 active:bg-red-500/10"><Music size={16} /> Device sounds</button>}
              <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-red-500 py-2.5 text-sm text-red-400 active:bg-red-500/10">
                <Music size={16} /> {window.__RP ? "Audio file" : "Pick ringtone from device"}
                <input type="file" accept="audio/*" className="hidden" onChange={pickRing} />
              </label>
              {tune.startsWith("custom:") && <button onClick={() => delRing(tune.slice(7))} aria-label="Remove ringtone" className="rounded-lg border border-neutral-700 px-3 text-neutral-400 hover:text-red-500"><Trash2 size={16} /></button>}
            </div>
            {ringMsg && <p className="mt-1 text-xs text-red-400">{ringMsg}</p>}
            <div className="mt-3 flex items-center justify-between gap-1">
              {DAYN.map((d, i) => (
                <button key={d} onClick={() => setDays((x) => (x.includes(i) ? x.filter((v) => v !== i) : [...x, i].sort()))} aria-pressed={days.includes(i)}
                  className={`h-9 w-9 rounded-full text-xs font-semibold ${days.includes(i) ? "bg-red-600 text-white" : "border border-neutral-700 text-neutral-400"}`}>{d[0]}</button>
              ))}
            </div>
            <p className="mt-1 text-center text-xs text-neutral-500">{days.length ? "Repeats on selected days" : "No day selected: repeats every day"}</p>
            <button onClick={addAlarm} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-semibold text-white active:bg-red-500"><Plus size={18} /> Add and arm alarm</button>
            <ul className="mt-4 space-y-2">
              {data.alarms.length === 0 && <li className="text-sm text-neutral-500">No alarms yet.</li>}
              {[...data.alarms].sort((a, b) => a.time.localeCompare(b.time)).map((a) => (
                <li key={a.id} className="rounded-xl border border-neutral-800 bg-black px-3 py-2">
                  <div className="flex items-center gap-3">
                    <span className={`text-2xl tabular-nums ${a.armed ? "text-red-500" : "text-neutral-600"}`}>{a.time}</span>
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-300">{label(a.habit)}</span>
                    <button onClick={() => toggleAlarm(a.id)} role="switch" aria-checked={a.armed} className={`relative h-6 w-11 rounded-full transition ${a.armed ? "bg-red-600" : "bg-neutral-700"}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${a.armed ? "left-5" : "left-0.5"}`} />
                    </button>
                    <button onClick={() => delAlarm(a.id)} aria-label="Delete alarm" className="text-neutral-500 hover:text-red-500"><Trash2 size={16} /></button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-neutral-500">
                    <span>{a.days?.length ? a.days.map((d) => DAYN[d]).join(" ") : "Every day"}</span>
                    <select value={a.tune || "chime"} onChange={(e) => setAlarmTune(a.id, e.target.value)} aria-label="Change tune" className="rounded-lg border border-neutral-700 bg-black px-2 py-1 text-xs text-neutral-300 outline-none focus:border-red-500">
                      <TuneOptions rings={data.rings} />
                    </select>
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-neutral-500">In the browser, alarms ring while this page is open. The Android app schedules them in the background with your tune.</p>
          </Card>
          </>
        )}
        <footer className="pt-4 text-center text-xs text-neutral-500">
          <p>Built by <a href="https://irfan1136.github.io/portfolio11/" target="_blank" rel="noopener noreferrer" className="font-semibold text-red-400 underline underline-offset-2">Mohamed Irfan</a></p>
          <p className="mt-1">© {now.getFullYear()} Mohamed Irfan. All rights reserved.</p>
        </footer>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-800 bg-black/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="mx-auto flex max-w-xl">
          {TABS.map(([id, l, Icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id} className={`flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${tab === id ? "text-red-500" : "text-neutral-500"}`}>
              <Icon size={20} />{l}
            </button>
          ))}
        </div>
      </nav>

      {profOpen && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/80" onClick={() => setProfOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-xl rounded-t-3xl border border-neutral-800 bg-neutral-950 p-5" style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold"><User size={18} className="text-red-500" /> Your profile</h2>
              <button onClick={() => setProfOpen(false)} aria-label="Close profile" className="rounded-lg p-2 text-neutral-400 active:bg-neutral-800"><X size={18} /></button>
            </div>
            <label className="block text-xs text-neutral-400">Name
              <input value={P.name} maxLength={40} placeholder="Your name" onChange={(e) => setProf({ name: e.target.value })} className={inp} />
            </label>
            <label className="mt-3 block text-xs text-neutral-400">Date of birth
              <input type="date" value={P.dob} max={today} onChange={(e) => setProf({ dob: e.target.value })} className={inp} />
            </label>
            {P.dob && <p className="mt-1 text-sm text-red-400">{age != null ? `Age: ${age} years` : "Enter a valid date of birth"}</p>}
            <label className="mt-3 block text-xs text-neutral-400">Phone number
              <input type="tel" inputMode="tel" value={P.phone} maxLength={18} placeholder="+91 98765 43210" onChange={(e) => setProf({ phone: e.target.value })} className={inp} />
            </label>
            {phoneBad && <p className="mt-1 text-xs text-red-400">Enter a valid phone number (7 to 15 digits).</p>}
            <p className="mt-4 text-xs text-neutral-500">Saved only on this device. Nothing is uploaded.</p>
            <button onClick={() => setProfOpen(false)} className="mt-3 w-full rounded-xl bg-red-600 py-3 font-semibold text-white active:bg-red-500">Done</button>
          </div>
        </div>
      )}

      {alert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-6">
          <div className="w-full max-w-sm animate-pulse rounded-3xl border border-red-500 bg-neutral-900 p-8 text-center shadow-[0_0_40px_rgba(239,68,68,0.4)]">
            <BellRing size={48} className="mx-auto mb-4 text-red-500" />
            <p className="text-5xl font-black tabular-nums">{alert.time}</p>
            <p className="mt-2 text-lg text-neutral-200">{label(alert.habit)}</p>
            <div className="mt-6 space-y-2">
              <button onClick={snooze} className="w-full rounded-xl bg-red-600 py-3 font-semibold text-white">Snooze 5 min</button>
              <div className="flex gap-2">
                {H.some((h) => h.id === alert.habit) && !data.logs[today]?.[alert.habit] && (
                  <button onClick={() => { toggle(alert.habit); setAlert(null); }} className="flex-1 rounded-xl border border-red-500 py-3 font-semibold text-red-400">Done</button>
                )}
                <button onClick={() => setAlert(null)} className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-neutral-600 py-3 text-neutral-200"><X size={16} /> Stop</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
