import { useEffect, useRef, useState } from "react";
import { Users, UserPlus, Copy, Send, Trophy, Check, X } from "lucide-react";
import * as S from "./social.js";
import { APP_LINK } from "./firebase-config.js";

export const MAX_FRIENDS = 6;
const FLAG = "la:challenge";
const other = (l, me) => (l.fromUid === me ? { uid: l.toUid, name: l.toName, code: l.toCode } : { uid: l.fromUid, name: l.fromName, code: l.fromCode });

export function useChallenge({ name, payload }) {
  const [on, setOn] = useState(() => { try { return localStorage.getItem(FLAG) === "1"; } catch { return false; } });
  const [st, setSt] = useState("idle"); // idle | connecting | ready | error
  const [me, setMe] = useState(null);
  const [links, setLinks] = useState([]);
  const [prog, setProg] = useState({});
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [later, setLater] = useState([]);
  const subs = useRef({});

  useEffect(() => {
    if (!on || !S.configured()) return;
    let dead = false, unl;
    setSt("connecting"); setMsg("");
    (async () => {
      try {
        const m = await S.start(name);
        if (dead) return;
        setMe(m); setSt("ready");
        unl = S.watchLinks((l, e) => { if (e) setMsg(S.msg(e)); else setLinks(l); });
      } catch (e) { if (!dead) { setSt("error"); setMsg(S.msg(e)); } }
    })();
    return () => { dead = true; unl?.(); Object.values(subs.current).forEach((u) => u()); subs.current = {}; };
  }, [on, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  // listen to the progress of accepted friends only
  useEffect(() => {
    if (st !== "ready") return;
    const want = new Set(links.filter((l) => l.status === "accepted").map((l) => other(l, me.uid).uid));
    want.forEach((u) => { if (!subs.current[u]) subs.current[u] = S.watchProgress(u, (d) => setProg((p) => ({ ...p, [u]: d }))); });
    Object.keys(subs.current).forEach((u) => {
      if (!want.has(u)) { subs.current[u](); delete subs.current[u]; setProg((p) => { const c = { ...p }; delete c[u]; return c; }); }
    });
  }, [links, st]); // eslint-disable-line react-hooks/exhaustive-deps

  // upload my daily percentages (a few seconds after any change)
  useEffect(() => {
    if (st !== "ready" || !payload || !name) return;
    const t = setTimeout(() => S.pushProgress({ name, code: me.code, ...payload }).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [st, payload, name]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (st !== "ready" || !name) return;
    const t = setTimeout(() => S.updateName(me.code, name).catch(() => {}), 1500);
    return () => clearTimeout(t);
  }, [st, name]); // eslint-disable-line react-hooks/exhaustive-deps

  const mine = me?.uid;
  const incoming = links.filter((l) => l.status === "pending" && l.toUid === mine);
  const outgoing = links.filter((l) => l.status === "pending" && l.fromUid === mine);
  const accepted = links.filter((l) => l.status === "accepted");
  const used = accepted.length + outgoing.length;
  const friends = accepted.map((l) => { const o = other(l, mine); return { ...o, linkId: l.id, prog: prog[o.uid] }; });

  const act = async (fn) => {
    setBusy(true); setMsg("");
    try { return await fn(); } catch (e) { setMsg(S.msg(e)); return null; } finally { setBusy(false); }
  };
  return {
    on, st, me, msg, busy, incoming, outgoing, friends, used,
    alertFor: incoming.find((l) => !later.includes(l.id)),
    dismiss: (id) => setLater((x) => [...x, id]),
    enable: () => { try { localStorage.setItem(FLAG, "1"); } catch { /* ignore */ } setOn(true); },
    disable: () => { try { localStorage.setItem(FLAG, "0"); } catch { /* ignore */ } setOn(false); setSt("idle"); setLinks([]); setProg({}); },
    retry: () => setTick((x) => x + 1),
    invite: (code) => act(async () => {
      if (used >= MAX_FRIENDS) throw Object.assign(new Error("full"), { la: "full" });
      return S.invite(code, { name, code: me.code });
    }),
    accept: (id) => act(async () => {
      if (used >= MAX_FRIENDS) throw Object.assign(new Error("full"), { la: "full" });
      await S.accept(id);
    }),
    remove: (id) => act(() => S.remove(id)),
  };
}

const avg = (days, since, keys, today) => {
  if (!days || !since) return null;
  const vs = keys.filter((k) => k >= since && k <= today).map((k) => days[k] ?? 0);
  return vs.length ? Math.round(vs.reduce((a, b) => a + b, 0) / vs.length) : null;
};
const ago = (ts) => {
  const ms = ts?.toMillis?.();
  if (!ms) return "";
  const m = Math.max(0, Math.round((Date.now() - ms) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};
const waUrl = (phone, text) => {
  let d = String(phone || "").replace(/\D/g, "");
  if (d.length === 10) d = "91" + d; // 10-digit Indian number: add country code
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
};
const inviteText = (name, code) =>
  `${name || "A friend"} invited you to a Life Arc challenge!\nMy ID: ${code}\n\n1) Install Life Arc${APP_LINK ? ": " + APP_LINK : ""}\n2) Open Challenge, turn it on, and type my ID.\nI will accept right away.`;

const Box = ({ title, icon: Icon, right, children }) => (
  <section className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-200"><Icon size={16} className="text-red-500" /> {title}</h2>
      {right}
    </div>
    {children}
  </section>
);
const field = "w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-red-500";
const btn = "rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-red-500 disabled:opacity-50";

export function ChallengeTab({ ch, name, setName, periods, today, payload, seasonName }) {
  const [flt, setFlt] = useState("week");
  const [idIn, setIdIn] = useState("");
  const [phone, setPhone] = useState("");
  const [copied, setCopied] = useState(false);
  const [ok, setOk] = useState("");

  if (!S.configured()) {
    return (
      <Box title="Challenge" icon={Users}>
        <p className="text-sm text-neutral-300">Challenge is not set up yet. Add your Firebase config in <span className="text-red-400">src/firebase-config.js</span>, then build the app again.</p>
      </Box>
    );
  }
  if (!ch.on) {
    return (
      <Box title="Challenge your friends" icon={Users}>
        <p className="text-sm text-neutral-300">Compare your daily progress with up to {MAX_FRIENDS} friends. Friends see only your daily percentage, never your habit names. A friend appears only after they accept.</p>
        {!name.trim() && (
          <label className="mt-3 block text-xs text-neutral-400">Your name (friends see this)
            <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Your name" className={`mt-1 ${field}`} />
          </label>
        )}
        <button onClick={ch.enable} disabled={!name.trim()} className={`mt-3 w-full ${btn}`}>Turn on Challenge</button>
      </Box>
    );
  }
  if (ch.st !== "ready") {
    return (
      <Box title="Challenge" icon={Users}>
        {ch.st === "error"
          ? (<><p className="text-sm text-red-400">{ch.msg}</p><button onClick={ch.retry} className={`mt-3 w-full ${btn}`}>Try again</button></>)
          : <p className="text-sm text-neutral-400">Connecting...</p>}
      </Box>
    );
  }

  const code = ch.me.code, full = ch.used >= MAX_FRIENDS;
  const copy = async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ } };
  const sendId = async () => {
    if (!idIn.trim()) return;
    const r = await ch.invite(idIn);
    if (r) { setIdIn(""); setOk(r === "accepted" ? "Connected. They had already invited you." : "Invite sent. It shows up for your friend once they open Challenge."); } else setOk("");
  };
  const rows = [{ key: "me", name: name || "You", you: true, v: (k) => avg(payload.days, payload.since, k, today) },
    ...ch.friends.map((f) => ({ key: f.uid, name: f.prog?.name || f.name, linkId: f.linkId, sync: ago(f.prog?.updatedAt), v: (k) => avg(f.prog?.days, f.prog?.since, k, today) }))]
    .map((r) => ({ ...r, val: r.v(periods[flt]) }))
    .sort((a, b) => (b.val ?? -1) - (a.val ?? -1));
  const caption = { today: "Share of habits done today.", week: "Average of the last 7 days.", month: "Average of this month so far.", season: `Average of ${seasonName} so far.` }[flt];

  return (
    <>
      <Box title="Your ID" icon={Users}>
        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-black tracking-wider text-red-500">{code}</p>
          <button onClick={copy} className="flex items-center gap-1 rounded-lg border border-neutral-700 px-3 py-2 text-sm text-neutral-300 active:bg-neutral-800">{copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copied" : "Copy"}</button>
        </div>
        <p className="mt-2 text-xs text-neutral-500">Friends type this ID in their Challenge tab to connect with you.</p>
      </Box>

      <Box title={`Add a friend (${ch.used}/${MAX_FRIENDS})`} icon={UserPlus}>
        <div className="flex gap-2">
          <input value={idIn} onChange={(e) => setIdIn(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendId()} placeholder="Friend's ID, e.g. LA-7K4Q9X" autoCapitalize="characters" className={field} />
          <button onClick={sendId} disabled={ch.busy || full} className={btn}>Invite</button>
        </div>
        <p className="mt-3 text-xs text-neutral-400">No ID yet? Send your ID on WhatsApp:</p>
        <div className="mt-1 flex gap-2">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" placeholder="Friend's phone" className={field} />
          <a href={waUrl(phone, inviteText(name, code))} target="_blank" rel="noopener noreferrer" className="flex shrink-0 items-center gap-1 rounded-xl border border-red-500 px-4 text-sm font-semibold text-red-400 active:bg-red-500/10"><Send size={14} /> WhatsApp</a>
        </div>
        {full && <p className="mt-2 text-xs text-amber-400">You have 6 friends. Remove one to add another.</p>}
        {ch.msg && <p className="mt-2 text-xs text-red-400">{ch.msg}</p>}
        {!ch.msg && ok && <p className="mt-2 text-xs text-emerald-400">{ok}</p>}
      </Box>

      {(ch.incoming.length > 0 || ch.outgoing.length > 0) && (
        <Box title="Invites" icon={UserPlus}>
          <ul className="space-y-2">
            {ch.incoming.map((l) => (
              <li key={l.id} className="rounded-xl border border-red-500/60 bg-black p-3">
                <p className="text-sm text-neutral-100"><b>{l.fromName}</b> <span className="text-neutral-500">({l.fromCode})</span> invited you</p>
                <div className="mt-2 flex gap-2">
                  <button onClick={() => ch.accept(l.id)} disabled={ch.busy} className={`flex-1 ${btn}`}>Accept</button>
                  <button onClick={() => ch.remove(l.id)} disabled={ch.busy} className="flex-1 rounded-xl border border-neutral-600 py-2.5 text-sm text-neutral-300">Decline</button>
                </div>
              </li>
            ))}
            {ch.outgoing.map((l) => (
              <li key={l.id} className="flex items-center justify-between rounded-xl border border-neutral-800 bg-black px-3 py-2">
                <p className="text-sm text-neutral-300">Waiting for <b>{l.toName}</b> <span className="text-neutral-500">({l.toCode})</span></p>
                <button onClick={() => ch.remove(l.id)} aria-label="Cancel invite" className="text-neutral-500 hover:text-red-500"><X size={16} /></button>
              </li>
            ))}
          </ul>
        </Box>
      )}

      <Box title="Comparison" icon={Trophy}>
        <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
          {[["today", "Today"], ["week", "Week"], ["month", "Month"], ["season", seasonName]].map(([id, l]) => (
            <button key={id} onClick={() => setFlt(id)} aria-pressed={flt === id} className={`shrink-0 rounded-full px-3 py-1.5 text-sm ${flt === id ? "bg-red-600 text-white" : "border border-neutral-700 text-neutral-300"}`}>{l}</button>
          ))}
        </div>
        <ul className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className={`rounded-xl border px-3 py-2 ${r.you ? "border-red-500/60 bg-red-950/20" : "border-neutral-800 bg-black"}`}>
              <div className="flex items-center gap-2">
                <span className="w-5 text-center text-sm font-bold text-neutral-500">{i === 0 && r.val != null ? <Trophy size={16} className="text-amber-400" /> : i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm text-neutral-100">{r.name}{r.you && <span className="ml-1 text-xs text-red-400">(You)</span>}</span>
                <span className="text-lg font-bold tabular-nums text-red-500">{r.val == null ? "–" : `${r.val}%`}</span>
                {!r.you && <button onClick={() => window.confirm(`Remove ${r.name}? You will stop seeing each other's progress.`) && ch.remove(r.linkId)} aria-label={`Remove ${r.name}`} className="text-neutral-600 hover:text-red-500"><X size={16} /></button>}
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-neutral-800"><div className="h-full rounded-full bg-red-500 transition-all duration-500" style={{ width: `${r.val ?? 0}%` }} /></div>
              {r.sync && <p className="mt-1 text-[10px] text-neutral-600">updated {r.sync}</p>}
            </li>
          ))}
        </ul>
        {ch.friends.length === 0 && <p className="mt-3 text-sm text-neutral-500">No friends yet. Invite one to start comparing. You can begin with just 1 friend.</p>}
        <p className="mt-3 text-xs text-neutral-500">{caption} Days before someone started do not count; missed days count as 0%.</p>
      </Box>
      <button onClick={ch.disable} className="w-full py-2 text-xs text-neutral-600 underline">Turn off Challenge on this phone</button>
    </>
  );
}

export function InviteAlert({ ch, onOpen }) {
  const l = ch.alertFor;
  if (!l) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6">
      <div className="w-full max-w-sm rounded-3xl border border-red-500 bg-neutral-900 p-6 text-center shadow-[0_0_40px_rgba(239,68,68,0.4)]">
        <Users size={44} className="mx-auto mb-3 text-red-500" />
        <p className="text-lg font-bold text-neutral-100">{l.fromName}</p>
        <p className="text-sm text-neutral-400">ID {l.fromCode}</p>
        <p className="mt-3 text-sm text-neutral-300">invited you to a Life Arc challenge. If you accept, you both see each other's daily percentage.</p>
        {ch.msg && <p className="mt-2 text-xs text-red-400">{ch.msg}</p>}
        <div className="mt-5 space-y-2">
          <button onClick={async () => { await ch.accept(l.id); onOpen(); }} disabled={ch.busy} className={`w-full ${btn}`}>Accept</button>
          <div className="flex gap-2">
            <button onClick={() => ch.dismiss(l.id)} className="flex-1 rounded-xl border border-neutral-600 py-2.5 text-sm text-neutral-300">Later</button>
            <button onClick={() => ch.remove(l.id)} disabled={ch.busy} className="flex-1 rounded-xl border border-neutral-600 py-2.5 text-sm text-neutral-300">Decline</button>
          </div>
        </div>
      </div>
    </div>
  );
}
