import { createRoot } from "react-dom/client";
import LifeArc from "./LifeArc.jsx";
import Splash from "./Splash.jsx";
import * as store from "./store.js";
const KEY = "winterArc:v1";
// demo data for the web preview, only when nothing is saved yet
const seed = () => {
  try {
    if (!store.get(KEY)) {
      const pad = (n) => String(n).padStart(2, "0");
      const ids = ["sleep","work","workout","water","food","skill","detox","cold","reflect","log"];
      const logs = {}, sleep = {}, screen = {}, sh = [4.5,3.5,2.5,3,5,2.8], sc = [8,6,9,7,8,10], hrs = [6.5,7.5,7,5.5,8,6];
      sc.forEach((n, i) => { const d = new Date(); d.setDate(d.getDate() + i - 6); const k = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; logs[k] = {}; ids.slice(0, n).forEach((h) => (logs[k][h] = true)); sleep[k] = hrs[i]; screen[k] = sh[i]; });
      store.set(KEY, JSON.stringify({ logs, sleep, tracks: { screen }, alarms: [{ id: 1, time: "05:30", habit: "workout", armed: false, fired: null }] }));
    }
  } catch {}
};
store.ready().then(() => { seed(); createRoot(document.getElementById("root")).render(<><LifeArc /><Splash /></>); });
