import { useEffect, useState } from "react";
import logo from "./logo.png";

// Full-screen launch splash: cover image at app-icon size, dead centre, with the tagline under it.
// Shows on every cold start for 1 second, then fades out.
const SHOW_MS = 1000, FADE_MS = 300;

export default function Splash() {
  const [phase, setPhase] = useState("show"); // show -> fade -> gone
  useEffect(() => {
    const a = setTimeout(() => setPhase("fade"), SHOW_MS);
    const b = setTimeout(() => setPhase("gone"), SHOW_MS + FADE_MS);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);
  if (phase === "gone") return null;
  return (
    <div
      aria-hidden="true"
      style={{ transition: `opacity ${FADE_MS}ms ease`, opacity: phase === "fade" ? 0 : 1 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black"
    >
      <img src={logo} alt="" className="h-24 w-24 rounded-2xl shadow-[0_0_40px_rgba(239,68,68,0.35)]" />
      <p className="absolute inset-x-0 top-1/2 mt-[72px] text-center text-sm font-semibold tracking-wide text-neutral-300">
        Discipline <span className="text-red-500">|</span> Consistency <span className="text-red-500">|</span> Achieve
      </p>
    </div>
  );
}
