/**
 * Objektaufnahme Pospiech – Server (Google Apps Script)
 *
 * Läuft in Ihrem Google-Konto, speichert alle Aufnahmen und Fotos in Ihrem
 * Google Drive und verwaltet Benutzer in einer Google-Tabelle.
 *
 * Einrichtung (einmalig, siehe Anleitung):
 *  1. Diesen Code in ein neues Apps-Script-Projekt einfügen.
 *  2. Oben die Funktion „setup“ auswählen und auf „Ausführen“ klicken, Zugriff erlauben.
 *  3. „Bereitstellen“ → „Neue Bereitstellung“ → Typ „Web-App“,
 *     Ausführen als: „Ich“, Zugriff: „Jeder“. Die Web-App-URL in die App eintragen.
 */

const CONFIG = {
  // Drive-Ordner „Objektaufnahmen (App)“ – hier entstehen die Objektordner
  ROOT_FOLDER_ID: '1idz0oqS8e05Y91BPfiUxiX24zc_tVaG_',
  // Wer neue Zugangsanfragen per E-Mail gemeldet bekommt und beim ersten Login automatisch Admin wird
  ADMIN_EMAIL: 'dirkpospiech@googlemail.com',
  APP_NAME: 'Objektaufnahme Pospiech',
  // Adresse der Web-App – wird in Einladungen an Eigentümer verwendet
  APP_URL: 'https://dirkpospiech-prog.github.io/objektaufnahme/',
  INVITE_DAYS: 30,
  SESSION_DAYS: 60,
  MAX_LOGIN_FAILS: 8,          // danach 15 Minuten Sperre
  HASH_ROUNDS: 400
};

const SHEETS = {
  users: { name: 'Benutzer', head: ['E-Mail', 'Name', 'Status', 'Rolle', 'Beantragt am', 'Freigegeben am', 'Letzter Login', 'Hash', 'Salt'] },
  objects: { name: 'Objekte', head: ['Objekt-ID', 'Bezeichnung', 'Drive-Ordner', 'Angelegt von', 'Zugriff (E-Mails, mit Komma getrennt)', 'Angelegt am', 'Geändert am', 'Geändert von', 'Version', 'Ordner-ID', 'Eigentümer (Kunde)', 'Eigentümer-Status'] },
  invites: { name: 'Einladungen', head: ['Token-Hash', 'E-Mail', 'Name', 'Objekt-ID', 'Erstellt', 'Gültig bis', 'Eingelöst'] },
  sessions: { name: 'Sitzungen', head: ['Token-Hash', 'E-Mail', 'Gültig bis'] },
  log: { name: 'Protokoll', head: ['Zeit', 'E-Mail', 'Aktion', 'Details'] }
};
const STATUS = { REQ: 'beantragt', OK: 'freigegeben', BLOCKED: 'gesperrt' };
const ROLE = { USER: 'nutzer', ADMIN: 'admin', KUNDE: 'kunde' };
const KSTATUS = { OPEN: 'offen', DONE: 'übergeben' };

/* ======================= Einrichtung ======================= */
function setup() {
  const props = PropertiesService.getScriptProperties();
  let ss;
  const existing = props.getProperty('SHEET_ID');
  if (existing) {
    ss = SpreadsheetApp.openById(existing);
  } else {
    ss = SpreadsheetApp.create('Objektaufnahme – Verwaltung');
    DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID));
    props.setProperty('SHEET_ID', ss.getId());
  }
  Object.keys(SHEETS).forEach(function (k) {
    const def = SHEETS[k];
    let sh = ss.getSheetByName(def.name);
    if (!sh) sh = ss.insertSheet(def.name);
    sh.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#006F9E').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  });
  const first = ss.getSheetByName('Tabelle1') || ss.getSheetByName('Sheet1');
  if (first && ss.getSheets().length > 1) ss.deleteSheet(first);

  const users = ss.getSheetByName(SHEETS.users.name);
  users.getRange('C2:C1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([STATUS.REQ, STATUS.OK, STATUS.BLOCKED], true).build());
  users.getRange('D2:D1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([ROLE.USER, ROLE.ADMIN, ROLE.KUNDE], true).build());
  users.hideColumns(8, 2);
  users.setColumnWidths(1, 7, 160);
  const objs = ss.getSheetByName(SHEETS.objects.name);
  objs.setColumnWidths(1, 9, 170); objs.setColumnWidth(5, 320); objs.hideColumns(10);
  ss.getSheetByName(SHEETS.sessions.name).hideSheet();
  // E-Mail-Recht einmalig anfordern
  MailApp.getRemainingDailyQuota();
  Logger.log('Verwaltungstabelle: ' + ss.getUrl());
  return ss.getUrl();
}

/* ======================= Web-Schnittstelle ======================= */
function doGet() {
  return json({ ok: true, app: CONFIG.APP_NAME, server: 'bereit', version: 1 });
}

function doPost(e) {
  let req = {};
  try {
    req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  } catch (err) {
    return json(fail('bad_request', 'Ungültige Anfrage.'));
  }
  try {
    const fn = ROUTES[req.action];
    if (!fn) return json(fail('unknown_action', 'Unbekannte Aktion.'));
    return json(fn(req));
  } catch (err) {
    if (err && err.appError) return json(err.appError);
    console.error(err && err.stack || err);
    return json(fail('server_error', 'Serverfehler: ' + (err && err.message || err)));
  }
}

const ROUTES = {
  ping: function () { return { ok: true, app: CONFIG.APP_NAME }; },
  register: register,
  login: login,
  logout: function (r) { const u = auth(r); deleteSession(r.token); log(u.email, 'Abmeldung', ''); return { ok: true }; },
  me: function (r) { const u = auth(r); return { ok: true, user: publicUser(u) }; },
  changePassword: changePassword,
  listObjects: listObjects,
  getObject: getObject,
  saveObject: saveObject,
  uploadPhoto: uploadPhoto,
  uploadDoc: uploadDoc,
  deleteObject: deleteObject,
  getPhoto: getPhoto,
  // Admin
  listUsers: function (r) { requireAdmin(r); return { ok: true, users: table(SHEETS.users).rows.map(publicUser) }; },
  setUser: setUser,
  resetPassword: resetPassword,
  setAccess: setAccess,
  createInvite: createInvite,
  acceptInvite: acceptInvite,
  submitKunde: submitKunde,
  reopenKunde: reopenKunde
};

/* ======================= Benutzer ======================= */
function register(r) {
  const email = normEmail(r.email), name = String(r.name || '').trim().slice(0, 80), pw = String(r.password || '');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('invalid', 'Bitte eine gültige E-Mail-Adresse eingeben.');
  if (!name) return fail('invalid', 'Bitte Ihren Namen angeben.');
  if (pw.length < 8) return fail('invalid', 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  return withLock(function () {
    const t = table(SHEETS.users);
    if (t.rows.some(function (u) { return u.email === email; })) return fail('exists', 'Für diese E-Mail-Adresse gibt es bereits einen Zugang.');
    const salt = Utilities.getUuid();
    const isFirstAdmin = email === normEmail(CONFIG.ADMIN_EMAIL) && !t.rows.some(function (u) { return u.role === ROLE.ADMIN; });
    const now = new Date();
    sheet(SHEETS.users).appendRow([email, name, isFirstAdmin ? STATUS.OK : STATUS.REQ, isFirstAdmin ? ROLE.ADMIN : ROLE.USER, now, isFirstAdmin ? now : '', '', hashPw(pw, salt), salt]);
    log(email, 'Registrierung', isFirstAdmin ? 'als Admin freigegeben' : 'Freigabe beantragt');
    if (!isFirstAdmin) {
      try {
        MailApp.sendEmail(CONFIG.ADMIN_EMAIL, CONFIG.APP_NAME + ': Neue Zugangsanfrage von ' + name,
          name + ' (' + email + ') möchte die Objektaufnahme-App nutzen.\n\nZum Freischalten in der App unter „Verwaltung“ auf „Freigeben“ tippen ' +
          'oder in der Verwaltungstabelle den Status auf „freigegeben“ setzen:\n' + sheetUrl());
      } catch (e) { console.warn('Mail an Admin fehlgeschlagen: ' + e); }
    }
    return { ok: true, approved: isFirstAdmin, message: isFirstAdmin ? 'Admin-Zugang eingerichtet. Sie können sich jetzt anmelden.' : 'Anfrage gesendet. Sie können sich anmelden, sobald der Admin Ihren Zugang freigegeben hat.' };
  });
}

function login(r) {
  const email = normEmail(r.email), pw = String(r.password || '');
  const cache = CacheService.getScriptCache(), key = 'fail_' + email;
  const fails = Number(cache.get(key) || 0);
  if (fails >= CONFIG.MAX_LOGIN_FAILS) return fail('locked', 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.');
  const u = findUser(email);
  if (!u || hashPw(pw, u.salt) !== u.hash) {
    cache.put(key, String(fails + 1), 900);
    return fail('wrong_login', 'E-Mail-Adresse oder Passwort ist falsch.');
  }
  cache.remove(key);
  if (u.status === STATUS.REQ) return fail('pending', 'Ihr Zugang ist noch nicht freigegeben. Der Admin wurde informiert.');
  if (u.status !== STATUS.OK) return fail('blocked', 'Ihr Zugang ist gesperrt. Bitte wenden Sie sich an das Büro.');
  const token = Utilities.getUuid() + Utilities.getUuid();
  const until = new Date(Date.now() + CONFIG.SESSION_DAYS * 864e5);
  withLock(function () {
    sheet(SHEETS.sessions).appendRow([sha(token), email, until]);
    sheet(SHEETS.users).getRange(u._row, 7).setValue(new Date());
  });
  log(email, 'Anmeldung', '');
  return { ok: true, token: token, user: publicUser(u) };
}

function changePassword(r) {
  const u = auth(r);
  if (hashPw(String(r.oldPassword || ''), u.salt) !== u.hash) return fail('wrong_login', 'Das bisherige Passwort ist falsch.');
  if (String(r.newPassword || '').length < 8) return fail('invalid', 'Das neue Passwort muss mindestens 8 Zeichen lang sein.');
  const salt = Utilities.getUuid();
  withLock(function () { sheet(SHEETS.users).getRange(u._row, 8, 1, 2).setValues([[hashPw(r.newPassword, salt), salt]]); });
  log(u.email, 'Passwort geändert', '');
  return { ok: true };
}

function setUser(r) {
  const admin = requireAdmin(r);
  const email = normEmail(r.email);
  const u = findUser(email);
  if (!u) return fail('not_found', 'Benutzer nicht gefunden.');
  if (email === admin.email && (r.status === STATUS.BLOCKED || r.role === ROLE.USER)) return fail('invalid', 'Sie können sich nicht selbst sperren oder die Admin-Rolle entziehen.');
  withLock(function () {
    const sh = sheet(SHEETS.users);
    if (r.status && [STATUS.REQ, STATUS.OK, STATUS.BLOCKED].indexOf(r.status) >= 0) {
      sh.getRange(u._row, 3).setValue(r.status);
      if (r.status === STATUS.OK && !u.approvedAt) sh.getRange(u._row, 6).setValue(new Date());
    }
    if (r.role && [ROLE.USER, ROLE.ADMIN].indexOf(r.role) >= 0 && u.role !== ROLE.KUNDE) sh.getRange(u._row, 4).setValue(r.role);
  });
  if (r.status === STATUS.BLOCKED) deleteSessionsOf(email);
  if (r.status === STATUS.OK && u.status !== STATUS.OK) {
    try { MailApp.sendEmail(email, CONFIG.APP_NAME + ': Zugang freigegeben', 'Hallo ' + u.name + ',\n\nIhr Zugang zur Objektaufnahme-App wurde freigegeben. Sie können sich jetzt mit Ihrer E-Mail-Adresse und Ihrem Passwort anmelden.\n\nImmobilien Pospiech GbR'); } catch (e) { console.warn(e); }
  }
  log(admin.email, 'Benutzer geändert', email + ' ' + (r.status || '') + ' ' + (r.role || ''));
  return { ok: true };
}

function resetPassword(r) {
  const admin = requireAdmin(r);
  const u = findUser(normEmail(r.email));
  if (!u) return fail('not_found', 'Benutzer nicht gefunden.');
  const temp = Utilities.getUuid().replace(/-/g, '').slice(0, 10);
  const salt = Utilities.getUuid();
  withLock(function () { sheet(SHEETS.users).getRange(u._row, 8, 1, 2).setValues([[hashPw(temp, salt), salt]]); });
  deleteSessionsOf(u.email);
  log(admin.email, 'Passwort zurückgesetzt', u.email);
  return { ok: true, tempPassword: temp };
}

/* ======================= Objekte ======================= */
function canAccess(u, o) {
  if (u.role === ROLE.ADMIN) return true;
  if (u.role === ROLE.KUNDE) return normEmail(o.kunde) === u.email;
  if (o.creator === u.email) return true;
  return splitEmails(o.access).indexOf(u.email) >= 0;
}

function listObjects(r) {
  const u = auth(r);
  let list = table(SHEETS.objects).rows.filter(function (o) { return canAccess(u, o); }).map(publicObject);
  if (u.role === ROLE.KUNDE) list = list.map(function (o) { return { id: o.id, title: o.title, version: o.version, updated: o.updated, kunde: o.kunde, kstatus: o.kstatus || KSTATUS.OPEN, creator: 'Immobilien Pospiech', access: [] }; });
  return { ok: true, objects: list };
}

function readStored(folder) {
  const f = folder.getFilesByName('aufnahme.json');
  return f.hasNext() ? JSON.parse(f.next().getBlob().getDataAsString('UTF-8')) : null;
}

function getObject(r) {
  const u = auth(r);
  const o = findObject(r.id);
  if (!o || !canAccess(u, o)) return fail('not_found', 'Objekt nicht gefunden oder kein Zugriff.');
  const folder = DriveApp.getFolderById(o.folderId);
  const stored = readStored(folder) || { id: o.id, title: o.title, data: {}, photos: [], files: [] };
  const kunde = normEmail(o.kunde), locked = o.kstatus === KSTATUS.DONE;
  if (u.role === ROLE.KUNDE) {
    // Eigentümer sehen nur ihre eigenen Angaben, Fotos und Unterlagen
    const mine = function (x) { return normEmail(x.by) === u.email; };
    return { ok: true, object: { id: stored.id, title: stored.title || o.title, data: stored.kd || {}, photos: (stored.photos || []).filter(mine), files: (stored.files || []).filter(mine),
      created: stored.created, updated: stored.updated, version: Number(o.version), svVersion: Number(o.version), locked: locked, kunde: kunde, kstatus: o.kstatus || KSTATUS.OPEN } };
  }
  return { ok: true, object: Object.assign(stored, { kd: stored.kd || {}, version: Number(o.version), svVersion: Number(stored.svVersion || stored.version || o.version), folderUrl: folder.getUrl(),
    creator: o.creator, access: splitEmails(o.access), kunde: kunde, kstatus: o.kstatus || '', locked: locked }) };
}

function saveObject(r) {
  const u = auth(r);
  const obj = r.object || {};
  if (!obj.id || !/^[a-z0-9]{6,40}$/i.test(obj.id)) return fail('invalid', 'Ungültige Objekt-ID.');
  return withLock(function () {
    let o = findObject(obj.id);
    const now = new Date();
    let folder;
    const isKunde = u.role === ROLE.KUNDE;
    if (isKunde && !o) return fail('forbidden', 'Kein Zugriff auf dieses Objekt.');
    let stored = null;
    if (o) {
      if (!canAccess(u, o)) return fail('forbidden', 'Kein Zugriff auf dieses Objekt.');
      folder = DriveApp.getFolderById(o.folderId);
      stored = readStored(folder);
      if (isKunde) {
        if (o.kstatus === KSTATUS.DONE) return fail('locked', 'Ihre Angaben wurden bereits übergeben. Für Änderungen wenden Sie sich bitte an Immobilien Pospiech.');
      } else {
        // Konflikte nur bei Änderungen durch Mitarbeiter prüfen – Angaben des Eigentümers werden getrennt geführt
        const svNow = Number((stored && (stored.svVersion || stored.version)) || o.version || 0);
        const base = Number(r.baseSv != null ? r.baseSv : (r.baseVersion || 0));
        if (!r.force && base !== svNow && base !== Number(o.version || 0)) {
          return { ok: false, error: 'conflict', message: 'Das Objekt wurde inzwischen von ' + o.updatedBy + ' geändert.', version: Number(o.version), updatedBy: o.updatedBy, updated: o.updated };
        }
      }
    } else {
      const name = safeName(Utilities.formatDate(now, 'Europe/Berlin', 'yyyy-MM-dd') + ' ' + (obj.title || 'Objekt'));
      folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID).createFolder(name);
      folder.createFolder('Fotos');
      sheet(SHEETS.objects).appendRow([obj.id, obj.title || '', folder.getUrl(), u.email, '', now, now, u.email, 0, folder.getId()]);
      o = findObject(obj.id);
    }
    const version = Number(o.version || 0) + 1;
    stored = stored || {};
    const kundeMail = normEmail(o.kunde);
    const byKunde = function (x) { return kundeMail && normEmail(x.by) === kundeMail; };
    const ids = function (list) { return (list || []).map(function (x) { return x.id; }); };
    let rec;
    if (isKunde) {
      rec = Object.assign({}, stored, {
        kd: obj.data || {},
        photos: (stored.photos || []).filter(function (x) { return !byKunde(x); }).concat((obj.photos || []).filter(byKunde)),
        files: (stored.files || []).filter(function (x) { return !byKunde(x); }).concat((obj.files || []).filter(byKunde)),
        kUpdated: now.toISOString(), version: version });
    } else {
      const ph = obj.photos || [], fi = obj.files || [];
      rec = { id: obj.id, title: obj.title || '', data: obj.data || {}, kd: stored.kd || {},
        photos: ph.concat((stored.photos || []).filter(function (x) { return byKunde(x) && ids(ph).indexOf(x.id) < 0; })),
        files: fi.concat((stored.files || []).filter(function (x) { return byKunde(x) && ids(fi).indexOf(x.id) < 0; })),
        created: obj.created || stored.created || now.toISOString(), kUpdated: stored.kUpdated || '',
        svVersion: Number(stored.svVersion || stored.version || 0) + 1, version: version };
    }
    rec.updated = now.toISOString(); rec.updatedBy = u.email;
    const content = JSON.stringify(rec);
    const it = folder.getFilesByName('aufnahme.json');
    if (it.hasNext()) it.next().setContent(content);
    else folder.createFile('aufnahme.json', content, 'application/json');
    if (!isKunde) sheet(SHEETS.objects).getRange(o._row, 2, 1, 1).setValue(obj.title || '');
    sheet(SHEETS.objects).getRange(o._row, 7, 1, 3).setValues([[now, u.email, version]]);
    try { writeProtocol(folder, obj, r.protocol || [], u, now, isKunde ? 'Angaben des Eigentümers' : 'Aufnahmeprotokoll', isKunde ? (obj.data || {}) : null); } catch (e) { console.warn('Protokoll: ' + e); }
    log(u.email, isKunde ? 'Eigentümer-Angaben gespeichert' : 'Objekt gespeichert', obj.id + ' ' + (o.title || obj.title || '') + ' v' + version);
    return { ok: true, version: version, svVersion: rec.svVersion || null, folderUrl: isKunde ? '' : folder.getUrl() };
  });
}

function writeProtocol(folder, obj, protocol, u, now, docName, kd) {
  docName = docName || 'Aufnahmeprotokoll';
  let doc;
  const it = folder.getFilesByName(docName);
  if (it.hasNext()) doc = DocumentApp.openById(it.next().getId());
  else {
    doc = DocumentApp.create(docName);
    DriveApp.getFileById(doc.getId()).moveTo(folder);
  }
  const body = doc.getBody();
  body.clear();
  body.appendParagraph(docName).setHeading(DocumentApp.ParagraphHeading.TITLE);
  body.appendParagraph(obj.title || '').setHeading(DocumentApp.ParagraphHeading.SUBTITLE);
  body.appendParagraph('Stand: ' + Utilities.formatDate(now, 'Europe/Berlin', 'dd.MM.yyyy HH:mm') + ' Uhr · zuletzt bearbeitet von ' + u.name);
  (protocol || []).forEach(function (sec) {
    if (!sec || !sec.rows || !sec.rows.length) return;
    body.appendParagraph(String(sec.title || '')).setHeading(DocumentApp.ParagraphHeading.HEADING2);
    const cells = sec.rows.map(function (row) { return [String(row[0] || ''), String(row[1] || '')]; });
    const t = body.appendTable(cells);
    t.setBorderColor('#C9D3DC');
    for (let i = 0; i < t.getNumRows(); i++) {
      t.getRow(i).getCell(0).setWidth(170).editAsText().setBold(true);
    }
  });
  const sg = kd && kd.k_sign;
  if (sg && sg.img && /^data:image\/(png|jpeg);base64,/.test(sg.img)) {
    try {
      body.appendParagraph('Bestätigung und Unterschrift').setHeading(DocumentApp.ParagraphHeading.HEADING2);
      body.appendParagraph('Ich bestätige, dass meine Angaben der Wahrheit entsprechen und nach bestem Wissen und Gewissen gemacht wurden.');
      const m = sg.img.match(/^data:(image\/(?:png|jpeg));base64,(.*)$/);
      const img = body.appendImage(Utilities.newBlob(Utilities.base64Decode(m[2]), m[1], 'unterschrift'));
      const w = img.getWidth(), h = img.getHeight(); if (w > 300) { img.setWidth(300); img.setHeight(Math.round(h * 300 / w)); }
      const when = sg.at ? Utilities.formatDate(new Date(sg.at), 'Europe/Berlin', 'dd.MM.yyyy HH:mm') + ' Uhr' : '';
      body.appendParagraph([kd.k_sign_ort, when].filter(String).join(', ') + (sg.name ? ' · ' + sg.name : ''));
    } catch (e) { console.warn('Unterschrift: ' + e); }
  }
  doc.saveAndClose();
}

function kundeLocked(u, o) { return u.role === ROLE.KUNDE && o.kstatus === KSTATUS.DONE; }

function uploadPhoto(r) {
  const u = auth(r);
  const o = findObject(r.objectId);
  if (!o || !canAccess(u, o)) return fail('not_found', 'Objekt nicht gefunden oder kein Zugriff. Bitte zuerst die Aufnahme speichern.');
  if (kundeLocked(u, o)) return fail('locked', 'Ihre Angaben wurden bereits übergeben.');
  const name = safeName(String(r.name || 'foto.jpg'));
  if (!/\.jpe?g$/i.test(name)) return fail('invalid', 'Nur JPEG-Fotos sind erlaubt.');
  const folder = fotosFolder(o.folderId);
  const existing = folder.getFilesByName(name);
  if (existing.hasNext()) return { ok: true, fileId: existing.next().getId(), existed: true };
  const bytes = Utilities.base64Decode(String(r.b64 || ''));
  if (bytes.length < 100) return fail('invalid', 'Foto ist leer.');
  if (bytes.length > 15 * 1024 * 1024) return fail('invalid', 'Foto ist zu groß.');
  const file = folder.createFile(Utilities.newBlob(bytes, 'image/jpeg', name));
  const desc = [r.category, r.caption].filter(String).join(' – ');
  if (desc) file.setDescription(desc.slice(0, 500));
  return { ok: true, fileId: file.getId() };
}

function getPhoto(r) {
  const u = auth(r);
  const o = findObject(r.objectId);
  if (!o || !canAccess(u, o)) return fail('not_found', 'Kein Zugriff.');
  const file = DriveApp.getFileById(String(r.fileId || ''));
  const folder = fotosFolder(o.folderId);
  const parents = file.getParents();
  let inside = false;
  while (parents.hasNext()) if (parents.next().getId() === folder.getId()) inside = true;
  if (!inside) return fail('forbidden', 'Foto gehört nicht zu diesem Objekt.');
  const blob = r.full ? file.getBlob() : (file.getThumbnail() || file.getBlob());
  return { ok: true, mime: blob.getContentType(), b64: Utilities.base64Encode(blob.getBytes()) };
}

/** Unterlagen (PDF oder Bild) im Unterordner „Unterlagen“ ablegen */
function uploadDoc(r) {
  const u = auth(r);
  const o = findObject(r.objectId);
  if (!o || !canAccess(u, o)) return fail('not_found', 'Objekt nicht gefunden oder kein Zugriff. Bitte zuerst die Aufnahme speichern.');
  if (kundeLocked(u, o)) return fail('locked', 'Ihre Angaben wurden bereits übergeben.');
  const name = safeName(String(r.name || 'Unterlage.pdf'));
  const mime = String(r.mime || '');
  if (['application/pdf', 'image/jpeg', 'image/png'].indexOf(mime) < 0) return fail('invalid', 'Nur PDF, JPG oder PNG sind erlaubt.');
  const folder = subFolder(o.folderId, 'Unterlagen');
  const existing = folder.getFilesByName(name);
  if (existing.hasNext()) return { ok: true, fileId: existing.next().getId(), existed: true };
  const bytes = Utilities.base64Decode(String(r.b64 || ''));
  if (bytes.length < 100) return fail('invalid', 'Datei ist leer.');
  if (bytes.length > 25 * 1024 * 1024) return fail('invalid', 'Datei ist zu groß (max. 25 MB).');
  const file = folder.createFile(Utilities.newBlob(bytes, mime, name));
  if (r.docType) file.setDescription(String(r.docType).slice(0, 300));
  log(u.email, 'Unterlage hochgeladen', o.id + ': ' + name);
  return { ok: true, fileId: file.getId() };
}

/** Objekt löschen (nur Admin): Drive-Ordner in den Papierkorb (30 Tage wiederherstellbar), Eintrag entfernen */
function deleteObject(r) {
  const admin = requireAdmin(r);
  return withLock(function () {
    const o = findObject(r.objectId);
    if (!o) return fail('not_found', 'Objekt nicht gefunden.');
    try { DriveApp.getFolderById(o.folderId).setTrashed(true); } catch (e) { console.warn('Ordner: ' + e); }
    sheet(SHEETS.objects).deleteRow(o._row);
    log(admin.email, 'Objekt gelöscht', o.id + ' ' + o.title + ' (Ordner im Papierkorb)');
    return { ok: true };
  });
}

/* ======================= Eigentümer (Kunden) ======================= */
function ensureCols() {
  const sh = sheet(SHEETS.objects);
  if (sh.getRange(1, 11).getValue() !== SHEETS.objects.head[10]) sh.getRange(1, 1, 1, SHEETS.objects.head.length).setValues([SHEETS.objects.head]);
  try { sheet(SHEETS.users).getRange('D2:D1000').setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList([ROLE.USER, ROLE.ADMIN, ROLE.KUNDE], true).build()); } catch (e) {}
  const book = ss();
  if (!book.getSheetByName(SHEETS.invites.name)) {
    const si = book.insertSheet(SHEETS.invites.name);
    si.getRange(1, 1, 1, SHEETS.invites.head.length).setValues([SHEETS.invites.head]).setFontWeight('bold');
    si.hideSheet();
  }
}

/** Admin lädt einen Eigentümer zu einem Objekt ein (legt das Objekt bei Bedarf an) */
function createInvite(r) {
  const admin = requireAdmin(r);
  const email = normEmail(r.email), name = String(r.name || '').trim().slice(0, 80);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail('invalid', 'Bitte eine gültige E-Mail-Adresse des Eigentümers eingeben.');
  if (!name) return fail('invalid', 'Bitte den Namen des Eigentümers angeben.');
  ensureCols();
  const existingUser = findUser(email);
  if (existingUser && existingUser.role !== ROLE.KUNDE) return fail('invalid', 'Diese Adresse gehört zu einem Mitarbeiter-Zugang.');
  return withLock(function () {
    let o = r.objectId ? findObject(r.objectId) : null;
    const now = new Date();
    if (!o) {
      const title = String(r.title || '').trim();
      if (!title) return fail('invalid', 'Bitte die Adresse des Objekts angeben.');
      const id = (Date.now().toString(36) + Utilities.getUuid().replace(/-/g, '').slice(0, 9)).toLowerCase();
      const folder = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID).createFolder(safeName(Utilities.formatDate(now, 'Europe/Berlin', 'yyyy-MM-dd') + ' ' + title));
      folder.createFolder('Fotos');
      const rec = { id: id, title: title, data: { ob_str: title, ot_datum: '' }, kd: {}, photos: [], files: [], created: now.toISOString(), updated: now.toISOString(), updatedBy: admin.email, version: 1, svVersion: 1 };
      folder.createFile('aufnahme.json', JSON.stringify(rec), 'application/json');
      sheet(SHEETS.objects).appendRow([id, title, folder.getUrl(), admin.email, '', now, now, admin.email, 1, folder.getId(), email, KSTATUS.OPEN]);
      o = findObject(id);
    } else {
      sheet(SHEETS.objects).getRange(o._row, 11, 1, 2).setValues([[email, KSTATUS.OPEN]]);
    }
    let link = CONFIG.APP_URL, token = '';
    if (!existingUser) {
      token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
      sheet(SHEETS.invites).appendRow([sha(token), email, name, o.id, now, new Date(Date.now() + CONFIG.INVITE_DAYS * 864e5), '']);
      link = CONFIG.APP_URL + '?einladung=' + token;
    }
    const text = 'Guten Tag ' + name + ',\n\n' +
      'für Ihre Immobilie (' + (o.title || r.title || '') + ') können Sie die wichtigsten Angaben, Fotos und Unterlagen bequem online an uns übermitteln – am Handy, Tablet oder PC.\n\n' +
      (existingUser ? 'Melden Sie sich wie gewohnt mit Ihrer E-Mail-Adresse und Ihrem Passwort an:\n' : 'Öffnen Sie dazu diesen persönlichen Link und vergeben Sie ein Passwort (der Link ist ' + CONFIG.INVITE_DAYS + ' Tage gültig):\n') +
      link + '\n\nBei Fragen erreichen Sie uns im Büro Neuruppin unter 03391 65 92 35 und im Büro Rheinsberg unter 033931 34 92 65.\n\nMit freundlichen Grüßen\nImmobilien Pospiech GbR';
    let mailed = false;
    if (r.sendMail !== false) { try { MailApp.sendEmail(email, 'Ihre Objektaufnahme – Immobilien Pospiech', text, { name: 'Immobilien Pospiech' }); mailed = true; } catch (e) { console.warn(e); } }
    log(admin.email, 'Eigentümer eingeladen', o.id + ': ' + email);
    return { ok: true, link: link, mailed: mailed, existing: !!existingUser, objectId: o.id };
  });
}

/** Eigentümer löst die Einladung ein und vergibt ein Passwort */
function acceptInvite(r) {
  const pw = String(r.password || '');
  if (pw.length < 8) return fail('invalid', 'Das Passwort muss mindestens 8 Zeichen lang sein.');
  ensureCols();
  const h = sha(String(r.invite || ''));
  const inv = table(SHEETS.invites).rows.filter(function (x) { return x.tokenHash === h; })[0];
  if (!inv) return fail('invalid', 'Dieser Einladungslink ist ungültig. Bitte wenden Sie sich an Immobilien Pospiech.');
  if (inv.used) return fail('used', 'Dieser Link wurde bereits verwendet. Bitte melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.');
  if (new Date(inv.until) < new Date()) return fail('expired', 'Dieser Einladungslink ist abgelaufen. Bitte fordern Sie bei Immobilien Pospiech einen neuen an.');
  const email = normEmail(inv.email);
  withLock(function () {
    const salt = Utilities.getUuid(), now = new Date();
    const u = findUser(email);
    const name = String(r.name || inv.name || '').trim().slice(0, 80) || inv.name;
    if (u) sheet(SHEETS.users).getRange(u._row, 2, 1, 8).setValues([[name, STATUS.OK, ROLE.KUNDE, u.requestedAt || now, now, '', hashPw(pw, salt), salt]]);
    else sheet(SHEETS.users).appendRow([email, name, STATUS.OK, ROLE.KUNDE, now, now, '', hashPw(pw, salt), salt]);
    sheet(SHEETS.invites).getRange(inv._row, 7).setValue(now);
  });
  log(email, 'Einladung eingelöst', inv.objectId);
  return login({ email: email, password: pw });
}

/** Eigentümer übergibt seine Angaben – danach nur noch lesen */
function submitKunde(r) {
  const u = auth(r);
  const o = findObject(r.objectId);
  if (!o || u.role !== ROLE.KUNDE || !canAccess(u, o)) return fail('forbidden', 'Kein Zugriff.');
  withLock(function () { sheet(SHEETS.objects).getRange(o._row, 12).setValue(KSTATUS.DONE); });
  try { MailApp.sendEmail(CONFIG.ADMIN_EMAIL, CONFIG.APP_NAME + ': ' + u.name + ' hat die Angaben übergeben', u.name + ' (' + u.email + ') hat die Angaben, Fotos und Unterlagen zu „' + o.title + '“ übergeben.\n\nDrive-Ordner: ' + o.folderUrl); } catch (e) { console.warn(e); }
  log(u.email, 'Angaben übergeben', o.id);
  return { ok: true };
}

/** Admin gibt die Angaben des Eigentümers wieder zur Bearbeitung frei */
function reopenKunde(r) {
  const admin = requireAdmin(r);
  const o = findObject(r.objectId);
  if (!o) return fail('not_found', 'Objekt nicht gefunden.');
  withLock(function () { sheet(SHEETS.objects).getRange(o._row, 12).setValue(KSTATUS.OPEN); });
  log(admin.email, 'Eigentümer-Angaben freigegeben', o.id);
  return { ok: true };
}

function setAccess(r) {
  const admin = requireAdmin(r);
  const o = findObject(r.objectId);
  if (!o) return fail('not_found', 'Objekt nicht gefunden.');
  const emails = (r.emails || []).map(normEmail).filter(Boolean);
  withLock(function () { sheet(SHEETS.objects).getRange(o._row, 5).setValue(emails.join(', ')); });
  log(admin.email, 'Zugriff geändert', o.id + ': ' + emails.join(', '));
  return { ok: true };
}

/* ======================= Hilfsfunktionen ======================= */
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function fail(code, message) { return { ok: false, error: code, message: message }; }
function appError(code, message) { const e = new Error(message); e.appError = fail(code, message); return e; }
function normEmail(s) { return String(s || '').trim().toLowerCase(); }
function splitEmails(s) { return String(s || '').split(/[,;\s]+/).map(normEmail).filter(Boolean); }
function safeName(s) { return String(s || '').replace(/[\\\/:*?"<>|#\n\r]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100); }
function sha(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, s, Utilities.Charset.UTF_8).map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join(''); }
function hashPw(pw, salt) { let h = salt + '|' + pw; for (let i = 0; i < CONFIG.HASH_ROUNDS; i++) h = sha(salt + h); return h; }
function ss() {
  const id = PropertiesService.getScriptProperties().getProperty('SHEET_ID');
  if (!id) throw appError('not_setup', 'Der Server ist noch nicht eingerichtet. Bitte im Apps-Script-Editor einmal „setup“ ausführen.');
  return SpreadsheetApp.openById(id);
}
function sheetUrl() { try { return ss().getUrl(); } catch (e) { return ''; } }
function sheet(def) { return ss().getSheetByName(def.name); }
function withLock(fn) { const l = LockService.getScriptLock(); l.waitLock(20000); try { return fn(); } finally { l.releaseLock(); } }
function log(email, action, details) { try { sheet(SHEETS.log).appendRow([new Date(), email, action, details]); } catch (e) { console.warn(e); } }

const FIELDS = {
  'Benutzer': ['email', 'name', 'status', 'role', 'requestedAt', 'approvedAt', 'lastLogin', 'hash', 'salt'],
  'Objekte': ['id', 'title', 'folderUrl', 'creator', 'access', 'created', 'updated', 'updatedBy', 'version', 'folderId', 'kunde', 'kstatus'],
  'Einladungen': ['tokenHash', 'email', 'name', 'objectId', 'created', 'until', 'used'],
  'Sitzungen': ['tokenHash', 'email', 'until']
};
function table(def) {
  const sh = sheet(def);
  const n = sh.getLastRow();
  if (n < 2) return { rows: [] };
  const vals = sh.getRange(2, 1, n - 1, def.head.length).getValues();
  const keys = FIELDS[def.name];
  return { rows: vals.map(function (v, i) { const o = { _row: i + 2 }; keys.forEach(function (k, j) { o[k] = v[j]; }); if (o.email !== undefined) o.email = normEmail(o.email); if (o.creator !== undefined) o.creator = normEmail(o.creator); return o; }).filter(function (o) { return o[keys[0]] !== ''; }) };
}
function findUser(email) { return table(SHEETS.users).rows.filter(function (u) { return u.email === email; })[0] || null; }
function findObject(id) { return table(SHEETS.objects).rows.filter(function (o) { return String(o.id) === String(id); })[0] || null; }
function subFolder(folderId, name) {
  const parent = DriveApp.getFolderById(folderId);
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}
function fotosFolder(folderId) {
  const parent = DriveApp.getFolderById(folderId);
  const it = parent.getFoldersByName('Fotos');
  return it.hasNext() ? it.next() : parent.createFolder('Fotos');
}
function publicUser(u) {
  const d = function (x) { return x instanceof Date ? x.toISOString() : (x || ''); };
  return { email: u.email, name: u.name, status: u.status, role: u.role, requestedAt: d(u.requestedAt), lastLogin: d(u.lastLogin) };
}
function publicObject(o) {
  return { id: String(o.id), title: o.title, creator: o.creator, access: splitEmails(o.access), updated: o.updated instanceof Date ? o.updated.toISOString() : '', updatedBy: o.updatedBy, version: Number(o.version || 0), folderUrl: o.folderUrl, kunde: normEmail(o.kunde), kstatus: o.kstatus || '' };
}
function auth(r) {
  const token = String(r.token || '');
  if (!token) throw appError('auth', 'Bitte erneut anmelden.');
  const h = sha(token);
  const s = table(SHEETS.sessions).rows.filter(function (x) { return x.tokenHash === h; })[0];
  if (!s || new Date(s.until) < new Date()) throw appError('auth', 'Ihre Anmeldung ist abgelaufen. Bitte erneut anmelden.');
  const u = findUser(s.email);
  if (!u || u.status !== STATUS.OK) throw appError('auth', 'Ihr Zugang ist nicht (mehr) freigegeben.');
  return u;
}
function requireAdmin(r) { const u = auth(r); if (u.role !== ROLE.ADMIN) throw appError('forbidden', 'Nur für Admins.'); return u; }
function deleteSession(token) {
  const h = sha(String(token || ''));
  withLock(function () { const sh = sheet(SHEETS.sessions); table(SHEETS.sessions).rows.filter(function (x) { return x.tokenHash === h; }).reverse().forEach(function (x) { sh.deleteRow(x._row); }); });
}
function deleteSessionsOf(email) {
  withLock(function () { const sh = sheet(SHEETS.sessions); table(SHEETS.sessions).rows.filter(function (x) { return normEmail(x.email) === email; }).reverse().forEach(function (x) { sh.deleteRow(x._row); }); });
}

/** Optional: abgelaufene Sitzungen aufräumen (als täglichen Trigger einrichten). */
function cleanupSessions() {
  withLock(function () { const sh = sheet(SHEETS.sessions); table(SHEETS.sessions).rows.filter(function (x) { return new Date(x.until) < new Date(); }).reverse().forEach(function (x) { sh.deleteRow(x._row); }); });
}
