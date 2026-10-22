"use strict";
/* Objektaufnahme Pospiech – App
   Offline zuerst: alles wird auf dem Gerät gespeichert und per „Abgleichen“ zum Server (Google Apps Script) übertragen. */

const APP_VERSION = "1.8.1";
const APP_BUILD = Number(window.APP_BUILD || 0);            // wird beim App-Bau gesetzt (0 = Web-Version)
const IS_APP = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
const APK_URL = "https://github.com/dirkpospiech-prog/objektaufnahme/releases/latest/download/Objektaufnahme.apk";
let updateInfo = null;
/* Nur in der Android-App: gibt es auf GitHub eine neuere Fassung? */
async function checkForUpdate() {
  if (!IS_APP || !APP_BUILD || !navigator.onLine) return;
  try {
    const r = await fetch("https://api.github.com/repos/dirkpospiech-prog/objektaufnahme/releases/latest", { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) return; const j = await r.json();
    const build = Number(String(j.tag_name || "").split(".").pop());
    if (build > APP_BUILD) { const neu = !updateInfo; updateInfo = { build, name: j.name || j.tag_name }; if (view === "home") renderHome(false); else if (neu) toast("Neue App-Version verfügbar – Hinweis auf der Startseite"); }
  } catch (e) { /* kein Netz: beim nächsten Start */ }
}
const LS = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
};
const apiUrl = () => (LS.get("apiUrl") || (window.APP_CONFIG && window.APP_CONFIG.API_URL) || "").trim();
let session = (() => { try { return JSON.parse(LS.get("session") || "null"); } catch (e) { return null; } })();
const saveSession = s => { session = s; LS.set("session", s ? JSON.stringify(s) : null); };
const isAdmin = () => session && session.user && session.user.role === "admin";

/* ---------------- Server ---------------- */
class ApiError extends Error { constructor(code, msg, extra) { super(msg); this.code = code; this.extra = extra || {}; } }
async function api(action, payload = {}) {
  const url = apiUrl();
  if (!url) throw new ApiError("no_server", "Es ist noch keine Server-Adresse eingetragen.");
  if (!navigator.onLine) throw new ApiError("offline", "Kein Netz. Alles bleibt auf dem Gerät – später erneut abgleichen.");
  let res;
  try {
    res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, token: session && session.token, ...payload }), redirect: "follow" });
  } catch (e) { throw new ApiError("network", "Server nicht erreichbar. Bitte Netz prüfen und erneut versuchen."); }
  let j;
  try { j = await res.json(); } catch (e) { throw new ApiError("bad_response", "Unerwartete Antwort vom Server (HTTP " + res.status + "). Ist die Server-Adresse richtig?"); }
  if (!j.ok) {
    if (j.error === "auth") { saveSession(null); setTimeout(renderAuth, 50); }
    throw new ApiError(j.error || "error", j.message || "Unbekannter Fehler", j);
  }
  return j;
}

/* ---------------- Speicher auf dem Gerät ---------------- */
let DB = null; const MEM = { objects: new Map(), photos: new Map(), files: new Map() }; let STORAGE_OK = true;
function openDB() {
  return new Promise(res => {
    try {
      const r = indexedDB.open("objektaufnahme", 3);
      r.onupgradeneeded = () => { const d = r.result;
        if (!d.objectStoreNames.contains("objects")) d.createObjectStore("objects", { keyPath: "id" });
        if (!d.objectStoreNames.contains("photos")) d.createObjectStore("photos", { keyPath: "id" }).createIndex("obj", "obj");
        if (!d.objectStoreNames.contains("files")) d.createObjectStore("files", { keyPath: "id" }).createIndex("obj", "obj"); };
      r.onsuccess = () => res(r.result); r.onerror = () => res(null); r.onblocked = () => res(null);
    } catch (e) { res(null); }
  });
}
function tx(name, mode, fn) {
  return new Promise((res, rej) => {
    try { const t = DB.transaction(name, mode); const r = fn(t.objectStore(name)); t.oncomplete = () => res(r && r.result); t.onerror = () => rej(t.error); }
    catch (e) { rej(e); }
  });
}
const store = {
  async all(n) { if (!DB) return [...MEM[n].values()]; return (await tx(n, "readonly", s => s.getAll())) || []; },
  async get(n, id) { if (!DB) return MEM[n].get(id) || null; return (await tx(n, "readonly", s => s.get(id))) || null; },
  async put(n, v) { if (!DB) { MEM[n].set(v.id, v); return; } await tx(n, "readwrite", s => s.put(v)); },
  async del(n, id) { if (!DB) { MEM[n].delete(id); return; } await tx(n, "readwrite", s => s.delete(id)); },
  async filesOf(obj) { if (!DB) return [...MEM.files.values()].filter(p => p.obj === obj); return (await tx("files", "readonly", s => s.index("obj").getAll(obj))) || []; },
  async photosOf(obj) { if (!DB) return [...MEM.photos.values()].filter(p => p.obj === obj); return (await tx("photos", "readonly", s => s.index("obj").getAll(obj))) || []; }
};
const cleanPhoto = p => { const { _t, url, ...r } = p; return r; };

/* ---------------- Zustand & Hilfen ---------------- */
let objects = [], remote = [], cur = null, curPhotos = [], curFiles = [], scanPages = [], docType = "", view = "auth", secIdx = 0, photoCat = PHOTO_CATS[0], busy = false;
const urls = new Map();
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (Date.now().toString(36) + Math.random().toString(36).slice(2, 9));
const today = () => new Date().toISOString().slice(0, 10);
const fmtDate = iso => iso ? new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "";
const fmtTime = iso => iso ? new Date(iso).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
const ICON = {
  back: '<svg class="i" viewBox="0 0 24 24"><path d="M15 18l-6-6 6-6"/></svg>',
  plus: '<svg class="i" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  sync: '<svg class="i" viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2"/><path d="M21 4v5h-5M3 20v-5h5"/></svg>',
  doc: '<svg class="i" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></svg>',
  cam: '<svg class="i" viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
  more: '<svg class="i" viewBox="0 0 24 24"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>',
  user: '<svg class="i" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  cloud: '<svg class="i" viewBox="0 0 24 24"><path d="M7 18a5 5 0 0 1-.5-9.97A6 6 0 0 1 18 9a4.5 4.5 0 0 1 0 9z"/></svg>'
};
function toast(m) { const t = $("#toast"); t.textContent = m; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2800); }
function objTitle(o) { const d = (o && o.data) || {}; return [d.ob_str, d.ob_ort].filter(Boolean).join(", ") || (o && o.title) || "Neue Aufnahme"; }
function filled(f, d) {
  const v = d[f.id];
  if (f.t === "yn") return !!(v && v.v);
  if (f.t === "grid") return Array.isArray(v) && v.some(r => r && Object.values(r).some(Boolean));
  if (f.t === "std") return !!(v && v.lv && v.lv.length);
  if (f.t === "modern" || f.t === "docs") return !!v && Object.values(v).some(r => r && Object.values(r).some(Boolean));
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && String(v).trim() !== "";
}
const isKunde = () => !!(session && session.user && session.user.role === "kunde");
const SEC = () => isKunde() ? KSECTIONS : SECTIONS;
const PHS = () => isKunde() ? KPHASES : PHASES;
const countable = f => !["h", "hint", "stdall"].includes(f.t);
const vis = (x, d) => !x.when || x.when(d);
const optsOf = (f, d) => f.opts ? f.opts(d) : f.o;
const visSections = d => SEC().map((s, i) => i).filter(i => vis(SEC()[i], d));
const visRows = (f, d) => f.rows.map((l, i) => i).filter(i => !f.rowWhen || !f.rowWhen[i] || f.rowWhen[i](d));
/* Nach einer Änderung: Auswahlen bereinigen, die es für die neue Objektart nicht mehr gibt, und Verfahren vorbelegen */
function applyCascade(d) {
  SEC().forEach(s => s.f.forEach(f => {
    if (!f.opts) return; const o = f.opts(d);
    if (f.t === "multi" && Array.isArray(d[f.id])) d[f.id] = d[f.id].filter(v => o.includes(v));
    if (f.t === "single" && d[f.id] && !o.includes(d[f.id])) d[f.id] = "";
  }));
  if (known(d) && (!d.verfahren || !d.verfahren.length)) d.verfahren = [VERFAHREN(d)[0]];
}
const secProgress = (s, d) => { const fs = s.f.filter(f => countable(f) && vis(f, d)); return fs.length ? Math.round(100 * fs.filter(f => filled(f, d)).length / fs.length) : 100; };
function totalProgress(o) { const d = o.data || {}; let a = 0, b = 0; SEC().filter(s => vis(s, d)).forEach(s => s.f.filter(f => countable(f) && vis(f, d)).forEach(f => { b++; if (filled(f, d)) a++; })); return b ? Math.round(100 * a / b) : 0; }
function syncState(o) {
  if (isKunde() && o.locked) return ["ok", "An Immobilien Pospiech übergeben"];
  if (o.goneOnServer) return ["warn", "Auf dem Server gelöscht – Abgleichen legt es neu an"];
  if (!isKunde() && o.serverNewer && o.serverNewer > (o.version || 0)) return ["warn", "Neuere Fassung auf dem Server – bitte abgleichen"];
  if (!o.version) return ["new", "Noch nicht auf dem Server"];
  if (o.dirty || o.pendingPhotos) return ["warn", "Änderungen nicht abgeglichen"];
  return ["ok", "Abgeglichen " + fmtTime(o.lastSync)];
}
function go(v, push = true) { if (push) { try { history.pushState({ v }, ""); } catch (e) {} } }
window.addEventListener("popstate", () => {
  if (!$("#sheet").hidden && !busy) return closeSheet();
  if (view === "obj" || view === "admin" || view === "account") renderHome(false);
});

/* ---------------- Anmeldung ---------------- */
function renderInvite(token, note = "") {
  view = "auth";
  $("#app").innerHTML = `<div class="auth">
    <div class="auth-hero"><div class="wrap"><img class="logo" src="logo.png" alt="Immobilien Pospiech">
      <div class="eyebrow">Immobilien Pospiech · Neuruppin & Rheinsberg</div><h1>Willkommen</h1>
      <p>Hier erfassen Sie die Angaben zu Ihrer Immobilie, Fotos und Unterlagen – in Ruhe und so weit Sie möchten.</p></div></div>
    <div class="auth-card"><div class="wrap" style="display:flex;flex-direction:column;gap:14px">${note}
      <form id="invAcc" style="display:flex;flex-direction:column;gap:12px" novalidate>
        <label class="fld"><span>Ihr Name</span><input type="text" id="ia_name" autocomplete="name"></label>
        <label class="fld"><span>Passwort festlegen (mindestens 8 Zeichen)</span><input type="password" id="ia_pw" autocomplete="new-password"></label>
        <label class="fld"><span>Passwort wiederholen</span><input type="password" id="ia_pw2" autocomplete="new-password"></label>
        <div id="iaMsg" aria-live="polite"></div><button class="btn primary" type="submit" id="iaBtn">Zugang einrichten</button></form>
      <button type="button" class="btn link" id="iaLogin">Ich habe schon ein Passwort – zur Anmeldung</button>
      <div class="foot">Fragen? Büro Neuruppin 03391 65 92 35 · Büro Rheinsberg 033931 34 92 65</div></div></div></div>`;
  const clear = () => { try { history.replaceState({ v: "root" }, "", location.pathname); } catch (e) {} };
  $("#iaLogin").onclick = () => { clear(); renderAuth(); };
  $("#invAcc").onsubmit = async ev => {
    ev.preventDefault(); const m = $("#iaMsg"), pw = $("#ia_pw").value;
    if (pw.length < 8) { m.innerHTML = `<div class="msg err">Das Passwort muss mindestens 8 Zeichen lang sein.</div>`; return; }
    if (pw !== $("#ia_pw2").value) { m.innerHTML = `<div class="msg err">Die beiden Passwörter stimmen nicht überein.</div>`; return; }
    $("#iaBtn").disabled = true;
    try { const r = await api("acceptInvite", { invite: token, name: $("#ia_name").value.trim(), password: pw }); saveSession({ token: r.token, user: r.user }); LS.set("lastEmail", r.user.email); clear(); refreshRemote.at = 0; renderHome(false); }
    catch (e) { m.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; $("#iaBtn").disabled = false; if (e.code === "used") { clear(); setTimeout(() => renderAuth("login", `<div class="msg info">${esc(e.message)}</div>`), 1500); } }
  };
}
function renderAuth(tab = "login", note = "") {
  view = "auth";
  const needServer = !apiUrl();
  $("#app").innerHTML = `<div class="auth">
    <div class="auth-hero"><div class="wrap"><img class="logo" src="logo.png" alt="Immobilien Pospiech">
      <div class="eyebrow">Sachverständigenbüro · Neuruppin</div><h1>Objektaufnahme</h1>
      <p>Ortstermine erfassen, fotografieren und sicher im Büro ablegen – auch ohne Netz.</p></div></div>
    <div class="auth-card"><div class="wrap" style="display:flex;flex-direction:column;gap:14px">
      <div class="tabs" role="tablist"><button role="tab" aria-selected="${tab === "login"}" data-tab="login">Anmelden</button><button role="tab" aria-selected="${tab === "register"}" data-tab="register">Zugang beantragen</button></div>
      ${note}
      ${needServer ? `<div class="msg info">Bitte zuerst die Server-Adresse eintragen (bekommen Sie vom Büro).</div>` : ""}
      <form id="authForm" style="display:flex;flex-direction:column;gap:12px" novalidate>
        ${tab === "register" ? `<label class="fld"><span>Name</span><input type="text" id="a_name" autocomplete="name" required></label>` : ""}
        <label class="fld"><span>E-Mail-Adresse</span><input type="email" id="a_email" autocomplete="username" inputmode="email" value="${esc(LS.get("lastEmail") || "")}" required></label>
        <label class="fld"><span>Passwort${tab === "register" ? " (mind. 8 Zeichen)" : ""}</span><input type="password" id="a_pw" autocomplete="${tab === "register" ? "new-password" : "current-password"}" required></label>
        <div id="authMsg" aria-live="polite"></div>
        <button class="btn primary" type="submit" id="authBtn">${tab === "register" ? "Zugang beantragen" : "Anmelden"}</button>
      </form>
      <details ${needServer ? "open" : ""}><summary style="cursor:pointer;color:var(--muted);font-size:14px;padding:6px 0">Server-Adresse</summary>
        <div style="display:flex;flex-direction:column;gap:8px;padding-top:8px">
          <input type="url" id="a_server" value="${esc(apiUrl())}" placeholder="https://script.google.com/macros/s/…/exec" aria-label="Server-Adresse">
          <button class="btn small" type="button" id="saveServer">Speichern und Verbindung testen</button></div></details>
      <div class="foot">Version ${APP_VERSION} · Immobilien Pospiech GbR · Karl-Marx-Straße 77 · 16816 Neuruppin</div>
    </div></div></div>`;
  document.querySelectorAll("[data-tab]").forEach(b => b.onclick = () => renderAuth(b.dataset.tab));
  $("#saveServer").onclick = async () => {
    const v = $("#a_server").value.trim();
    LS.set("apiUrl", v || null);
    const m = $("#authMsg");
    if (!v) { m.innerHTML = ""; return; }
    try { await api("ping"); m.innerHTML = `<div class="msg ok">Verbindung zum Server steht.</div>`; }
    catch (e) { m.innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
  };
  $("#authForm").onsubmit = async ev => {
    ev.preventDefault();
    const email = $("#a_email").value.trim(), pw = $("#a_pw").value, btn = $("#authBtn"), m = $("#authMsg");
    if (!email || !pw) { m.innerHTML = `<div class="msg err">Bitte E-Mail-Adresse und Passwort eingeben.</div>`; return; }
    btn.disabled = true; m.innerHTML = "";
    try {
      LS.set("lastEmail", email);
      if (tab === "register") {
        const name = $("#a_name").value.trim();
        const r = await api("register", { email, name, password: pw });
        if (r.approved) { const l = await api("login", { email, password: pw }); saveSession({ token: l.token, user: l.user }); return renderHome(); }
        renderAuth("login", `<div class="msg ok">${esc(r.message)}</div>`);
      } else {
        const r = await api("login", { email, password: pw });
        saveSession({ token: r.token, user: r.user }); renderHome();
      }
    } catch (e) { const extra = e.code === "wrong_login" && tab === "login" ? " Noch keinen Zugang? Oben auf „Zugang beantragen“ tippen." : ""; m.innerHTML = `<div class="msg ${e.code === "pending" ? "info" : "err"}">${esc(e.message + extra)}</div>`; btn.disabled = false; }
  };
}

/* ---------------- Übersicht ---------------- */
async function renderHome(push = true) {
  view = "home"; cur = null;
  objects = (await store.all("objects")).sort((a, b) => (b.updated || "").localeCompare(a.updated || ""));
  const localIds = new Set(objects.map(o => o.id));
  const remoteOnly = remote.filter(r => !localIds.has(r.id));
  const card = o => { const [c, t] = syncState(o); const p = totalProgress(o); const d = o.data || {};
    return `<button class="card" data-open="${esc(o.id)}"><div class="t">${esc(objTitle(o))}</div>
      <div class="meta"><span>${esc(d.ob_art || "Objektart offen")}</span>${isKunde() ? "" : `<span>Ortstermin ${esc(fmtDate(d.ot_datum) || "–")}</span>`}${o.kunde && !isKunde() ? `<span>Eigentümer: ${o.kstatus === "übergeben" ? "übergeben" : "eingeladen"}</span>` : ""}<span>${o.photoCount || 0} Fotos</span><span>${p} % erfasst</span></div>
      <div class="bar"><i style="width:${p}%"></i></div><div><span class="chip ${c}">${esc(t)}</span></div></button>`; };
  const rcard = r => `<button class="card remote" data-fetch="${esc(r.id)}"><div class="t">${esc(r.title || "Ohne Bezeichnung")}</div>
      <div class="meta"><span>angelegt von ${esc(r.creator)}</span><span>zuletzt ${esc(fmtTime(r.updated))}</span></div>
      <div><span class="chip cloud">Auf dem Server – antippen zum Laden</span></div></button>`;
  const u = session.user;
  $("#app").innerHTML = `
  <header class="top"><div class="wrap"><img class="logo" src="logo.png" alt="Immobilien Pospiech"><span class="spacer"></span>
    ${isAdmin() ? `<button class="btn ghost" id="toAdmin">Verwaltung</button>` : ""}
    <button class="btn ghost" id="toAccount" aria-label="Konto">${ICON.user}</button></div></header>
  <main class="wrap">
    <div class="home-head"><div class="eyebrow">Angemeldet als ${esc(u.name)}</div><h2>${isKunde() ? "Ihre Immobilie" : "Objektaufnahmen"}</h2></div>
    ${isKunde() ? `<div class="msg info">Willkommen! Hier tragen Sie die Angaben zu Ihrer Immobilie ein und laden Fotos und Unterlagen hoch. Alles wird sofort gespeichert – Sie können jederzeit unterbrechen. Wenn Sie fertig sind, tippen Sie in der Übersicht auf <b>„An Immobilien Pospiech übergeben“</b>.</div>` : ""}
    ${STORAGE_OK ? "" : `<div class="msg warn">Dieses Gerät erlaubt kein dauerhaftes Speichern. Bitte nach jeder Aufnahme sofort abgleichen.</div>`}
    ${navigator.onLine ? "" : `<div class="msg info">Offline. Sie können normal weiterarbeiten – alles bleibt auf dem Gerät.</div>`}
    ${updateInfo ? `<div class="msg warn" style="display:flex;flex-direction:column;gap:10px"><div><b>Neue App-Version verfügbar</b> (${esc(updateInfo.name)}). Bitte installieren – Ihre Aufnahmen bleiben erhalten. Vorher nicht abgeglichene Aufnahmen abgleichen.</div><button type="button" class="btn primary" id="getUpdate">Jetzt herunterladen</button><div style="font-size:12px;word-break:break-all;color:var(--muted)">${APK_URL}</div></div>` : ""}
    <div class="actions">${isKunde() ? "" : `<button class="btn primary" id="newObj">${ICON.plus}Neue Aufnahme</button>`}${isAdmin() ? `<button class="btn" id="homeInv">${ICON.user}Eigentümer einladen</button>` : ""}<button class="btn" id="refresh">${ICON.sync}Aktualisieren</button></div>
    <div id="homeMsg"></div>
    <div class="list">
      ${objects.map(card).join("")}
      ${remoteOnly.map(rcard).join("")}
      ${!objects.length && !remoteOnly.length ? `<div class="empty">${isKunde() ? "Ihre Immobilie wird geladen …<br>Falls hier nichts erscheint, tippen Sie auf „Aktualisieren“." : "Noch keine Aufnahmen.<br>Mit „Neue Aufnahme“ beginnen Sie den Ortstermin."}</div>` : ""}
    </div>
    <div class="foot">Version ${APP_VERSION}${APP_BUILD ? " · Build " + APP_BUILD : " · Web"}</div>
  </main>`;
  if (navigator.onLine && Date.now() - (refreshRemote.at || 0) > 15000) refreshRemote(true);
}
/* Holt die Objektliste vom Server und bringt das Gerät auf den neuesten Stand:
   neue Objekte werden geladen, neuere Fassungen übernommen – außer es gibt hier
   noch nicht abgeglichene Änderungen (dann Hinweis, Entscheidung beim Abgleichen). */
async function refreshRemote(silent) {
  if (refreshRemote.busy) return; refreshRemote.busy = true; refreshRemote.at = Date.now();
  let loaded = 0;
  try {
    const r = await api("listObjects"); remote = r.objects || [];
    const removed = removedIds();
    for (const ro of remote) {
      const lo = await store.get("objects", ro.id);
      if (lo && ro.kstatus != null && (lo.kstatus !== ro.kstatus || lo.kunde !== ro.kunde)) { lo.kstatus = ro.kstatus; lo.kunde = ro.kunde; lo.locked = ro.kstatus === "übergeben"; await store.put("objects", lo); }
      if (!lo && removed.includes(ro.id)) continue;
      if (lo && (lo.version || 0) >= ro.version) { if (lo.serverNewer) { lo.serverNewer = 0; await store.put("objects", lo); } continue; }
      if (lo && (lo.dirty || lo.pendingPhotos)) { if (!isKunde() && lo.serverNewer !== ro.version) { lo.serverNewer = ro.version; await store.put("objects", lo); } continue; }
      if (cur && cur.id === ro.id) continue;      // gerade geöffnet: dort prüfen
      try { await loadServerObject(ro.id); loaded++; } catch (e) { /* einzelnes Objekt später erneut */ }
    }
    const ids = new Set(remote.map(x => x.id));
    for (const lo of await store.all("objects")) {
      if (!lo.version || ids.has(lo.id)) continue;            // nie hochgeladen oder noch vorhanden
      if (lo.dirty || lo.pendingPhotos) { if (!lo.goneOnServer) { lo.goneOnServer = true; await store.put("objects", lo); } continue; }
      await removeLocal(lo.id);                               // gelöscht oder kein Zugriff mehr
    }
    if (view === "home") renderHome(false);
    if (!silent) toast(loaded ? loaded + " Aufnahme(n) aktualisiert" : "Alles auf dem neuesten Stand");
  } catch (e) { if (!silent && $("#homeMsg")) $("#homeMsg").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
  finally { refreshRemote.busy = false; }
}
async function removeLocal(id) {
  for (const p of await store.photosOf(id)) await store.del("photos", p.id);
  for (const f of await store.filesOf(id)) await store.del("files", f.id);
  await store.del("objects", id);
}
const removedIds = () => { try { return JSON.parse(LS.get("removedIds") || "[]"); } catch (e) { return []; } };
/* Beim Öffnen eines Objekts: gibt es auf dem Server eine neuere Fassung? */
async function checkServerVersion() {
  if (!navigator.onLine || !cur || !cur.version) return;
  const id = cur.id;
  try {
    const r = await api("listObjects"); const ro = (r.objects || []).find(x => x.id === id);
    if (ro && cur && cur.id === id && ro.kstatus != null && (cur.kstatus !== ro.kstatus || cur.kunde !== ro.kunde)) { cur.kstatus = ro.kstatus; cur.kunde = ro.kunde; cur.locked = ro.kstatus === "übergeben"; await store.put("objects", cur); if (view === "obj") rerenderKeepScroll(); }
    if (!ro || !cur || cur.id !== id || ro.version <= (cur.version || 0)) return;
    if (cur.dirty || cur.pendingPhotos) { cur.serverNewer = ro.version; await store.put("objects", cur); toast("Auf dem Server gibt es eine neuere Fassung. Beim Abgleichen wählen Sie, welche gilt."); if (view === "obj") rerenderKeepScroll(); return; }
    await loadServerObject(id);
    if (view === "obj" && cur && cur.id === id) { const keep = secIdx; await openObject(id, keep, true); toast("Neueste Fassung vom Server geladen"); }
  } catch (e) { /* offline o. Ä.: später */ }
}
async function newObject() {
  const o = { id: uid(), created: new Date().toISOString(), updated: new Date().toISOString(), data: { ot_datum: today(), stichtag_art: "aktuell (Ortstermin)" }, photoCount: 0, dirty: true, version: 0, creator: session.user.email };
  await store.put("objects", o); openObject(o.id, 2);
}
async function fetchObject(id) {
  sheet(`<h2>Objekt laden</h2><div class="log" id="slog"><div>Wird vom Server geladen …</div></div><button class="btn" data-close>Schließen</button>`);
  try { LS.set("removedIds", JSON.stringify(removedIds().filter(x => x !== id))); await loadServerObject(id); closeSheet(); openObject(id); }
  catch (e) { $("#slog").innerHTML = `<div class="e">${esc(e.message)}</div>`; }
}
async function loadServerObject(id) {
  const r = await api("getObject", { id }); const s = r.object;
  const local = await store.get("objects", id);
  const localPh = local ? await store.photosOf(id) : [];
  for (const p of s.photos || []) { const lp = localPh.find(x => x.id === p.id); await store.put("photos", { ...p, obj: id, blob: lp ? lp.blob : null, thumb: lp ? lp.thumb : null }); }
  const localFiles = local ? await store.filesOf(id) : [];
  for (const f of s.files || []) { const lf = localFiles.find(x => x.id === f.id); await store.put("files", { ...f, obj: id, blob: lf ? lf.blob : null }); }
  for (const lf of localFiles) if (lf.fileId && !(s.files || []).some(f => f.id === lf.id)) await store.del("files", lf.id);
  const o = { id, created: s.created, updated: s.updated, data: s.data || {}, kd: s.kd || {}, kUpdated: s.kUpdated || "", svVersion: s.svVersion || s.version, locked: !!s.locked, kunde: s.kunde || "", kstatus: s.kstatus || "", title: s.title, version: s.version, folderUrl: r.object.folderUrl, creator: s.creator, dirty: false, serverNewer: 0, lastSync: new Date().toISOString() };
  const all = await store.photosOf(id), allF = await store.filesOf(id); o.photoCount = all.length; o.pendingPhotos = all.some(p => !p.fileId) || allF.some(f => !f.fileId);
  await store.put("objects", o);
}
async function openObject(id, sec = "O", refreshOnly = false) {
  cur = await store.get("objects", id); if (!cur) return renderHome(false);
  curPhotos = (await store.photosOf(id)).sort((a, b) => (a.taken || "").localeCompare(b.taken || ""));
  curFiles = (await store.filesOf(id)).sort((a, b) => (a.added || "").localeCompare(b.added || ""));
  view = "obj"; secIdx = sec;
  if (refreshOnly) return rerenderKeepScroll();
  renderObj(); window.scrollTo(0, 0); go("obj");
  checkServerVersion();
}

/* ---------------- Objekt-Ansicht ---------------- */
function renderObj() {
  const d = cur.data; const [c, t] = syncState(cur);
  const tabs = `<button data-sec="O" aria-current="${secIdx === "O"}">Übersicht</button>` + SEC().map((s, i) => !vis(s, d) ? "" : `<button data-sec="${i}" aria-current="${i === secIdx}"><span class="n">${s.n}</span>${esc(s.t)}<span class="p">${secProgress(s, d)}%</span></button>`).join("")
    + `<button data-sec="F" aria-current="${secIdx === "F"}">${ICON.cam}Fotos<span class="p">${curPhotos.length}</span></button>`
    + `<button data-sec="D" aria-current="${secIdx === "D"}">${ICON.doc}Unterlagen<span class="p">${curFiles.length}</span></button>`
    + (cur.kunde && !isKunde() ? `<button data-sec="K" aria-current="${secIdx === "K"}">${ICON.user}Eigentümer</button>` : "");
  $("#app").innerHTML = `
  <header class="top"><div class="wrap">
    <button class="btn ghost" id="home" aria-label="Zur Übersicht">${ICON.back}</button>
    <h1 id="objTitle">${esc(objTitle(cur))}</h1>
    <button class="btn ghost" id="menu" aria-label="Weitere Aktionen">${ICON.more}</button>
    <button class="btn primary" id="sync" aria-label="Abgleichen" ${busy ? "disabled" : ""}>${ICON.sync}<span>Abgleichen</span></button></div>
    <div class="wrap subbar"><span class="chip ${c}" id="syncChip">${esc(t)}</span><span>${totalProgress(cur)} % erfasst</span></div>
    <div class="wrap"><nav class="secnav" id="secnav">${tabs}</nav></div></header>
  <main class="wrap" id="main"></main>`;
  renderSection();
  const a = document.querySelector('.secnav [aria-current="true"]'); if (a && a.scrollIntoView) a.scrollIntoView({ inline: "center", block: "nearest" });
}
function renderSection() {
  const m = $("#main");
  const locked = isKunde() && cur.locked;
  const lockWrap = h => locked ? `<div class="msg ok" style="margin-top:14px">Ihre Angaben wurden an Immobilien Pospiech übergeben – vielen Dank! Für Änderungen rufen Sie uns bitte an: 03391 65 92 35 (Neuruppin) oder 033931 34 92 65 (Rheinsberg).</div><fieldset disabled class="fs">${h}</fieldset>` : h;
  if (secIdx === "F") { m.innerHTML = lockWrap(photosHTML()); bindPhotos(); return; }
  if (secIdx === "O") { m.innerHTML = overviewHTML(); return; }
  if (secIdx === "D") { m.innerHTML = lockWrap(docsHTML()); bindDocs(); return; }
  if (secIdx === "K") { m.innerHTML = kundeHTML(); return; }
  const d = cur.data, list = visSections(d);
  if (!list.includes(secIdx)) secIdx = list.find(i => i > secIdx) ?? list[list.length - 1];
  const s = SEC()[secIdx], pos = list.indexOf(secIdx), prev = list[pos - 1], next = list[pos + 1];
  const hint = !known(d) && !s.f.some(f => f.id === "ob_art") ? `<div class="msg info">Tipp: Erst die <b>${isKunde() ? "Art der Immobilie" : "Objektart"}</b> wählen (Abschnitt ${SEC()[artSec()].n}) – dann erscheinen nur noch die passenden Fragen.</div>` : "";
  m.innerHTML = lockWrap(`<section class="sec"><div class="sec-head"><span class="num">${s.n}</span><h2>${esc(s.t)}</h2></div>${hint}
    <div class="grp">${s.f.filter(f => vis(f, d)).map(f => fieldHTML(f, d)).join("")}</div></section>`) + `
    <div class="secfoot">${prev !== undefined ? `<button class="btn" data-go="${prev}">‹ ${esc(SEC()[prev].t)}</button>` : `<button class="btn" data-go="O">‹ Übersicht</button>`}
    ${next !== undefined ? `<button class="btn primary" data-go="${next}">${esc(SEC()[next].t)} ›</button>` : `<button class="btn primary" data-go="F">Fotos ›</button>`}</div>`;
}
const artSec = () => SEC().findIndex(s => s.f.some(f => f.id === "ob_art"));
/* Objekt-Übersicht: alle Abschnitte nach Arbeitsschritten, mit Fortschritt */
function overviewHTML() {
  const d = cur.data, [c, t] = syncState(cur), pend = curPhotos.filter(p => !p.fileId).length;
  const row = id => {
    if (id === "D") { const pf = curFiles.filter(f => !f.fileId).length; return `<button class="ov-row" data-sec="D"><span class="ov-n">${ICON.doc}</span><span class="ov-t">Unterlagen (Scans, PDFs)</span><span class="ov-p">${curFiles.length}${pf ? ` · ${pf} neu` : ""}</span></button>`; }
    if (id === "F") return `<button class="ov-row" data-sec="F"><span class="ov-n">${ICON.cam}</span><span class="ov-t">Fotos</span><span class="ov-p">${curPhotos.length}${pend ? ` · ${pend} neu` : ""}</span></button>`;
    const i = SEC().findIndex(x => x.id === id), s = SEC()[i]; if (!vis(s, d)) return "";
    const p = secProgress(s, d);
    return `<button class="ov-row" data-sec="${i}"><span class="ov-n">${s.n}</span><span class="ov-t">${esc(s.t)}</span><span class="ov-p${p === 100 ? " done" : ""}">${p === 100 ? "✓" : p + " %"}</span><span class="ov-bar"><i style="width:${p}%"></i></span></button>`;
  };
  return `<section class="sec">
    ${!known(d) ? `<div class="msg info">Zuerst die <b>Objektart</b> wählen – dann zeigt die App nur noch die passenden Fragen. <button type="button" class="btn small" data-sec="${artSec()}" style="margin-top:8px">${isKunde() ? "Art der Immobilie" : "Objektart"} wählen</button></div>` : `<div class="ov-meta"><b>${esc(d.ob_art)}</b>${d.ot_datum ? " · Ortstermin " + esc(fmtDate(d.ot_datum)) : ""}</div>`}
    ${PHS().map(ph => `<div class="ov-group"><h3>${esc(ph.t)}</h3>${ph.s.map(row).join("")}</div>`).join("")}
    ${cur.kunde && !isKunde() ? `<div class="ov-group"><h3>Eigentümer</h3><button class="ov-row" data-sec="K"><span class="ov-n">${ICON.user}</span><span class="ov-t">Angaben des Eigentümers</span><span class="ov-p">${cur.kstatus === "übergeben" ? "übergeben" : "in Arbeit"}</span></button></div>` : ""}
    <div class="ov-sync"><span class="chip ${c}">${esc(t)}</span>${isKunde() && cur.locked ? "" : `<button type="button" class="btn ${isKunde() ? "" : "primary"}" id="sync2">${ICON.sync}${isKunde() ? "Zwischenspeichern" : "Jetzt abgleichen"}</button>`}</div>
    ${isKunde() && !cur.locked ? `<button type="button" class="btn primary" id="submitK" style="width:100%">Fertig – an Immobilien Pospiech übergeben</button>` : ""}
    <p class="foot">${isKunde() ? "Ihre Eingaben werden sofort auf diesem Gerät gespeichert. „Zwischenspeichern“ schickt sie schon jetzt an uns; nach dem Übergeben können Sie nichts mehr ändern." : "Alle Eingaben werden sofort auf diesem Gerät gespeichert. „Abgleichen“ überträgt sie ins Büro."}</p></section>`;
}
function kundeHTML() {
  const kd = cur.kd || {}, rows = protocolFor(KSECTIONS, kd), mine = curPhotos.filter(p => p.by === cur.kunde).length, mineF = curFiles.filter(f => f.by === cur.kunde).length;
  return `<section class="sec"><div class="sec-head"><span class="num">E</span><h2>Eigentümer</h2></div>
    <div class="ov-meta">${esc(cur.kunde)} · <b>${cur.kstatus === "übergeben" ? "Angaben übergeben" : "Eingabe läuft"}</b>${cur.kUpdated ? " · zuletzt gespeichert " + esc(fmtTime(cur.kUpdated)) : ""} · ${mine} Fotos, ${mineF} Unterlagen</div>
    <div class="actions stack" style="padding:0">
      <button type="button" class="btn primary" id="kTake">Angaben in die Aufnahme übernehmen (nur leere Felder)</button>
      ${isAdmin() && cur.kstatus === "übergeben" ? `<button type="button" class="btn" id="kReopen">Wieder zur Bearbeitung freigeben</button>` : ""}
      ${isAdmin() ? `<button type="button" class="btn" id="kInvite">Einladung erneut senden</button>` : ""}</div>
    ${rows.length ? rows.map(sec => `<div class="kblock"><h3>${esc(sec.title)}</h3>${sec.rows.map(([a, b]) => `<div class="krow"><span>${esc(a)}</span><b>${esc(b).replace(/\n/g, "<br>")}</b></div>`).join("")}</div>`).join("") : `<div class="empty">Der Eigentümer hat noch nichts eingetragen.</div>`}
    <p class="foot">Fotos und Unterlagen des Eigentümers finden Sie in den Reitern „Fotos“ und „Unterlagen“ (gekennzeichnet mit „Eigentümer“).</p></section>`;
}
function takeOver() {
  const kd = cur.kd || {}, d = cur.data; let n = 0;
  const empty = v => v == null || v === "" || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.keys(v).length);
  for (const [k, t] of Object.entries(K_TO_SV)) {
    const v = kd[k]; if (empty(v)) continue;
    if (k === "mod") { const m = d.mod || {}; for (const [ri, r] of Object.entries(v)) { if (r && (r.j || r.u || r.d) && !(m[ri] && (m[ri].j || m[ri].u || m[ri].d))) { m[ri] = { ...r }; n++; } } d.mod = m; continue; }
    if (!empty(d[t])) continue;
    d[t] = JSON.parse(JSON.stringify(v)); n++;
  }
  applyCascade(d); touch(); renderObj();
  toast(n ? n + " Angabe(n) übernommen – bitte prüfen" : "Keine leeren Felder zum Übernehmen");
}
function pills(id, opts, val, multi) {
  return `<div class="pills" role="group">${opts.map(o => { const on = multi ? (val || []).includes(o) : val === o;
    return `<button type="button" class="pill" aria-pressed="${on}" data-k="${esc(id)}" data-v="${esc(o)}" data-m="${multi ? 1 : 0}">${esc(o)}</button>`; }).join("")}</div>`;
}
function fieldHTML(f, d) {
  const v = d[f.id];
  switch (f.t) {
    case "h": return `<div class="sub">${esc(f.l)}</div>`;
    case "hint": return `<div class="hint">${esc(f.l)}</div>`;
    case "text": return `<label class="fld${f.full ? " full" : ""}"><span>${esc(f.l)}</span><input type="${f.type || "text"}" id="f_${f.id}" data-k="${f.id}" value="${esc(v)}"${f.num ? ' inputmode="decimal"' : ""} autocomplete="off"></label>`;
    case "area": return `<label class="fld full"><span>${esc(f.l)}</span><textarea id="f_${f.id}" data-k="${f.id}">${esc(v)}</textarea></label>`;
    case "single": case "multi": return `<div class="fld full"><span>${esc(f.l)}</span>${pills(f.id, optsOf(f, d), v, f.t === "multi")}</div>`;
    case "yn": { const y = v || {};
      return `<div class="yn"><div class="q">${esc(f.l)}</div><div class="row"><div class="seg" role="group" aria-label="${esc(f.l)}">${[["Ja", f.good ? "n" : "y"], ["Nein", f.good ? "y" : "n"], ["unbek.", "u"]].map(([l, c]) => `<button type="button" class="${c}" aria-pressed="${y.v === l}" data-yn="${f.id}" data-v="${l}">${l}</button>`).join("")}</div>
        <input type="text" id="f_${f.id}_n" data-ynote="${f.id}" value="${esc(y.n)}" placeholder="Erläuterung" aria-label="Erläuterung ${esc(f.l)}"></div></div>`; }
    case "stdall": return `<div class="fld full stdall"><span>${esc(f.l)}</span><div class="pills">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="pill" data-stdall="${n}">Stufe ${n}</button>`).join("")}</div></div>`;
    case "std": { const st = v || {}; const lv = st.lv || []; const L = ["1 sehr einfach", "2 einfach", "3 mittel", "4 gehoben", "5 stark gehoben"];
      return `<div class="std"><h3>${esc(f.l)}</h3>${f.o.map((t, i) => `<button type="button" class="lv" aria-pressed="${lv.includes(i + 1)}" data-std="${f.id}" data-v="${i + 1}"><span class="bx"></span><b>${L[i]}</b><span class="d">${esc(t)}</span></button>`).join("")}
        <div class="note"><input type="text" id="f_${f.id}_n" data-stdnote="${f.id}" value="${esc(st.n)}" placeholder="Bemerkung (z. B. Fenster EG neu, OG alt)" aria-label="Bemerkung ${esc(f.l)}"></div></div>`; }
    case "grid": { const rows = Array.isArray(v) && v.length ? v : [{}];
      return `<div class="rows">${rows.map((r, ri) => `<div class="rowcard"><div class="rl"><span>${esc(f.l)} ${ri + 1}</span>${rows.length > 1 ? `<button type="button" class="btn link" style="color:var(--bad)" data-gdel="${f.id}" data-r="${ri}">Entfernen</button>` : ""}</div>
        ${f.cols.map(([k, l, full, num]) => `<label class="fld${full ? " full" : ""}"><span>${esc(l)}</span><input type="text" id="f_${f.id}_${ri}_${k}" data-g="${f.id}" data-r="${ri}" data-c="${k}" value="${esc((r || {})[k])}"${num ? ' inputmode="decimal"' : ""}></label>`).join("")}</div>`).join("")}
        <button type="button" class="btn" data-gadd="${f.id}">${ICON.plus}Weitere Zeile</button></div>`; }
    case "modern": { const mv = v || {};
      return `<div class="rows">${f.rows.map((l, ri) => { const r = mv[ri] || {}; return `<div class="rowcard"><div class="rl"><span>${esc(l)}</span></div>
        <label class="fld"><span>Jahr</span><input type="text" inputmode="numeric" id="f_mod_${ri}_j" data-mod="${ri}" data-c="j" value="${esc(r.j)}"></label>
        <div class="fld"><span>Umfang</span>${pills("mod:" + ri, ["vollständig", "teilweise"], r.u, false)}</div>
        <label class="fld full"><span>Details / Kosten</span><input type="text" id="f_mod_${ri}_d" data-mod="${ri}" data-c="d" value="${esc(r.d)}"></label></div>`; }).join("")}</div>`; }
    case "docs": { const dv = v || {};
      const cnt = ri => curFiles.filter(x => x.docRow === ri && (isKunde() || !cur.kunde || x.by !== cur.kunde)).length;
      return `<div class="doc" style="border:0"><button type="button" class="btn" data-sec="D">${ICON.doc}Unterlagen scannen oder als Datei anhängen</button></div>` + visRows(f, d).map(ri => `<div class="doc"><div>${esc(f.rows[ri])}${cnt(ri) ? ` <span class="chip ok">${cnt(ri)} Datei${cnt(ri) > 1 ? "en" : ""}</span>` : ""}</div>${pills("doc:" + ri, f.o, (dv[ri] || {}).s, false)}</div>`).join(""); }
  }
  return "";
}

/* ---------------- Eingaben ---------------- */
let saveT = null;
function touch() {
  cur.updated = new Date().toISOString(); cur.dirty = true; cur.title = objTitle(cur);
  clearTimeout(saveT); saveT = setTimeout(() => store.put("objects", cur).catch(() => toast("Speichern auf dem Gerät fehlgeschlagen")), 300);
  const chip = $("#syncChip"); if (chip && cur.version) { chip.className = "chip warn"; chip.textContent = "Änderungen nicht abgeglichen"; }
  const t = $("#objTitle"); if (t) t.textContent = objTitle(cur);
  document.querySelectorAll("#secnav [data-sec]").forEach(b => { if (!/^\d+$/.test(b.dataset.sec)) return; const p = b.querySelector(".p"); if (p) p.textContent = secProgress(SEC()[+b.dataset.sec], cur.data) + "%"; });
}
document.addEventListener("change", e => {
  if (view === "obj" && e.target.dataset && e.target.dataset.k && DEPENDS.has(e.target.dataset.k) && e.target.tagName === "INPUT") rerenderKeepScroll();
  if (view === "obj" && e.target.dataset && e.target.dataset.pcat) {
    const p = curPhotos.find(x => x.id === e.target.dataset.pcat); if (!p) return;
    p.cat = e.target.value; store.put("photos", cleanPhoto(p)); cur.dirty = true; touch(); rerenderKeepScroll();
  }
});
document.addEventListener("input", e => {
  if (view !== "obj") return;
  const el = e.target, d = cur.data, ds = el.dataset;
  if (ds.k) d[ds.k] = el.value;
  else if (ds.ynote) d[ds.ynote] = { ...(d[ds.ynote] || {}), n: el.value };
  else if (ds.stdnote) d[ds.stdnote] = { ...(d[ds.stdnote] || {}), n: el.value };
  else if (ds.g) { const a = Array.isArray(d[ds.g]) && d[ds.g].length ? d[ds.g] : [{}]; a[+ds.r] = { ...(a[+ds.r] || {}), [ds.c]: el.value }; d[ds.g] = a; }
  else if (ds.mod) { const m = d.mod || {}; m[ds.mod] = { ...(m[ds.mod] || {}), [ds.c]: el.value }; d.mod = m; }
  else if (ds.cap) { const p = curPhotos.find(x => x.id === ds.cap); if (p) { p.caption = el.value; clearTimeout(p._t); p._t = setTimeout(() => store.put("photos", cleanPhoto(p)), 400); } }
  else return;
  touch();
});
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  const ds = b.dataset;
  if (b.id === "newObj") return newObject();
  if (b.id === "refresh") return refreshRemote(false);
  if (b.id === "getUpdate") { window.location.href = APK_URL; return; }
  if (b.id === "camBtn") return takeNativePhoto();
  if (b.id === "submitK") return submitKunde();
  if (b.id === "kTake") return takeOver();
  if (b.id === "kReopen") return reopenKunde();
  if (b.id === "kInvite") return inviteSheet(cur.id, objTitle(cur), cur.kunde);
  if (b.id === "scanBtn" || b.id === "scanMore") return scanPage();
  if (b.id === "scanDone") return finishScan();
  if (b.id === "scanCancel") { scanPages = []; return renderSection(); }
  if (ds.fview) return viewDoc(ds.fview);
  if (ds.fdel) return confirmSheet("Unterlage löschen?", ds.onServer === "1" ? "Die Unterlage wird aus der Aufnahme entfernt (wirksam nach dem nächsten Abgleich). Die Datei bleibt zur Sicherheit im Drive-Ordner „Unterlagen“." : "Die Datei ist noch nicht auf dem Server und geht damit endgültig verloren.", "Löschen", () => deleteDoc(ds.fdel));
  if (b.id === "toAdmin") return renderAdmin("users", true);
  if (b.id === "homeInv") return inviteSheet(null, "", "");
  if (b.id === "toAccount") return accountSheet();
  if (ds.open) return openObject(ds.open);
  if (ds.fetch) return fetchObject(ds.fetch);
  if (view !== "obj" || !cur) return;
  const d = cur.data;
  if (b.id === "home") { clearTimeout(saveT); await store.put("objects", cur); return history.back(); }
  if (b.id === "sync" || b.id === "sync2") return syncNow();
  if (b.id === "menu") return objMenu();
  if (ds.sec !== undefined || ds.go !== undefined) { const v = ds.sec ?? ds.go; secIdx = ["F", "O", "D", "K"].includes(v) ? v : +v; renderObj(); window.scrollTo(0, 0); return; }
  if (ds.k && ds.v !== undefined) {
    let val;
    if (ds.k.startsWith("mod:") || ds.k.startsWith("doc:")) {
      const key = ds.k.startsWith("mod:") ? "mod" : "docs", f = key === "mod" ? "u" : "s", ri = ds.k.slice(4);
      const m = d[key] || {}; const r = m[ri] || {}; r[f] = r[f] === ds.v ? "" : ds.v; m[ri] = r; d[key] = m; val = r[f];
    } else if (ds.m === "1") { const a = new Set(d[ds.k] || []); a.has(ds.v) ? a.delete(ds.v) : a.add(ds.v); d[ds.k] = [...a]; }
    else { d[ds.k] = d[ds.k] === ds.v ? "" : ds.v; val = d[ds.k]; }
    if (DEPENDS.has(ds.k)) { applyCascade(d); touch(); return rerenderKeepScroll(); }
    b.parentElement.querySelectorAll(".pill").forEach(p => p.setAttribute("aria-pressed", ds.m === "1" ? (d[ds.k] || []).includes(p.dataset.v) : p.dataset.v === val));
    return touch();
  }
  if (ds.yn) { const y = d[ds.yn] || {}; y.v = y.v === ds.v ? "" : ds.v; d[ds.yn] = y; if (DEPENDS.has(ds.yn)) { touch(); return rerenderKeepScroll(); } b.parentElement.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x.dataset.v === y.v)); return touch(); }
  if (ds.stdall) {
    const n = +ds.stdall; let k = 0;
    SEC().forEach(sec => sec.f.forEach(f => { if (f.t === "std" && vis(f, d) && !((d[f.id] || {}).lv || []).length) { d[f.id] = { ...(d[f.id] || {}), lv: [n] }; k++; } }));
    touch(); rerenderKeepScroll(); return toast(k ? `Stufe ${n} für ${k} Bauteil(e) übernommen` : "Alle Bauteile sind bereits eingestuft");
  }
  if (ds.std) { const st = d[ds.std] || {}; const lv = new Set(st.lv || []); const n = +ds.v; lv.has(n) ? lv.delete(n) : lv.add(n); st.lv = [...lv].sort(); d[ds.std] = st; b.setAttribute("aria-pressed", lv.has(n)); return touch(); }
  if (ds.gadd) { const a = Array.isArray(d[ds.gadd]) && d[ds.gadd].length ? d[ds.gadd] : [{}]; a.push({}); d[ds.gadd] = a; touch(); return renderSection(); }
  if (ds.gdel) { const a = d[ds.gdel] || []; a.splice(+ds.r, 1); d[ds.gdel] = a; touch(); return renderSection(); }
  if (ds.cat) { photoCat = ds.cat; return renderSection(); }
  if (ds.delph) return confirmSheet("Foto löschen?", ds.onServer === "1" ? "Das Foto wird aus der Aufnahme entfernt (wirksam nach dem nächsten Abgleich). Die Bilddatei bleibt zur Sicherheit im Drive-Ordner „Fotos“." : "Das Foto ist noch nicht auf dem Server und geht damit endgültig verloren.", "Foto löschen", () => deletePhoto(ds.delph));
  if (ds.full) return showPhoto(ds.full);
});

function rerenderKeepScroll() { const y = window.scrollY; renderObj(); window.scrollTo(0, y); }

/* ---------------- Unterlagen (Scans, PDFs, Bilder) ---------------- */
const docRows = () => { const f = SEC().flatMap(s => s.f).find(x => x.t === "docs"); return visRows(f, cur.data).map(i => ({ i, l: f.rows[i] })); };
const fileLabel = f => f.label || docLabel(f.docRow);
const docLabel = ri => { const f = SEC().flatMap(s => s.f).find(x => x.t === "docs"); return ri >= 0 ? f.rows[ri] : "Sonstige Unterlage"; };
const fmtSize = n => n > 1048576 ? (n / 1048576).toFixed(1).replace(".", ",") + " MB" : Math.max(1, Math.round(n / 1024)) + " KB";
function docsHTML() {
  const rows = docRows(); if (docType === "" && rows.length) docType = String(rows[0].i);
  const pend = curFiles.filter(f => !f.fileId).length;
  return `<section class="sec"><div class="sec-head"><span class="num">U</span><h2>Unterlagen</h2></div>
    <div class="hint" style="font-style:normal;color:var(--muted)">Gescannte Seiten werden zu einer PDF zusammengefasst. Nach dem Abgleich liegen alle Dateien im Drive-Ordner des Objekts unter „Unterlagen“.</div>
    <label class="fld"><span>Art der Unterlage</span><select id="docType">${rows.map(r => `<option value="${r.i}"${String(r.i) === docType ? " selected" : ""}>${esc(r.l)}</option>`).join("")}<option value="-1"${docType === "-1" ? " selected" : ""}>Sonstige Unterlage</option></select></label>
    ${scanPages.length ? `<div class="scanbox"><b>Scan: ${scanPages.length} Seite${scanPages.length > 1 ? "n" : ""}</b>
        <div class="scanthumbs">${scanPages.map((b, i) => `<img src="${URL.createObjectURL(b)}" alt="Seite ${i + 1}">`).join("")}</div>
        <div class="actions" style="padding:0">${nativeCamera() ? `<button type="button" class="btn" id="scanMore">${ICON.cam}Weitere Seite</button>` : `<label class="btn addph">${ICON.cam}Weitere Seite<input type="file" accept="image/*" capture="environment" id="scanIn" aria-label="Weitere Seite fotografieren"></label>`}<button type="button" class="btn primary" id="scanDone">Fertig – als PDF speichern</button></div>
        <button type="button" class="btn link" id="scanCancel" style="color:var(--bad)">Scan verwerfen</button></div>`
      : `<div class="actions stack" style="padding:0">
        ${nativeCamera() ? `<button type="button" class="btn primary" id="scanBtn">${ICON.cam}Dokument scannen</button>` : `<label class="btn primary addph">${ICON.cam}Dokument scannen<input type="file" accept="image/*" capture="environment" id="scanIn" aria-label="Seite fotografieren"></label>`}
        <label class="btn addph">${ICON.plus}Datei wählen (PDF, Bild)<input type="file" accept="application/pdf,image/jpeg,image/png" multiple id="docIn" aria-label="Datei wählen"></label></div>`}
    <div style="font-size:14px;color:var(--muted)">${curFiles.length} Datei(en) · ${pend ? `<b style="color:var(--warn)">${pend} noch nicht auf dem Server</b>` : "alle auf dem Server"}</div>
    <div class="filelist">${curFiles.map(f => `<div class="filerow"><span class="ficon">${f.mime === "application/pdf" ? "PDF" : "BILD"}</span>
        <div class="finfo"><b>${esc(fileLabel(f))}</b><span>${esc(f.name || "")}${f.size ? " · " + fmtSize(f.size) : ""}${f.pages ? " · " + f.pages + " S." : ""}</span><span>${f.fileId ? "✓ auf dem Server" : "nicht abgeglichen"}</span></div>
        <div class="factions">${f.blob ? `<button type="button" class="btn small" data-fview="${f.id}">Ansehen</button>` : ""}<button type="button" class="btn small danger" data-fdel="${f.id}" data-on-server="${f.fileId ? 1 : 0}">Löschen</button></div></div>`).join("") || `<div class="empty">Noch keine Unterlagen. Art wählen, dann scannen oder eine Datei wählen.</div>`}</div>
  </section>`;
}
function bindDocs() {
  const t = $("#docType"); if (t) t.onchange = () => { docType = t.value; };
  const si = $("#scanIn"); if (si) si.onchange = async ev => { const f = ev.target.files[0]; if (f) { scanPages.push(await compressScan(f)); renderSection(); } };
  const di = $("#docIn"); if (di) di.onchange = ev => addDocFiles(ev.target.files);
}
async function compressScan(file) { return await shrink(file, 2000, 0.72); }
async function scanPage() {
  if (!nativeCamera()) { const i = $("#scanIn"); if (i) i.click(); else { renderSection(); setTimeout(() => { const j = $("#scanIn"); if (j) j.click(); }, 50); } return; }
  try {
    const ph = await nativeCamera().getPhoto({ quality: 90, source: "CAMERA", resultType: "uri", saveToGallery: false, correctOrientation: true, width: 2000 });
    const blob = await fetch(ph.webPath).then(r => r.blob());
    scanPages.push(await compressScan(blob)); renderSection();
  } catch (e) { const m = String((e && e.message) || e); if (!/cancel/i.test(m)) toast("Kamera konnte nicht geöffnet werden: " + m); }
}
let pdfLib = null;
function loadPdfLib() {
  if (pdfLib) return pdfLib;
  pdfLib = new Promise((res, rej) => { const sc = document.createElement("script"); sc.src = "vendor/jspdf.umd.min.js"; sc.onload = () => res(window.jspdf.jsPDF); sc.onerror = () => { pdfLib = null; rej(new Error("PDF-Modul nicht geladen")); }; document.head.appendChild(sc); });
  return pdfLib;
}
async function finishScan() {
  if (!scanPages.length) return;
  toast("PDF wird erstellt …");
  try {
    const jsPDF = await loadPdfLib();
    let pdf = null;
    for (const b of scanPages) {
      const bmp = await createImageBitmap(b); const land = bmp.width > bmp.height; const w = bmp.width, h = bmp.height; if (bmp.close) bmp.close();
      const pw = land ? 297 : 210, phh = land ? 210 : 297, m = 6, sc = Math.min((pw - 2 * m) / w, (phh - 2 * m) / h);
      if (!pdf) pdf = new jsPDF({ orientation: land ? "landscape" : "portrait", unit: "mm", format: "a4", compress: true });
      else pdf.addPage("a4", land ? "landscape" : "portrait");
      const data = new Uint8Array(await b.arrayBuffer());
      pdf.addImage(data, "JPEG", (pw - w * sc) / 2, (phh - h * sc) / 2, w * sc, h * sc, undefined, "FAST");
    }
    const blob = pdf.output("blob");
    await storeDoc(blob, "application/pdf", "pdf", scanPages.length);
    scanPages = []; renderObj(); toast("Scan als PDF gespeichert");
  } catch (e) { toast("PDF konnte nicht erstellt werden: " + e.message); }
}
async function addDocFiles(files) {
  for (const f of files || []) {
    if (f.size > 25 * 1024 * 1024) { toast("„" + f.name + "“ ist zu groß (max. 25 MB)."); continue; }
    const mime = f.type === "application/pdf" ? "application/pdf" : f.type === "image/png" ? "image/png" : "image/jpeg";
    const blob = mime === "application/pdf" ? f : await shrink(f, 2400, 0.8);
    await storeDoc(blob, mime === "application/pdf" ? mime : "image/jpeg", mime === "application/pdf" ? "pdf" : "jpg", 0);
  }
  renderObj();
}
async function storeDoc(blob, mime, ext, pages) {
  const ri = Number(docType === "" ? -1 : docType);
  const base = safeName(docLabel(ri).replace(/\s*\(.*?\)/g, "")).replace(/[ ,/.]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 50);
  const f = { id: uid(), obj: cur.id, docRow: ri, label: docLabel(ri), mime, blob, size: blob.size, pages, added: new Date().toISOString(), by: session.user.email };
  f.name = `${base}_${f.id.slice(-6)}.${ext}`;
  await store.put("files", f); curFiles.push(f);
  if (ri >= 0) { const df = SEC().flatMap(x => x.f).find(x => x.t === "docs"); const m = cur.data.docs || {}; m[ri] = { ...(m[ri] || {}), s: df.o[0] }; cur.data.docs = m; }
  cur.pendingPhotos = true; touch();
}
async function deleteDoc(id) {
  await store.del("files", id); curFiles = curFiles.filter(f => f.id !== id); cur.dirty = true; cur.pendingPhotos = curPhotos.some(p => !p.fileId) || curFiles.some(f => !f.fileId);
  await store.put("objects", cur); renderObj();
}
function viewDoc(id) {
  const f = curFiles.find(x => x.id === id); if (!f || !f.blob) return;
  const u = URL.createObjectURL(f.blob);
  if (f.mime !== "application/pdf") return sheet(`<h2>${esc(fileLabel(f))}</h2><img src="${u}" alt="" style="max-height:65vh;width:auto;max-width:100%"><button class="btn" data-close>Schließen</button>`);
  if (IS_APP) return sheet(`<h2>${esc(fileLabel(f))}</h2><p style="margin:0">PDF mit ${f.pages || "?"} Seite(n), ${fmtSize(f.size)}. PDFs lassen sich in der App nicht direkt anzeigen – nach dem Abgleich im Drive-Ordner „Unterlagen“ ansehen.</p><button class="btn" data-close>Schließen</button>`);
  window.open(u, "_blank");
}

/* ---------------- Fotos ---------------- */
function photosHTML() {
  const groups = PHOTO_CATS.map(c => [c, curPhotos.filter(p => p.cat === c)]).filter(([, a]) => a.length);
  const pend = curPhotos.filter(p => !p.fileId).length;
  return `<section class="sec"><div class="sec-head"><span class="num">F</span><h2>Fotos</h2></div>
    <div class="fld"><span>Kategorie für neue Fotos</span><div class="pills">${PHOTO_CATS.map(c => `<button type="button" class="pill" aria-pressed="${c === photoCat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}</div></div>
    <div class="actions" style="padding:0">
      ${nativeCamera() ? `<button type="button" class="btn primary" id="camBtn">${ICON.cam}Foto aufnehmen</button>` : `<label class="btn primary addph">${ICON.cam}Foto aufnehmen<input type="file" accept="image/*" capture="environment" id="camIn" aria-label="Foto aufnehmen"></label>`}
      <label class="btn addph">${ICON.plus}Aus Galerie<input type="file" accept="image/*" multiple id="galIn" aria-label="Fotos aus Galerie wählen"></label></div>
    <div style="font-size:14px;color:var(--muted)">${curPhotos.length} Fotos · ${pend ? `<b style="color:var(--warn)">${pend} noch nicht auf dem Server</b>` : "alle auf dem Server"}</div>
    ${groups.length ? groups.map(([c, a]) => `<div class="catgroup"><h3>${esc(c)} (${a.length})</h3><div class="photogrid">${a.map(p => `
      <div class="ph"><button type="button" class="img" data-thumb="${p.id}" data-full="${p.id}" style="border:0;padding:0" aria-label="Foto vergrößern">${p.blob || p.thumb ? "" : "Vorschau laden"}</button><div class="body">
        <input type="text" id="cap_${p.id}" data-cap="${p.id}" value="${esc(p.caption)}" placeholder="Beschriftung" aria-label="Beschriftung">
        <select data-pcat="${p.id}" aria-label="Kategorie ändern">${PHOTO_CATS.map(c => `<option${c === p.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <div class="acts"><span>${p.fileId ? "✓ auf dem Server" : "nicht abgeglichen"}${p.by && cur.kunde && p.by === cur.kunde && !isKunde() ? " · Eigentümer" : p.by && p.by !== session.user.email && !isKunde() ? " · " + esc(p.by.split("@")[0]) : ""}</span><button type="button" data-delph="${p.id}" data-on-server="${p.fileId ? 1 : 0}">Löschen</button></div></div></div>`).join("")}</div></div>`).join("")
      : `<div class="empty">Noch keine Fotos. Kategorie wählen und „Foto aufnehmen“ tippen.</div>`}</section>`;
}
function photoUrl(p) {
  const b = p.blob || p.thumb; if (!b) return null;
  let u = urls.get(p.id); if (!u) { u = URL.createObjectURL(b); urls.set(p.id, u); } return u;
}
function bindPhotos() {
  document.querySelectorAll("[data-thumb]").forEach(async el => {
    const p = curPhotos.find(x => x.id === el.dataset.thumb); if (!p) return;
    const u = photoUrl(p); if (u) { el.innerHTML = `<img src="${u}" alt="${esc(p.cat + " " + (p.caption || ""))}" loading="lazy">`; return; }
    if (p.fileId && navigator.onLine) {
      try { const r = await api("getPhoto", { objectId: cur.id, fileId: p.fileId }); p.thumb = b64ToBlob(r.b64, r.mime); await store.put("photos", cleanPhoto(p)); const u2 = photoUrl(p); if (u2) el.innerHTML = `<img src="${u2}" alt="">`; }
      catch (e) { el.textContent = "Vorschau nicht verfügbar"; }
    }
  });
  ["#camIn", "#galIn"].forEach(s => { const i = $(s); if (i) i.addEventListener("change", ev => addPhotos(ev.target.files)); });
}
function b64ToBlob(b64, mime) { const bin = atob(b64); const a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: mime || "image/jpeg" }); }
function blobToB64(blob) { return new Promise((r, j) => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.onerror = () => j(fr.error); fr.readAsDataURL(blob); }); }
/* Fotogröße: Standard ca. 150–250 KB (1600 px), hoch ca. 400–600 KB (2000 px) */
const PHOTO_PRESETS = { standard: { edge: 1600, q: 0.7, max: 300000 }, hoch: { edge: 2000, q: 0.82, max: 700000 } };
const photoPreset = () => PHOTO_PRESETS[LS.get("photoQuality")] || PHOTO_PRESETS.standard;
async function compressPhoto(file) {
  const pr = photoPreset();
  let b = await shrink(file, pr.edge, pr.q);
  if (b && b.size > pr.max) b = await shrink(file, pr.edge, pr.q - 0.12);           // sehr detailreiche Motive
  if (b && b.size > pr.max * 1.4) b = await shrink(file, Math.round(pr.edge * 0.85), pr.q - 0.15);
  return b;
}
async function shrink(file, maxEdge = 1600, q = 0.7) {
  let bmp; try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); } catch (e) { bmp = await createImageBitmap(file); }
  const s = Math.min(1, maxEdge / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height); if (bmp.close) bmp.close();
  return await new Promise(r => c.toBlob(r, "image/jpeg", q));
}
/* In der Android-App: Kamera direkt über das Kamera-Modul öffnen (nicht über die Galerie) */
const nativeCamera = () => IS_APP && window.Capacitor.Plugins && window.Capacitor.Plugins.Camera;
async function takeNativePhoto() {
  try {
    const ph = await nativeCamera().getPhoto({ quality: 90, source: "CAMERA", resultType: "uri", saveToGallery: false, correctOrientation: true, width: photoPreset().edge });
    const blob = await fetch(ph.webPath).then(r => r.blob());
    await addPhotos([blob]);
  } catch (e) {
    const m = String((e && e.message) || e);
    if (/cancel/i.test(m)) return;
    if (/denied|permission/i.test(m)) return toast("Bitte der App den Zugriff auf die Kamera erlauben (Android-Einstellungen → Apps → Objektaufnahme → Berechtigungen).");
    toast("Kamera konnte nicht geöffnet werden: " + m);
  }
}
async function addPhotos(files) {
  if (!files || !files.length) return;
  toast(files.length > 1 ? files.length + " Fotos werden gespeichert …" : "Foto wird gespeichert …");
  for (const f of files) {
    try { const blob = await compressPhoto(f); const p = { id: uid(), obj: cur.id, cat: photoCat, caption: "", taken: new Date().toISOString(), by: session.user.email, blob };
      await store.put("photos", p); curPhotos.push(p); }
    catch (e) { toast("Ein Foto konnte nicht gelesen werden."); }
  }
  cur.photoCount = curPhotos.length; cur.pendingPhotos = true; cur.dirty = true; cur.updated = new Date().toISOString();
  await store.put("objects", cur); renderObj();
}
async function deletePhoto(id) {
  await store.del("photos", id); curPhotos = curPhotos.filter(p => p.id !== id);
  const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); }
  cur.photoCount = curPhotos.length; cur.pendingPhotos = curPhotos.some(p => !p.fileId) || curFiles.some(f => !f.fileId); cur.dirty = true;
  await store.put("objects", cur); renderObj();
}
async function showPhoto(id) {
  const p = curPhotos.find(x => x.id === id); if (!p) return;
  let u = p.blob ? photoUrl(p) : null;
  sheet(`<h2>${esc(p.cat)}</h2><div id="big" style="background:var(--sunk);min-height:200px;display:grid;place-items:center">${u ? `<img src="${u}" alt="" style="max-height:60vh;width:auto;max-width:100%">` : "Wird geladen …"}</div><div>${esc(p.caption || "")}</div><button class="btn" data-close>Schließen</button>`);
  if (!u && p.fileId) {
    try { const r = await api("getPhoto", { objectId: cur.id, fileId: p.fileId, full: true }); const big = URL.createObjectURL(b64ToBlob(r.b64, r.mime)); $("#big").innerHTML = `<img src="${big}" alt="" style="max-height:60vh;width:auto;max-width:100%">`; }
    catch (e) { $("#big").textContent = e.message; }
  }
}

/* ---------------- Dialoge ---------------- */
function sheet(html) { $("#sheetBody").innerHTML = html; $("#sheet").hidden = false; }
function closeSheet() { $("#sheet").hidden = true; }
$("#sheet").addEventListener("click", e => { if ((e.target.id === "sheet" && !busy) || e.target.closest("[data-close]")) closeSheet(); });
function confirmSheet(title, text, label, fn) {
  sheet(`<h2>${esc(title)}</h2><p style="margin:0">${esc(text)}</p><div style="display:flex;gap:10px"><button class="btn" data-close style="flex:1">Abbrechen</button><button class="btn danger" id="cOk" style="flex:1">${esc(label)}</button></div>`);
  $("#cOk").onclick = async () => { closeSheet(); await fn(); };
}
function objMenu() {
  sheet(`<h2>${esc(objTitle(cur))}</h2>
    ${cur.folderUrl && isAdmin() ? `<a class="btn" href="${esc(cur.folderUrl)}" target="_blank" rel="noopener">Ordner in Google Drive öffnen</a>` : ""}
    ${cur.version ? `<button class="btn" id="reload">Neueste Fassung vom Server laden</button>` : ""}
    <button class="btn" id="delObj">Nur von diesem Gerät entfernen</button>
    ${isAdmin() ? `<button class="btn" id="invK">${cur.kunde ? "Eigentümer erneut einladen" : "Eigentümer einladen"}</button>` : ""}
    ${isAdmin() && cur.version ? `<button class="btn danger" id="delAll">Objekt löschen (für alle)</button>` : ""}
    <button class="btn" data-close>Schließen</button>`);
  const da = $("#delAll"); if (da) da.onclick = () => adminDelete(cur.id, objTitle(cur));
  const ik = $("#invK"); if (ik) ik.onclick = () => { if (!cur.version) return toast("Bitte die Aufnahme zuerst einmal abgleichen."); inviteSheet(cur.id, objTitle(cur), cur.kunde); };
  const rl = $("#reload"); if (rl) rl.onclick = () => {
    const doIt = async () => { try { await loadServerObject(cur.id); closeSheet(); openObject(cur.id, secIdx); toast("Neueste Fassung geladen"); } catch (e) { toast(e.message); } };
    if (cur.dirty) confirmSheet("Lokale Änderungen verwerfen?", "Auf diesem Gerät gibt es Änderungen, die noch nicht auf dem Server sind. Sie gehen verloren.", "Laden", doIt); else doIt();
  };
  $("#delObj").onclick = () => confirmSheet("Aufnahme entfernen?", (cur.dirty || cur.pendingPhotos) ? "Achtung: Änderungen oder Fotos sind noch nicht auf dem Server und gehen verloren." : "Die Aufnahme wird nur von diesem Gerät entfernt. Auf dem Server bleibt alles erhalten.", "Entfernen", async () => {
    await removeLocal(cur.id);
    LS.set("removedIds", JSON.stringify([...new Set([...removedIds(), cur.id])])); cur = null; renderHome(false);
  });
}
function accountSheet() {
  const u = session.user;
  sheet(`<h2>${esc(u.name)}</h2><div style="color:var(--muted)">${esc(u.email)} · ${u.role === "admin" ? "Admin" : "Nutzer"}</div>
    <form id="pwForm" style="display:flex;flex-direction:column;gap:10px">
      <label class="fld"><span>Bisheriges Passwort</span><input type="password" id="pw_old" autocomplete="current-password"></label>
      <label class="fld"><span>Neues Passwort (mind. 8 Zeichen)</span><input type="password" id="pw_new" autocomplete="new-password"></label>
      <div id="pwMsg"></div><button class="btn" type="submit">Passwort ändern</button></form>
    <div class="fld"><span>Fotogröße</span><div class="pills">
      <button type="button" class="pill" data-pq="standard" aria-pressed="${!LS.get("photoQuality") || LS.get("photoQuality") === "standard"}">Standard (ca. 200 KB)</button>
      <button type="button" class="pill" data-pq="hoch" aria-pressed="${LS.get("photoQuality") === "hoch"}">Hohe Qualität (ca. 500 KB)</button></div>
      <span style="font-weight:400">Gilt für neue Fotos auf diesem Gerät. Standard reicht für Gutachten.</span></div>
    <button class="btn danger" id="logout">Abmelden</button><button class="btn" data-close>Schließen</button>`);
  $("#pwForm").onsubmit = async ev => { ev.preventDefault();
    try { await api("changePassword", { oldPassword: $("#pw_old").value, newPassword: $("#pw_new").value }); $("#pwMsg").innerHTML = `<div class="msg ok">Passwort geändert.</div>`; }
    catch (e) { $("#pwMsg").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; } };
  document.querySelectorAll("[data-pq]").forEach(b => b.onclick = () => { LS.set("photoQuality", b.dataset.pq); document.querySelectorAll("[data-pq]").forEach(x => x.setAttribute("aria-pressed", x === b)); toast("Fotogröße gespeichert"); });
  $("#logout").onclick = async () => {
    const pending = (await store.all("objects")).some(o => o.dirty || o.pendingPhotos);
    const out = async () => { try { await api("logout"); } catch (e) {} saveSession(null); remote = []; refreshRemote.at = 0; closeSheet(); renderAuth(); };
    if (pending) confirmSheet("Trotzdem abmelden?", "Es gibt Aufnahmen, die noch nicht abgeglichen sind. Sie bleiben auf dem Gerät und können nach der nächsten Anmeldung abgeglichen werden.", "Abmelden", out); else out();
  };
}

/* ---------------- Abgleich ---------------- */
function protocol() {
  const out = protocolFor(SEC(), cur.data);
  if (!isKunde() && cur.kd && Object.keys(cur.kd).length) { const k = protocolFor(KSECTIONS, cur.kd); if (k.length) out.push({ title: "Angaben des Eigentümers", rows: k.flatMap(x => x.rows.map(([a, b]) => [x.title + ": " + a, b])) }); }
  if (curFiles.length) out.push({ title: "Unterlagen (Dateien im Ordner „Unterlagen“)", rows: curFiles.map(f => [fileLabel(f), (f.name || "") + (f.pages ? " · " + f.pages + " Seite(n)" : "")]) });
  if (curPhotos.length) out.push({ title: "Fotodokumentation", rows: curPhotos.map(p => [p.name || p.cat, [p.cat, p.caption].filter(Boolean).join(" – ")]) });
  return out;
}
function protocolFor(sections, d) {
  const out = [];
  for (const s of sections) {
    if (!vis(s, d)) continue;
    const rows = [];
    for (const f of s.f) {
      if (!countable(f) || !vis(f, d) || !filled(f, d)) continue; const v = d[f.id];
      if (f.t === "yn") rows.push([f.l, v.v + (v.n ? " – " + v.n : "")]);
      else if (f.t === "std") rows.push([f.l, "Stufe " + v.lv.join(", ") + (v.n ? " – " + v.n : "")]);
      else if (f.t === "grid") v.forEach((r, i) => { const t = f.cols.map(([k, l]) => r && r[k] ? l + ": " + r[k] : "").filter(Boolean).join("; "); if (t) rows.push([f.l + " " + (i + 1), t]); });
      else if (f.t === "modern") f.rows.forEach((l, i) => { const r = v[i]; if (r && (r.j || r.u || r.d)) rows.push([l, [r.j, r.u, r.d].filter(Boolean).join(" · ")]); });
      else if (f.t === "docs") visRows(f, d).forEach(i => { const r = v[i]; if (r && r.s) rows.push([f.rows[i], r.s]); });
      else if (Array.isArray(v)) rows.push([f.l, v.join(", ")]);
      else rows.push([f.l, String(v)]);
    }
    if (rows.length) out.push({ title: s.n + ". " + s.t, rows });
  }
  return out;
}
const safeName = s => String(s || "").replace(/[\\/:*?"<>|#\n\r]+/g, " ").replace(/\s+/g, " ").trim();
function photoName(p) { const i = PHOTO_CATS.indexOf(p.cat) + 1; return `${String(i).padStart(2, "0")}_${safeName(p.cat).replace(/ \/ /g, "-").replace(/ /g, "_")}_${p.id.slice(-6)}.jpg`; }
const fileMeta = () => curFiles.filter(f => f.fileId).map(f => ({ id: f.id, docRow: f.docRow, label: fileLabel(f), mime: f.mime, name: f.name, size: f.size, pages: f.pages || 0, added: f.added, by: f.by || "", fileId: f.fileId }));
const photoMeta = () => curPhotos.filter(p => p.fileId).map(p => ({ id: p.id, cat: p.cat, caption: p.caption || "", taken: p.taken, by: p.by || "", fileId: p.fileId, name: p.name }));
function slog(m, c = "") { const l = $("#slog"); if (l) l.insertAdjacentHTML("beforeend", `<div class="${c}">${esc(m)}</div>`); }
function bar(p) { const b = $("#sbar"); if (b) b.style.width = p + "%"; }
async function saveRemote(force) {
  const r = await api("saveObject", { object: { id: cur.id, title: objTitle(cur), data: cur.data, photos: photoMeta(), files: fileMeta(), created: cur.created }, baseVersion: cur.version || 0, baseSv: cur.svVersion != null ? cur.svVersion : (cur.version || 0), force: !!force, protocol: protocol() });
  cur.version = r.version; if (r.svVersion) cur.svVersion = r.svVersion; if (r.folderUrl) cur.folderUrl = r.folderUrl; await store.put("objects", cur);
}
async function syncNow(force = false) {
  if (busy) return;
  sheet(`<h2>Abgleichen</h2><div class="bar"><i id="sbar" style="width:3%"></i></div><div class="log" id="slog"></div><button class="btn" data-close id="sclose" disabled>Schließen</button>`);
  busy = true; clearTimeout(saveT); await store.put("objects", cur);
  try {
    slog("Aufnahme speichern …");
    await saveRemote(force); bar(15);
    const todo = curPhotos.filter(p => !p.fileId && p.blob);
    let n = 0;
    for (const p of todo) {
      p.name = p.name || photoName(p);
      let b64 = await blobToB64(p.blob);
      const r = await api("uploadPhoto", { objectId: cur.id, name: p.name, b64, category: p.cat, caption: p.caption || "" });
      p.fileId = r.fileId; await store.put("photos", cleanPhoto(p));
      n++; slog(`Foto ${n}/${todo.length} übertragen`, "o"); bar(15 + 75 * n / todo.length);
    }
    const ftodo = curFiles.filter(f => !f.fileId && f.blob); let k = 0;
    for (const f of ftodo) {
      const r = await api("uploadDoc", { objectId: cur.id, name: f.name, mime: f.mime, docType: fileLabel(f), b64: await blobToB64(f.blob) });
      f.fileId = r.fileId; await store.put("files", f);
      k++; slog(`Unterlage ${k}/${ftodo.length} übertragen`, "o");
    }
    cur.pendingPhotos = curPhotos.some(p => !p.fileId) || curFiles.some(f => !f.fileId);
    if (todo.length || ftodo.length || curPhotos.some(p => p.fileId) || curFiles.some(f => f.fileId)) await saveRemote(true);
    cur.dirty = false; cur.serverNewer = 0; cur.goneOnServer = false; cur.lastSync = new Date().toISOString(); await store.put("objects", cur); bar(100);
    try { await loadServerObject(cur.id); const keep = secIdx; await openObject(cur.id, keep, true); } catch (e) { /* zusammengeführte Fassung später */ }
    slog(isKunde() ? "Gespeichert. Ihre Angaben, Fotos und Unterlagen sind bei Immobilien Pospiech angekommen." : "Abgleich abgeschlossen. Daten, Fotos und Protokoll liegen im Büro-Drive.", "o");
  } catch (e) {
    if (e.code === "conflict") {
      slog(e.message + " (" + fmtTime(e.extra.updated) + ")", "e");
      $("#slog").insertAdjacentHTML("afterend", `<div class="msg warn">Wählen Sie, welche Fassung gelten soll. Tipp: Server-Fassung laden und Ihre Ergänzungen danach erneut eintragen, dann geht nichts verloren.</div><button class="btn" id="cfLoad">Server-Fassung laden (meine Änderungen verwerfen)</button><button class="btn danger" id="cfMine">Meine Fassung speichern (Server-Fassung überschreiben)</button>`);
      $("#cfLoad").onclick = async () => { try { await loadServerObject(cur.id); closeSheet(); openObject(cur.id, secIdx); } catch (x) { toast(x.message); } };
      $("#cfMine").onclick = () => { busy = false; syncNow(true); };
    } else {
      slog(e.message, "e");
      if (["network", "offline"].includes(e.code)) slog("Bereits übertragene Fotos sind markiert. Beim nächsten Abgleich geht es dort weiter.");
    }
    await store.put("objects", cur);
  } finally {
    busy = false; const c = $("#sclose"); if (c) c.disabled = false;
    if (view === "obj") { const keep = secIdx; renderObj(); secIdx = keep; }
  }
}

/* ---------------- Verwaltung (Admin) ---------------- */
async function renderAdmin(tab = "users", push = false) {
  view = "admin"; if (push) go("admin");
  $("#app").innerHTML = `<header class="top"><div class="wrap"><button class="btn ghost" id="adminBack" aria-label="Zurück">${ICON.back}</button><h1>Verwaltung</h1></div></header>
    <main class="wrap"><div class="tabs seg" style="margin-top:10px"><button data-at="users" aria-selected="${tab === "users"}">Benutzer</button><button data-at="access" aria-selected="${tab === "access"}">Objektzugriff</button><button data-at="kunden" aria-selected="${tab === "kunden"}">Eigentümer</button></div>
    <div id="adm" class="list" style="padding-top:14px"><div class="empty">Wird geladen …</div></div></main>`;
  $("#adminBack").onclick = () => history.back();
  document.querySelectorAll("[data-at]").forEach(b => b.onclick = () => renderAdmin(b.dataset.at));
  try {
    const users = (await api("listUsers")).users;
    if (tab === "users") return adminUsers(users);
    const objs = (await api("listObjects")).objects;
    if (tab === "kunden") return adminKunden(objs, users);
    adminAccess(objs, users.filter(u => u.role !== "kunde"));
  } catch (e) { $("#adm").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; }
}
function adminUsers(users) {
  const order = { beantragt: 0, freigegeben: 1, gesperrt: 2 };
  users.sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name));
  $("#adm").innerHTML = users.map(u => `<div class="admin-row"><div class="who"><b>${esc(u.name)}</b><span class="chip ${u.status === "freigegeben" ? "ok" : u.status === "beantragt" ? "warn" : "new"}">${esc(u.status)}${u.role === "admin" ? " · Admin" : u.role === "kunde" ? " · Eigentümer" : ""}</span></div>
    <div style="color:var(--muted);font-size:14px">${esc(u.email)} · beantragt ${esc(fmtDate(u.requestedAt))}${u.lastLogin ? " · zuletzt " + esc(fmtTime(u.lastLogin)) : ""}</div>
    <div class="btns">${u.status !== "freigegeben" ? `<button class="btn small primary" data-us="${esc(u.email)}" data-st="freigegeben">Freigeben</button>` : ""}
      ${u.status !== "gesperrt" && u.email !== session.user.email ? `<button class="btn small danger" data-us="${esc(u.email)}" data-st="gesperrt">Sperren</button>` : ""}
      ${u.email !== session.user.email && u.role !== "kunde" ? `<button class="btn small" data-us="${esc(u.email)}" data-ro="${u.role === "admin" ? "nutzer" : "admin"}">${u.role === "admin" ? "Admin-Rechte entziehen" : "Zum Admin machen"}</button>` : ""}
      <button class="btn small" data-reset="${esc(u.email)}">Passwort zurücksetzen</button></div></div>`).join("") || `<div class="empty">Noch keine Benutzer.</div>`;
  $("#adm").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    try {
      if (b.dataset.us) { await api("setUser", { email: b.dataset.us, status: b.dataset.st, role: b.dataset.ro }); toast("Gespeichert"); return renderAdmin("users"); }
      if (b.dataset.reset) { const r = await api("resetPassword", { email: b.dataset.reset });
        sheet(`<h2>Neues Passwort</h2><p style="margin:0">Teilen Sie dieses vorläufige Passwort ${esc(b.dataset.reset)} persönlich oder telefonisch mit. Es sollte nach der Anmeldung geändert werden.</p><div style="font-size:24px;font-weight:700;letter-spacing:.08em;user-select:all;padding:10px;background:var(--sunk)">${esc(r.tempPassword)}</div><button class="btn" data-close>Fertig</button>`); }
    } catch (x) { toast(x.message); }
  };
}
function inviteSheet(objectId, title, email) {
  sheet(`<h2>Eigentümer einladen</h2><p style="margin:0">${objectId ? `Für <b>${esc(title)}</b>.` : "Legt ein neues Objekt an und lädt den Eigentümer dazu ein."} Der Eigentümer erhält einen persönlichen Link, vergibt ein Passwort und sieht nur den Verkaufs-Fragebogen zu diesem Objekt.</p>
    <form id="invForm" style="display:flex;flex-direction:column;gap:10px" novalidate>
      ${objectId ? "" : `<label class="fld"><span>Adresse des Objekts</span><input type="text" id="inv_title" placeholder="Straße Nr., Ort" required></label>`}
      <label class="fld"><span>Name des Eigentümers</span><input type="text" id="inv_name" autocomplete="off" required></label>
      <label class="fld"><span>E-Mail-Adresse</span><input type="email" id="inv_mail" value="${esc(email || "")}" autocomplete="off" required></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="inv_send" checked> Einladung per E-Mail senden</label>
      <div id="invMsg"></div><button class="btn primary" type="submit" id="invGo">Einladen</button></form><button class="btn" data-close>Schließen</button>`);
  $("#invForm").onsubmit = async ev => {
    ev.preventDefault(); $("#invGo").disabled = true;
    const mail = $("#inv_mail").value.trim().toLowerCase();
    try {
      const r = await api("createInvite", { objectId: objectId || "", title: objectId ? "" : $("#inv_title").value.trim(), name: $("#inv_name").value.trim(), email: $("#inv_mail").value.trim(), sendMail: $("#inv_send").checked });
      $("#invForm").innerHTML = `<div class="msg ok">${r.mailed ? "Die Einladung wurde per E-Mail verschickt." : "Einladung erstellt."} ${r.existing ? "Der Eigentümer hat schon einen Zugang und sieht das Objekt beim nächsten Anmelden." : "Sie können den Link auch selbst weitergeben (z. B. per SMS oder WhatsApp):"}</div>
        ${r.existing ? "" : `<div style="font-size:14px;word-break:break-all;user-select:all;padding:10px;background:var(--sunk)" id="invLink">${esc(r.link)}</div><button type="button" class="btn" id="invCopy">Link kopieren</button>`}`;
      const cp = $("#invCopy"); if (cp) cp.onclick = async () => { try { await navigator.clipboard.writeText(r.link); toast("Link kopiert"); } catch (e) { toast("Bitte den Link markieren und kopieren"); } };
      refreshRemote.at = 0;
      if (cur && cur.id === r.objectId) { cur.kunde = mail; cur.kstatus = "offen"; await store.put("objects", cur); if (view === "obj") renderObj(); }
      if (!objectId) refreshRemote(true);
    } catch (e) { $("#invMsg").innerHTML = `<div class="msg err">${esc(e.message)}</div>`; $("#invGo").disabled = false; }
  };
}
function submitKunde() {
  confirmSheet("Angaben übergeben?", "Ihre Angaben, Fotos und Unterlagen werden an Immobilien Pospiech geschickt. Danach können Sie nichts mehr ändern – für Ergänzungen rufen Sie uns einfach an.", "Jetzt übergeben", async () => {
    await syncNow();
    if (cur.dirty || cur.pendingPhotos) return toast("Bitte zuerst erfolgreich speichern (Internetverbindung prüfen).");
    try { await api("submitKunde", { objectId: cur.id }); cur.locked = true; cur.kstatus = "übergeben"; await store.put("objects", cur); closeSheet(); renderObj(); toast("Vielen Dank! Ihre Angaben sind übergeben."); }
    catch (e) { toast(e.message); }
  });
}
async function reopenKunde() {
  try { await api("reopenKunde", { objectId: cur.id }); cur.kstatus = "offen"; await store.put("objects", cur); renderObj(); toast("Der Eigentümer kann wieder bearbeiten"); }
  catch (e) { toast(e.message); }
}
function adminDelete(id, title) {
  sheet(`<h2>Objekt löschen?</h2><p style="margin:0"><b>${esc(title)}</b> wird für alle Nutzer gelöscht. Der Drive-Ordner mit Fotos, Unterlagen und Protokoll kommt in den Google-Drive-Papierkorb und kann dort 30 Tage lang wiederhergestellt werden.</p>
    <label class="fld"><span>Zur Bestätigung LÖSCHEN eintippen</span><input type="text" id="delConfirm" autocomplete="off"></label>
    <div style="display:flex;gap:10px"><button class="btn" data-close style="flex:1">Abbrechen</button><button class="btn danger" id="delGo" style="flex:1" disabled>Endgültig löschen</button></div>`);
  $("#delConfirm").oninput = e => { $("#delGo").disabled = e.target.value.trim().toUpperCase() !== "LÖSCHEN"; };
  $("#delGo").onclick = async () => {
    $("#delGo").disabled = true;
    try { await api("deleteObject", { objectId: id }); await removeLocal(id); remote = remote.filter(x => x.id !== id); closeSheet(); toast("Objekt gelöscht"); if (view === "admin") renderAdmin("access"); else { cur = null; renderHome(false); } }
    catch (e) { toast(e.message); $("#delGo").disabled = false; }
  };
}
function adminKunden(objs, users) {
  const ks = objs.filter(o => o.kunde);
  const name = m => (users.find(u => u.email === m) || {}).name || "";
  $("#adm").innerHTML = `<button type="button" class="btn primary" id="newInv">${ICON.plus}Eigentümer einladen (neues Objekt)</button>
    <div class="hint" style="font-style:normal;color:var(--muted)">Für ein bestehendes Objekt: Aufnahme öffnen → ⋯ → Eigentümer einladen.</div>` +
    (ks.map(o => `<div class="admin-row"><div class="who"><b>${esc(o.title || "Ohne Bezeichnung")}</b><span class="chip ${o.kstatus === "übergeben" ? "ok" : "warn"}">${o.kstatus === "übergeben" ? "übergeben" : "in Arbeit"}</span></div>
      <div style="color:var(--muted);font-size:14px">${esc(name(o.kunde))} ${esc(o.kunde)} · zuletzt ${esc(fmtTime(o.updated))}</div>
      <div class="btns">${o.kstatus === "übergeben" ? `<button class="btn small" data-kopen="${esc(o.id)}">Wieder freigeben</button>` : ""}<button class="btn small" data-kinv="${esc(o.id)}">Einladung erneut senden</button></div></div>`).join("") || `<div class="empty">Noch keine Eigentümer eingeladen.</div>`);
  $("#adm").onclick = async e => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.id === "newInv") return inviteSheet(null, "", "");
    const o = objs.find(x => x.id === (b.dataset.kopen || b.dataset.kinv)); if (!o) return;
    if (b.dataset.kinv) return inviteSheet(o.id, o.title, o.kunde);
    try { await api("reopenKunde", { objectId: o.id }); toast("Wieder freigegeben"); renderAdmin("kunden"); } catch (x) { toast(x.message); }
  };
}
function adminAccess(objs, users) {
  const ok = users.filter(u => u.status === "freigegeben");
  $("#adm").innerHTML = objs.map(o => `<div class="admin-row"><div class="who"><b>${esc(o.title || "Ohne Bezeichnung")}</b><span style="color:var(--muted);font-size:13px">angelegt von ${esc(o.creator)}</span></div>
    <div class="emails">${o.access.map(m => `<span>${esc(m)}<button type="button" aria-label="Zugriff entfernen" data-rm="${esc(o.id)}" data-m="${esc(m)}">×</button></span>`).join("") || `<span style="color:var(--muted)">nur Ersteller und Admins</span>`}</div>
    <div style="display:flex;gap:6px"><select data-sel="${esc(o.id)}" aria-label="Benutzer auswählen"><option value="">Benutzer hinzufügen …</option>${ok.filter(u => u.email !== o.creator && !o.access.includes(u.email)).map(u => `<option value="${esc(u.email)}">${esc(u.name)} (${esc(u.email)})</option>`).join("")}</select><button type="button" class="btn small danger" data-odel="${esc(o.id)}">Löschen</button></div></div>`).join("") || `<div class="empty">Noch keine Objekte auf dem Server.</div>`;
  const save = async (o, list) => { try { await api("setAccess", { objectId: o.id, emails: list }); toast("Zugriff gespeichert"); renderAdmin("access"); } catch (x) { toast(x.message); } };
  $("#adm").onclick = e => { const od = e.target.closest("[data-odel]"); if (od) { const o = objs.find(x => x.id === od.dataset.odel); return adminDelete(o.id, o.title || "Ohne Bezeichnung"); } const b = e.target.closest("[data-rm]"); if (!b) return; const o = objs.find(x => x.id === b.dataset.rm); save(o, o.access.filter(m => m !== b.dataset.m)); };
  $("#adm").onchange = e => { const s = e.target.closest("[data-sel]"); if (!s || !s.value) return; const o = objs.find(x => x.id === s.dataset.sel); save(o, [...o.access, s.value]); };
}

/* ---------------- Start ---------------- */
(async () => {
  DB = await openDB(); if (!DB) STORAGE_OK = false;
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
  window.addEventListener("online", () => { if (view === "home") renderHome(false); else if (view === "obj") checkServerVersion(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkForUpdate(); if (document.visibilityState !== "visible" || !session) return; if (view === "home") refreshRemote(true); else if (view === "obj") checkServerVersion(); });
  window.addEventListener("offline", () => { if (view === "home") renderHome(false); });
  try { history.replaceState({ v: "root" }, ""); } catch (e) {}
  const invTok = new URLSearchParams(location.search).get("einladung");
  if (invTok) renderInvite(invTok);
  else if (session && session.token) renderHome(false); else renderAuth();
  checkForUpdate();
  if ("serviceWorker" in navigator && location.protocol === "https:" && !window.Capacitor) { try { navigator.serviceWorker.register("sw.js"); } catch (e) {} }
})();
