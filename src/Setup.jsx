// One-time page after install for the two phone settings an alarm app needs.
// The notification permission itself is asked by Android's own dialog when the app opens.
const Pill = ({ ok }) => <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${ok ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"}`}>{ok ? "Allowed" : "Not allowed"}</span>;

export function PermissionSetup({ fs, battery, onDone }) {
  const batOk = battery !== false;
  const all = fs && batOk;
  const btn = "shrink-0 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white active:bg-red-500";
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black px-5 pb-8" style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }} role="dialog" aria-label="One-time setup">
      <div className="mx-auto max-w-md">
        <h1 className="mt-4 text-2xl font-bold text-red-500">One-time setup</h1>
        <p className="mb-5 mt-1 text-sm text-neutral-400">Allow these 2 things so alarms ring on top of the screen and are never stopped by the battery saver.</p>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div><p className="font-semibold text-neutral-100">1. Alarm over other apps</p><p className="text-xs text-neutral-400">Shows the alarm screen on top, even when locked</p><Pill ok={fs} /></div>
          {!fs && <button className={btn} onClick={() => window.__AL.openFullScreenSettings().catch(() => {})}>Allow</button>}
        </div>
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-neutral-800 bg-neutral-900 p-4">
          <div><p className="font-semibold text-neutral-100">2. No battery limit</p><p className="text-xs text-neutral-400">Stops the phone from stopping alarms</p><Pill ok={batOk} /></div>
          {!batOk && <button className={btn} onClick={() => window.__RP.batteryAllow().catch(() => {})}>Allow</button>}
        </div>
        <button onClick={onDone} className="mt-3 w-full rounded-xl bg-neutral-800 py-3.5 font-semibold text-white active:bg-neutral-700">{all ? "All done, continue" : "Skip for now"}</button>
      </div>
    </div>
  );
}
