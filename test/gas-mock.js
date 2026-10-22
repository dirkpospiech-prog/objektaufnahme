// Minimaler Nachbau der Google-Apps-Script-Dienste, um Code.gs lokal zu testen.
const crypto = require("crypto");
const vm = require("vm");
const fs = require("fs");
const http = require("http");

let idc = 0; const nid = p => p + (++idc).toString(36).padStart(6, "0") + crypto.randomBytes(4).toString("hex");
const props = {};
const sheetsById = {}, files = {}, folders = {}, docs = {};
const mails = [];
class Range {
  constructor(sh, r, c, nr, nc) { Object.assign(this, { sh, r, c, nr: nr || 1, nc: nc || 1 }); }
  setValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sh.set(this.r + i, this.c + j, x))); return this; }
  setValue(x) { this.sh.set(this.r, this.c, x); return this; }
  getValue() { return this.sh.get(this.r, this.c); }
  getValues() { const o = []; for (let i = 0; i < this.nr; i++) { const row = []; for (let j = 0; j < this.nc; j++) row.push(this.sh.get(this.r + i, this.c + j)); o.push(row); } return o; }
  setFontWeight() { return this; } setBackground() { return this; } setFontColor() { return this; } setDataValidation() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.rows = []; }
  set(r, c, x) { while (this.rows.length < r) this.rows.push([]); this.rows[r - 1][c - 1] = x; }
  get(r, c) { const row = this.rows[r - 1] || []; const v = row[c - 1]; return v === undefined ? "" : v; }
  getRange(a, b, c, d) { if (typeof a === "string") return new Range(this, 2, 1, 1, 1); return new Range(this, a, b, c, d); }
  appendRow(v) { this.rows.push(v.slice()); }
  getLastRow() { return this.rows.length; }
  deleteRow(r) { this.rows.splice(r - 1, 1); }
  setFrozenRows() {} hideColumns() {} setColumnWidths() {} setColumnWidth() {} hideSheet() {}
  getName() { return this.name; }
}
class Spreadsheet {
  constructor(name) { this.id = nid("ss"); this.name = name; this.sheets = [new Sheet("Tabelle1")]; sheetsById[this.id] = this; files[this.id] = { id: this.id, name, parents: [], moveTo() { return this; } }; }
  getId() { return this.id; } getUrl() { return "https://sheet/" + this.id; }
  getSheetByName(n) { return this.sheets.find(s => s.name === n) || null; }
  insertSheet(n) { const s = new Sheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets; } deleteSheet(s) { this.sheets = this.sheets.filter(x => x !== s); }
}
const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
class Blob {
  constructor(bytes, type, name) { this.bytes = Buffer.from(bytes); this.type = type; this.name = name; }
  getDataAsString() { return this.bytes.toString("utf8"); } getBytes() { return [...this.bytes].map(b => b > 127 ? b - 256 : b); } getContentType() { return this.type; }
}
class File {
  constructor(name, blob, parent) { this.id = nid("f"); this.name = name; this.blob = blob; this.parents = [parent]; this.desc = ""; files[this.id] = this; }
  getId() { return this.id; } getName() { return this.name; } getBlob() { return this.blob; } getThumbnail() { return this.blob; }
  setContent(s) { this.blob = new Blob(Buffer.from(s, "utf8"), this.blob.type, this.name); return this; }
  setDescription(d) { this.desc = d; return this; } getParents() { return iter(this.parents.map(p => folders[p])); }
  moveTo(f) { this.parents = [f.id]; return this; }
}
class Folder {
  constructor(name, parent) { this.id = nid("d"); this.name = name; this.parent = parent; folders[this.id] = this; }
  getId() { return this.id; } getName() { return this.name; } getUrl() { return "https://drive/folders/" + this.id; } setTrashed(t) { this.trashed = t; return this; }
  createFolder(n) { return new Folder(n, this.id); }
  getFoldersByName(n) { return iter(Object.values(folders).filter(f => f.parent === this.id && f.name === n)); }
  getFilesByName(n) { return iter(Object.values(files).filter(f => f instanceof File && f.parents.includes(this.id) && f.name === n)); }
  createFile(a, content, mime) { if (a instanceof Blob) return new File(a.name, a, this.id); return new File(a, new Blob(Buffer.from(content, "utf8"), mime, a), this.id); }
}
const ROOT = new Folder("Objektaufnahmen (App)", null); ROOT.id = "1idz0oqS8e05Y91BPfiUxiX24zc_tVaG_"; folders[ROOT.id] = ROOT;
class Doc {
  constructor(name) { this.id = nid("doc"); this.name = name; this.parts = []; docs[this.id] = this; const f = new File(name, new Blob(Buffer.from(""), "doc", name), null); delete files[f.id]; f.id = this.id; files[this.id] = f; }
  getId() { return this.id; }
  getBody() { const d = this; const chain = { setHeading() { return chain; } };
    return { clear() { d.parts = []; }, appendParagraph(t) { d.parts.push(t); return chain; },
      appendImage(b) { d.parts.push("[BILD Unterschrift]"); let w = 600, h = 190; const img = { getWidth: () => w, getHeight: () => h, setWidth(x) { w = x; return img; }, setHeight(x) { h = x; return img; } }; return img; },
      appendTable(cells) { d.parts.push(...cells.map(c => c.join(": "))); const cell = { setWidth() { return cell; }, editAsText() { return { setBold() {} }; } };
        return { setBorderColor() {}, getNumRows: () => cells.length, getRow: () => ({ getCell: () => cell }) }; } }; }
  saveAndClose() {}
}
const G = {
  console, Logger: { log() {} },
  PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] || null, setProperty: (k, v) => { props[k] = v; } }) },
  SpreadsheetApp: { create: n => new Spreadsheet(n), openById: id => sheetsById[id],
    newDataValidation: () => { const c = { requireValueInList: () => c, build: () => ({}) }; return c; } },
  DriveApp: { getFolderById: id => { if (!folders[id]) throw new Error("Ordner fehlt " + id); return folders[id]; }, getFileById: id => { if (!files[id]) throw new Error("Datei fehlt"); return files[id]; } },
  DocumentApp: { create: n => new Doc(n), openById: id => docs[id], ParagraphHeading: { TITLE: 1, SUBTITLE: 2, HEADING2: 3 } },
  Utilities: {
    getUuid: () => crypto.randomUUID(),
    DigestAlgorithm: { SHA_256: "sha256" }, Charset: { UTF_8: "utf8" },
    computeDigest: (alg, s) => [...crypto.createHash("sha256").update(String(s), "utf8").digest()].map(b => b > 127 ? b - 256 : b),
    base64Decode: s => [...Buffer.from(s, "base64")].map(b => b > 127 ? b - 256 : b),
    base64Encode: bytes => Buffer.from(bytes.map(b => b & 255)).toString("base64"),
    newBlob: (bytes, type, name) => new Blob(bytes.map(b => b & 255), type, name),
    formatDate: (d, tz, f) => f.replace("yyyy", d.getFullYear()).replace("MM", String(d.getMonth() + 1).padStart(2, "0")).replace("dd", String(d.getDate()).padStart(2, "0")).replace("HH", "12").replace("mm", "00")
  },
  CacheService: { getScriptCache: () => ({ get: k => G._cache[k] || null, put: (k, v) => { G._cache[k] = v; }, remove: k => { delete G._cache[k]; } }) }, _cache: {},
  LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
  MailApp: { sendEmail: (to, subj) => mails.push({ to, subj }), getRemainingDailyQuota: () => 100 },
  ContentService: { createTextOutput: s => ({ s, setMimeType() { return this; } }), MimeType: { JSON: "json" } }
};
vm.createContext(G);
vm.runInContext(fs.readFileSync(__dirname + "/../repo/server/Code.gs", "utf8"), G);
G.setup();

const server = http.createServer((req, res) => {
  const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" };
  if (req.method === "GET" && req.url.startsWith("/__state")) { res.writeHead(200, cors); return res.end(JSON.stringify({ folders: Object.values(folders).map(f => ({ id: f.id, name: f.name, parent: f.parent, trashed: !!f.trashed })), files: Object.values(files).filter(f => f instanceof File).map(f => ({ name: f.name, parents: f.parents, size: f.blob.bytes.length, desc: f.desc, type: f.blob.type })), docs: Object.values(docs).map(d => d.parts), mails, sheets: Object.values(sheetsById)[0].sheets.map(s => ({ name: s.name, rows: s.rows.map(r => r.map(x => x instanceof Date ? "DATE" : x)) })) })); }
  if (req.method === "GET") { res.writeHead(200, cors); return res.end(G.doGet().s); }
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    const out = G.doPost({ postData: { contents: body } });
    res.writeHead(200, cors); res.end(out.s);
  });
});
server.listen(8701, () => console.log("mock api on 8701"));
