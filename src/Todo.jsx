import { useState } from "react";
import { Check, ListChecks, Trash2 } from "lucide-react";

const pad = (n) => String(n).padStart(2, "0");
export const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/, TIME_RE = /^\d{2}:\d{2}$/;
const MAX_TASKS = 200, KEEP_DONE_DAYS = 30;

// Keep storage small: finished tasks older than 30 days are dropped, and there is a hard cap on the list.
export const pruneTodos = (list) => {
  if (!Array.isArray(list)) return [];
  const d = new Date(); d.setDate(d.getDate() - KEEP_DONE_DAYS);
  const cut = ymd(d);
  return list.filter((x) => x && x.id && typeof x.title === "string" && (!x.done || (x.date || "") >= cut)).slice(0, MAX_TASKS);
};

// Notifications for tasks that are due in the future (Android app). Ids stay below 2^31.
export const todoNotifications = (todos) => {
  const out = [];
  (todos || []).forEach((t) => {
    if (t.done || !DATE_RE.test(t.date || "") || !TIME_RE.test(t.time || "")) return;
    const at = new Date(`${t.date}T${t.time}:00`);
    if (isNaN(at) || at.getTime() <= Date.now()) return;
    out.push({ id: 1500000000 + (Math.abs(Number(t.id)) % 100000000), title: "Life Arc To-Do", body: t.desc ? `${t.title}: ${t.desc}` : t.title, channelId: "todos", schedule: { at, allowWhileIdle: true } });
  });
  return out;
};

const field = "w-full rounded-lg border border-neutral-700 bg-black px-3 py-2.5 text-sm text-neutral-100 outline-none focus:border-red-500";

export function TodoTab({ todos, setTodos, today }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("09:00");
  const [err, setErr] = useState("");

  const add = () => {
    if (!title.trim()) { setErr("Enter a task title"); return; }
    setErr("");
    const task = { id: Date.now(), title: title.trim().slice(0, 120), desc: desc.trim().slice(0, 500), date: DATE_RE.test(date) ? date : today, time: TIME_RE.test(time) ? time : "09:00", done: false };
    setTodos((l) => pruneTodos([task, ...l]));
    setTitle(""); setDesc("");
  };
  const toggle = (id) => setTodos((l) => l.map((x) => (x.id === id ? { ...x, done: !x.done } : x)));
  const remove = (id) => setTodos((l) => l.filter((x) => x.id !== id));
  const clearDone = () => setTodos((l) => l.filter((x) => !x.done));

  const nowKey = `${today} ${pad(new Date().getHours())}:${pad(new Date().getMinutes())}`;
  const key = (x) => `${x.date} ${x.time || "00:00"}`;
  const sorted = [...todos].sort((a, b) => (key(a) < key(b) ? -1 : 1));
  const groups = [
    ["Overdue", sorted.filter((x) => !x.done && x.date < today || (!x.done && x.date === today && key(x) < nowKey))],
    ["Today", sorted.filter((x) => !x.done && x.date === today && key(x) >= nowKey)],
    ["Upcoming", sorted.filter((x) => !x.done && x.date > today)],
    ["Done", sorted.filter((x) => x.done)],
  ];
  const fmt = (d) => { try { return new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" }); } catch { return d; } };

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-200"><ListChecks size={16} className="text-red-500" /> New task</h2>
        <div className="space-y-2">
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" aria-label="Task title" className={field} />
          <textarea value={desc} maxLength={500} rows={2} onChange={(e) => setDesc(e.target.value)} placeholder="Requirements / description (what exactly is needed)" aria-label="Requirements" className={field} />
          <div className="flex gap-2">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label="Date" className={`${field} min-w-0 flex-1`} />
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Time" className={`${field} min-w-0 flex-1`} />
          </div>
          {err && <p className="text-xs text-red-400">{err}</p>}
          <button onClick={add} className="w-full rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-red-500">Add task</button>
          <p className="text-[11px] text-neutral-500">You get a notification at the task time{window.__LN ? "." : " (Android app only)."}</p>
        </div>
      </div>

      {todos.length === 0 && <p className="py-6 text-center text-sm text-neutral-500">No tasks yet. Add one above and it will be listed by time.</p>}
      {groups.map(([name, list]) => list.length > 0 && (
        <div key={name}>
          <h3 className={`mb-2 text-xs font-semibold uppercase tracking-wide ${name === "Overdue" ? "text-amber-400" : "text-red-400"}`}>{name} · {list.length}</h3>
          <ul className="space-y-2">
            {list.map((x) => (
              <li key={x.id} className="flex items-start gap-3 rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3">
                <button onClick={() => toggle(x.id)} aria-label={x.done ? "Mark not done" : "Mark done"} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 ${x.done ? "border-red-500 bg-red-500 text-black" : "border-neutral-600"}`}>{x.done && <Check size={14} strokeWidth={3} />}</button>
                <div className={`min-w-0 flex-1 ${x.done ? "text-neutral-500 line-through" : ""}`}>
                  <p className="break-words font-semibold text-neutral-100">{x.title}</p>
                  {x.desc && <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-400">{x.desc}</p>}
                  <p className="mt-1 text-xs text-red-400">{fmt(x.date)} · {x.time}</p>
                </div>
                <button onClick={() => remove(x.id)} aria-label="Delete task" className="shrink-0 p-1 text-neutral-500 active:text-red-400"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {groups[3][1].length > 0 && <button onClick={clearDone} className="w-full rounded-xl border border-neutral-700 py-2.5 text-sm text-neutral-300 active:bg-neutral-800">Clear done tasks</button>}
    </section>
  );
}
