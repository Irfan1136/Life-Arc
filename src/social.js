// Firebase layer for the Challenge section. Nothing here runs until the user turns Challenge on.
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  initializeFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where,
  onSnapshot, runTransaction, serverTimestamp,
} from "firebase/firestore";
import { firebaseConfig, configured } from "./firebase-config.js";

export { configured };
const ALPHA = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"; // no 0/O/1/I
const newCode = () => {
  const b = new Uint8Array(6);
  crypto.getRandomValues(b);
  return "LA-" + Array.from(b, (x) => ALPHA[x % ALPHA.length]).join("");
};
export const normCode = (s) => {
  const c = String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const body = c.startsWith("LA") && c.length === 8 ? c.slice(2) : c;
  return body.length === 6 ? "LA-" + body : "";
};
const linkId = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`);
const fail = (code) => Object.assign(new Error(code), { la: code });

let db, auth, uid;

// connect to Firebase and sign in (shared by Challenge and the phone backup)
async function boot() {
  if (!configured()) throw fail("noconfig");
  if (!db) {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });
  }
  let user = await new Promise((res) => { const un = onAuthStateChanged(auth, (u) => { un(); res(u); }); });
  if (!user) user = (await signInAnonymously(auth)).user;
  uid = user.uid;
}

// ---- phone + PIN backup: one document per (phone, PIN), found again after a reinstall ----
export async function backupKey(phone, pin) {
  const enc = new TextEncoder();
  const base = await crypto.subtle.importKey("raw", enc.encode(String(pin)), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode("lifearc:" + phone), iterations: 100000 }, base, 256);
  return "b" + Array.from(new Uint8Array(bits), (x) => x.toString(16).padStart(2, "0")).join("");
}
export async function readBackup(key) {
  await boot();
  const s = await getDoc(doc(db, "backups", key));
  return s.exists() ? s.data() : null;
}
export async function writeBackup(key, json) {
  await boot();
  await setDoc(doc(db, "backups", key), { json, updatedAt: serverTimestamp() });
}
// Auto backup save. The first save of each day first keeps the copy that was in the cloud as an "older copy"
// (document id = key + "_prev", same collection and same fields, so firestore.rules needs no change).
// That way a mistake you make today (deleted habits, wrong tap) can still be undone tomorrow.
const dayStamp = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export async function saveBackup(key, json) {
  await boot();
  let last = "";
  try { last = localStorage.getItem("la:bkprev") || ""; } catch { /* ignore */ }
  if (last !== dayStamp()) {
    try {
      const cur = await getDoc(doc(db, "backups", key));
      if (cur.exists() && typeof cur.data().json === "string") {
        await setDoc(doc(db, "backups", key + "_prev"), { json: cur.data().json, updatedAt: serverTimestamp() });
      }
      try { localStorage.setItem("la:bkprev", dayStamp()); } catch { /* ignore */ }
    } catch { /* the older copy is a bonus: never block the main backup */ }
  }
  await setDoc(doc(db, "backups", key), { json, updatedAt: serverTimestamp() });
}

export async function start(name) {
  await boot();
  const snap = await getDoc(doc(db, "users", uid));
  let code = snap.exists() ? snap.data().code : null;
  if (!code) {
    for (let i = 0; i < 8 && !code; i++) {
      const c = newCode();
      try {
        await runTransaction(db, async (tx) => {
          if ((await tx.get(doc(db, "codes", c))).exists()) throw fail("taken");
          tx.set(doc(db, "codes", c), { uid, name });
          tx.set(doc(db, "users", uid), { code: c, name });
        });
        code = c;
      } catch (e) { if (e.la !== "taken") throw e; }
    }
    if (!code) throw fail("unavailable");
  }
  return { uid, code };
}

export const updateName = async (code, name) => {
  await setDoc(doc(db, "codes", code), { uid, name });
  await setDoc(doc(db, "users", uid), { code, name });
};

export const pushProgress = (p) => setDoc(doc(db, "progress", uid), { ...p, updatedAt: serverTimestamp() });

export function watchLinks(cb) {
  const q = query(collection(db, "links"), where("members", "array-contains", uid));
  return onSnapshot(q, (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() })), null), (e) => cb(null, e));
}
export const watchProgress = (friendUid, cb, onErr) =>
  onSnapshot(doc(db, "progress", friendUid), (s) => cb(s.exists() ? s.data() : null), (e) => onErr?.(e));

// type a friend's ID -> pending invite (or accepts at once if they already invited you)
export async function invite(rawCode, me) {
  const code = normCode(rawCode);
  if (!code) throw fail("badcode");
  if (code === me.code) throw fail("self");
  const c = await getDoc(doc(db, "codes", code));
  if (!c.exists()) throw fail("notfound");
  const { uid: toUid, name: toName } = c.data();
  const ref = doc(db, "links", linkId(uid, toUid)), ex = await getDoc(ref);
  if (ex.exists()) {
    const d = ex.data();
    if (d.status === "accepted") throw fail("already");
    if (d.toUid === uid) { await updateDoc(ref, { status: "accepted" }); return "accepted"; }
    throw fail("pending");
  }
  await setDoc(ref, {
    members: [uid, toUid].sort(), fromUid: uid, toUid, fromName: me.name, fromCode: me.code, toName, toCode: code,
    status: "pending", createdAt: serverTimestamp(),
  });
  return "sent";
}
export const accept = (id) => updateDoc(doc(db, "links", id), { status: "accepted" });
export const remove = (id) => deleteDoc(doc(db, "links", id)); // decline, cancel or leave

export const msg = (e) => {
  const k = e?.la || e?.code || "";
  const known = {
    noconfig: "Challenge is not set up yet. Add the Firebase config first.",
    badcode: "That ID doesn't look right. It looks like LA-7K4Q9X.",
    self: "That is your own ID.",
    notfound: "No one has that ID. Check the letters with your friend.",
    already: "You are already in a challenge with this friend.",
    pending: "Invite already sent. Waiting for your friend to accept.",
    full: "You already have 6 friends.",
    "permission-denied": "Firebase blocked this (permission-denied). In Firebase open Build > Firestore Database > Rules tab (not Realtime Database, not Storage), select all, paste firestore.rules, click Publish, wait 1 minute, then try again.",
    "not-found": "The Firestore database is not created yet. In Firebase open Firestore Database and click Create database.",
    unavailable: "Cannot reach Firebase. Check your internet. If it is fine, make sure the Firestore database was created.",
    "auth/network-request-failed": "No internet. Try again when you are online.",
    "auth/operation-not-allowed": "Turn on Anonymous sign-in: Firebase, Authentication, Sign-in method, Anonymous, Enable.",
    "auth/admin-restricted-operation": "Turn on Anonymous sign-in: Firebase, Authentication, Sign-in method, Anonymous, Enable.",
    "auth/configuration-not-found": "In Firebase open Authentication and click Get started, then enable Anonymous sign-in.",
    "auth/invalid-api-key": "The apiKey in src/firebase-config.js is wrong. Copy it again from Firebase Project settings.",
    "auth/api-key-not-valid.-please-pass-a-valid-api-key.": "The apiKey in src/firebase-config.js is wrong. Copy it again from Firebase Project settings.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
  };
  return known[k] || `Something went wrong (${k || String(e?.message || e).slice(0, 60)}). Send me this text.`;
};
