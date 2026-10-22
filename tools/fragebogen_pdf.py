"""Eigentümer-Fragebogen als ausfüllbare PDF im Stil des Aufnahmebogens Immobilie (Carlito, zentriertes Logo, Schreiblinien)."""
import json, re, sys
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import simpleSplit, ImageReader
from reportlab.lib.colors import HexColor, white, black, transparent

FD = "/usr/share/fonts/truetype/crosextra/"
for n, f in [("R", "Carlito-Regular"), ("B", "Carlito-Bold"), ("I", "Carlito-Italic"), ("BI", "Carlito-BoldItalic")]:
    pdfmetrics.registerFont(TTFont(n, FD + f + ".ttf"))
HEAD, ACCENT, LINEC, BOXC, HINT, FOOT, SEP, EX = map(HexColor, ["#1F3A4D", "#4DACFF", "#AAB0B6", "#595959", "#555555", "#777777", "#DDE2E6", "#333333"])
D = "/tmp/claude-0/pdf/"
SECS = json.load(open(D + "k.json"))
LOGO = ImageReader("/home/claude/objektaufnahme/app/logo.png")
W, H = A4; L = 54; R = 541; CW = R - L; IN = 68; BOT = 62

NOTE = {"k_bj_zeit": "nur falls das Baujahr unbekannt ist", "k_etage": "nur bei Eigentumswohnung", "k_we": "nicht bei Eigentumswohnung",
        "k_kellerart": "falls Keller vorhanden", "k_park_anz": "falls vorhanden", "k_extra_info": "für die angekreuzte Ausstattung",
        "k_schad_text": "falls Schadstoffe bekannt", "pv_bj": "falls Photovoltaik", "pv_kwp": "falls Photovoltaik",
        "pv_eigentum": "falls Photovoltaik", "k_pv_info": "falls Photovoltaik", "k_mieter": "falls vermietet", "k_miete": "falls vermietet",
        "k_miete_soll": "bei Vermietung", "k_hausgeld": "nur bei Eigentumswohnung", "k_ruecklage": "nur bei Eigentumswohnung",
        "k_eigentuemer": "falls nicht Alleineigentum", "k_rechte_text": "falls ja", "k_frei_datum": "falls bestimmtes Datum",
        "k_preis": "bei Verkauf", "k_mietwunsch": "bei Vermietung", "k_grund": "nicht bei Eigentumswohnung", "k_dg": "nicht bei Eigentumswohnung"}
SEC_NOTE = {"k2": "Bei unbebauten Grundstücken entfällt dieser Abschnitt.",
            "k8": "Bitte je Bereich die Beschreibung ankreuzen, die am ehesten zutrifft. Bei unbebauten Grundstücken genügen Aussicht und Lage."}
DOC_NOTE = {7: "nur Wohnungseigentum", 8: "nur Wohnungseigentum", 9: "nur Wohnungseigentum", 10: "falls vermietet", 19: "nur Mehrfamilien-/Geschäftshaus"}
SKIP_HINT = ("Bitte füllen Sie aus", "Wählen Sie je Bereich", "Datenschutz:")  # stehen im Kopf bzw. im Abschnittshinweis
INTRO = ("Bitte füllen Sie die Angaben möglichst vollständig und nach bestem Wissen und Gewissen aus. Felder, die Sie nicht kennen, lassen Sie "
         "einfach leer – wir klären das gemeinsam. Ihre Angaben verarbeiten wir ausschließlich zur Durchführung des Makler- bzw. Bewertungsauftrags "
         "(Art. 6 Abs. 1 lit. b DSGVO). Eine Weitergabe an Dritte, etwa an finanzierende Banken zur Objekteinwertung, erfolgt nur, soweit dies zur "
         "Auftragserfüllung erforderlich ist oder Sie eingewilligt haben. Einzelheiten sowie Ihre Betroffenenrechte entnehmen Sie unserer "
         "Datenschutzerklärung unter www.immobilien-neuruppin.de.")

class Doc:
    def __init__(self, path, total=None):
        self.c = canvas.Canvas(path, pagesize=A4); self.page = 0; self.total = total; self.fid = 0
        self.c.setTitle("Aufnahmebogen Immobilie – Angaben des Eigentümers"); self.c.setAuthor("Immobilien Pospiech GbR")
        self.new_page()
    def name(self, base):
        self.fid += 1; return re.sub(r"[^A-Za-z0-9_]", "_", base)[:40] + "_" + str(self.fid)
    def footer(self):
        c = self.c; c.setStrokeColor(SEP); c.setLineWidth(0.6); c.line(L, 58, R, 58)
        c.setFont("R", 7.5); c.setFillColor(FOOT)
        c.drawCentredString(W / 2, 46, "Immobilien Pospiech GbR  ·  Karl-Marx-Str. 77  ·  16816 Neuruppin  ·  www.immobilien-neuruppin.de")
        c.drawCentredString(W / 2, 37, f"Seite {self.page} von {self.total or '?'}")
    def new_page(self):
        if self.page: self.footer(); self.c.showPage()
        self.page += 1; c = self.c
        lw = 196; c.drawImage(LOGO, (W - lw) / 2, H - 35 - lw * 108 / 458, width=lw, height=lw * 108 / 458, mask="auto")
        self.y = H - 100
        if self.page == 1:
            c.setFont("B", 14); c.setFillColor(HEAD); c.drawCentredString(W / 2, H - 124, "Aufnahmebogen Immobilie")
            c.setFont("R", 10); c.drawCentredString(W / 2, H - 138, "Angaben des Eigentümers")
            h = self.para(INTRO, L, H - 150, CW, "R", 9.5, black, 12.2)
            y = H - 150 - h - 4
            c.setFont("B", 9.5); c.setFillColor(black); c.drawString(L, y - 9.5, "Hinweis:")
            c.setFont("R", 9.5); c.drawString(L + pdfmetrics.stringWidth("Hinweis:  ", "B", 9.5), y - 9.5, "Je vollständiger und exakter Ihre Angaben sind, desto genauer fällt das Ergebnis der Auswertung aus.")
            self.y = y - 24
    def ensure(self, h):
        if self.y - h < BOT: self.new_page()
    def finish(self):
        self.footer(); self.c.save()

    # ---------- Bausteine ----------
    def para(self, txt, x, y, w, font="R", size=10, color=black, lead=None, draw=True):
        lead = lead or size * 1.25; lines = simpleSplit(txt, font, size, w)
        if draw:
            self.c.setFont(font, size); self.c.setFillColor(color)
            for i, l in enumerate(lines): self.c.drawString(x, y - size - i * lead, l)
        return len(lines) * lead
    def uline(self, x1, x2, y):
        self.c.setStrokeColor(LINEC); self.c.setLineWidth(0.75); self.c.line(x1, y, x2, y)
    def tfield(self, fid, x, y, w, h, multi=False):
        self.c.acroForm.textfield(name=self.name(fid), x=x, y=y, width=w, height=h, borderColor=transparent, fillColor=transparent,
                                  textColor=black, borderWidth=0, fontName="Helvetica", fontSize=0 if multi else 9.5,
                                  fieldFlags="multiline" if multi else "")
    def line_field(self, fid, x1, x2, ybase):
        """Schreiblinie mit unsichtbarem Textfeld darüber."""
        self.uline(x1, x2, ybase); self.tfield(fid, x1, ybase + 0.8, x2 - x1, 13)
    def box(self, group, val, x, ytop, single, size=8.6):
        kw = dict(x=x, y=ytop - size, size=size, buttonStyle="check", borderColor=BOXC, fillColor=white, textColor=black, borderWidth=0.8, forceBorder=True)
        if single: self.c.acroForm.radio(name=group, value=re.sub(r"[^A-Za-z0-9]", "_", val)[:30] or "x", shape="square", **kw)
        else: self.c.acroForm.checkbox(name=self.name(group + "_" + val), **kw)

    # ---------- Feldtypen (draw=False misst nur) ----------
    def label_block(self, f, x, y, w, draw):
        h = self.para(f["l"], x, y, w, "B", 10, black, 12, draw)
        n = NOTE.get(f.get("id"))
        if n: h += self.para("(" + n + ")", x, y - h, w, "I", 9, HINT, 11, draw)
        return h
    def f_text_row(self, fs, draw):
        if len(fs) == 1:
            cols = [(IN, 120, R)]
        else:
            mid = L + CW / 2
            cols = [(IN, 108, mid - 8), (mid + 8, 108, R)]
        hs = [self.label_block(f, x, 0, lw, False) for f, (x, lw, e) in zip(fs, cols)]; h = max(max(hs), 13)
        if draw:
            for f, (x, lw, e) in zip(fs, cols):
                self.label_block(f, x, self.y, lw, True)
                self.line_field(f["id"], x + lw + 6, e, self.y - 12)
        return h + 7
    def f_area(self, f, draw):
        lh = self.label_block(f, IN, 0, R - IN, False); n = 7 if f.get("big") else 3; gap = 18
        if draw:
            self.label_block(f, IN, self.y, R - IN, True); y0 = self.y - lh - 2
            for i in range(n): self.uline(IN, R, y0 - gap * (i + 1))
            self.tfield(f["id"], IN, y0 - gap * n + 1, R - IN, gap * n - 2, True)
        return lh + 2 + gap * n + 10
    def f_choice(self, f, draw):
        opts = f["o"]; single = f["t"] == "single"
        lh = self.para(f["l"], L, 0, CW, "B", 10, black, 12, False); n = NOTE.get(f.get("id"))
        nh = self.para("(" + n + ")", L, 0, CW, "I", 9, HINT, 11, False) if n else 0
        avail = R - IN; mw = max(pdfmetrics.stringWidth(o, "R", 10) for o in opts) + 18
        cols = 3 if mw < avail / 3 - 4 else 2 if mw < avail / 2 - 4 else 1
        cw = avail / cols; rows = [opts[i:i + cols] for i in range(0, len(opts), cols)]
        rh = [max(len(simpleSplit(o, "R", 10, cw - 20)) for o in r) * 12 + 6 for r in rows]
        if draw:
            self.para(f["l"], L, self.y, CW, "B", 10, black, 12)
            if n: self.para("(" + n + ")", L, self.y - lh, CW, "I", 9, HINT, 11)
            yy = self.y - lh - nh - 5; grp = self.name(f["id"])
            for r, h in zip(rows, rh):
                for j, o in enumerate(r):
                    x = IN + j * cw; self.box(grp, o, x, yy - 0.5, single); self.para(o, x + 15, yy + 1.2, cw - 20, "R", 10)
                yy -= h
        return lh + nh + 5 + sum(rh) + 6
    def f_hint(self, f, draw):
        h = self.para(f["l"], L, self.y, CW, "I", 9, HINT, 11, draw)
        return h + 6
    def f_h(self, f, draw):
        if draw: self.para(f["l"], L, self.y - 4, CW, "B", 11, HEAD, 13)
        return 22
    def f_rate(self, f, draw):
        ex_x = 206; ex_w = R - ex_x
        rows = [(w, e, max(self.para(e, 0, 0, ex_w, "R", 9, EX, 11, False), 12) + 6) for w, e in f["o"]]
        h = 18 + sum(r[2] for r in rows)
        if draw:
            self.para(f["l"], L, self.y, CW, "B", 10, black); yy = self.y - 18; grp = self.name(f["id"])
            for w, e, rh in rows:
                self.box(grp, w, IN, yy - 0.5, True); self.c.setFont("B", 10); self.c.setFillColor(black); self.c.drawString(IN + 15, yy - 8.2, w)
                self.para(e, ex_x, yy + 0.8, ex_w, "R", 9, EX, 11); yy -= rh
        return h + 6
    def f_modern(self, f, draw):
        lw, jw, uw = 170, 52, 120; dx = IN + lw + jw + uw + 14
        rows = [(l, max(len(simpleSplit(l, "R", 10, lw - 6)) * 12, 12) + 7) for l in f["rows"]]
        h = 16 + sum(r[1] for r in rows)
        if draw:
            c = self.c; y = self.y; c.setFont("B", 10); c.setFillColor(black)
            for t, x in [("Art der Maßnahme", IN), ("Jahr", IN + lw), ("Umfang", IN + lw + jw + 8), ("Details / Kosten", dx)]: c.drawString(x, y - 10, t)
            yy = y - 16
            for i, (l, rh) in enumerate(rows):
                self.para(l, IN, yy, lw - 6, "R", 10)
                self.line_field(f"mod{i}_jahr", IN + lw, IN + lw + jw - 6, yy - 11)
                grp = self.name(f"mod{i}_umfang")
                for j, o in enumerate(["vollständig", "teilweise"]):
                    x = IN + lw + jw + 8 + j * 62; self.box(grp, o, x, yy - 1, True); c.setFont("R", 9.5); c.setFillColor(black); c.drawString(x + 13, yy - 8.5, o)
                self.line_field(f"mod{i}_details", dx, R, yy - 11); yy -= rh
        return h + 6
    def f_docs(self, f, draw):
        lw = 190; ox = IN + lw; ow = (R - ox) / 4; order = f.get("order") or list(range(len(f["rows"])))
        def rh(ri): return len(simpleSplit(f["rows"][ri], "R", 10, lw - 8)) * 12 + (10.5 if ri in DOC_NOTE else 0) + 6
        h = 24 + sum(rh(ri) for ri in order)
        if draw:
            c = self.c; y = self.y
            for j, o in enumerate(f["o"]):
                for k, l in enumerate(simpleSplit(o, "B", 9, ow - 4)): c.setFont("B", 9); c.setFillColor(black); c.drawString(ox + j * ow, y - 9 - k * 10.5, l)
            yy = y - 24
            for ri in order:
                r = rh(ri); n = self.para(f["rows"][ri], IN, yy, lw - 8, "R", 10)
                if ri in DOC_NOTE: self.para("(" + DOC_NOTE[ri] + ")", IN, yy - n, lw - 8, "I", 9, HINT, 10.5)
                grp = self.name("doc" + str(ri))
                for j, o in enumerate(f["o"]): self.box(grp, o, ox + j * ow, yy - 0.5, True)
                yy -= r
        return h + 6
    def f_sign(self, f, draw):
        th = self.para(f["l"], 0, 0, CW, "R", 10, black, 12.5, False); h = th + 62
        if draw:
            self.para(f["l"], L, self.y, CW, "R", 10, black, 12.5); yb = self.y - th - 44
            self.uline(IN, 300, yb)
            self.line_field("ort_datum", 330, R, yb)
            self.c.setFont("B", 10); self.c.setFillColor(black); self.c.drawString(IN, yb - 13, "Unterschrift Eigentümer/in"); self.c.drawString(330, yb - 13, "Ort, Datum")
        return h + 8

    def heading(self, title, draw=True):
        if draw:
            c = self.c; c.setFont("B", 13); c.setFillColor(HEAD); c.drawString(L, self.y - 13, title)
            c.setStrokeColor(ACCENT); c.setLineWidth(1.75); c.line(L, self.y - 19, R, self.y - 19)
        return 30
    def section(self, s):
        blocks = []; tbuf = []
        def flush():
            while tbuf: blocks.append(("textrow", tbuf[:2])); del tbuf[:2]
        for f in s["f"]:
            if f["t"] == "hint" and f["l"].startswith(SKIP_HINT): continue
            if f.get("id") == "k_sign_ort": continue
            if f["t"] == "text" and not f.get("full") and not len(f["l"]) > 34: tbuf.append(f); continue
            flush(); blocks.append(("textrow", [f]) if f["t"] == "text" else (f["t"], f))
        flush()
        fn = {"textrow": self.f_text_row, "area": self.f_area, "single": self.f_choice, "multi": self.f_choice, "hint": self.f_hint,
              "h": self.f_h, "rate": self.f_rate, "modern": self.f_modern, "docs": self.f_docs, "sign": self.f_sign}
        def bh(i): k, f = blocks[i]; return 120 if k == "docs" else fn[k](f, False)
        title = "Bestätigung" if s["id"] == "k9_sign" else s["t"]
        need = bh(0) + (bh(1) if blocks[0][0] in ("h", "hint") and len(blocks) > 1 else 0)
        sn = self.para(SEC_NOTE[s["id"]], L, 0, CW, "I", 9, HINT, 11, False) + 6 if s["id"] in SEC_NOTE else 0
        self.ensure(30 + sn + min(need, 300))
        self.heading(title); self.y -= 30
        if sn: self.para(SEC_NOTE[s["id"]], L, self.y, CW, "I", 9, HINT, 11); self.y -= sn
        for i, (kind, f) in enumerate(blocks):
            if kind in ("h", "hint") and i + 1 < len(blocks): self.ensure(fn[kind](f, False) + min(bh(i + 1), 260))
            if kind == "docs": self.docs_split(f); continue
            h = fn[kind](f, False); self.ensure(h); fn[kind](f, True); self.y -= h
        self.y -= 8
    def docs_split(self, f):
        rest = f.get("order") or list(range(len(f["rows"])))
        while rest:
            n = len(rest)
            while n > 1 and self.y - self.f_docs(dict(f, order=rest[:n]), False) < BOT: n -= 1
            if n < 4 and n < len(rest): self.new_page(); continue
            g = dict(f, order=rest[:n]); h = self.f_docs(g, False); self.f_docs(g, True); self.y -= h; rest = rest[n:]
            if rest: self.new_page()

def build(path, total=None):
    d = Doc(path, total)
    secs = []
    for s in SECS:
        if s["id"] == "k9":   # wie im Aufnahmebogen: Beschreibung, dann eigener Abschnitt „Bestätigung“
            secs.append(dict(s, f=[x for x in s["f"] if x["t"] != "sign"]))
            secs.append(dict(id="k9_sign", n="", t="Bestätigung", f=[x for x in s["f"] if x["t"] == "sign"]))
        else: secs.append(s)
    for s in secs:
        if s["id"] == "k7":
            note = {"t": "hint", "l": "Fotos und Unterlagen legen Sie gern als Kopie bei oder senden sie uns digital zu. Sollten Dokumente nicht vorhanden sein, unterstützen wir Sie gern bei der Beschaffung."}
            s = dict(s, f=[note] + [x for x in s["f"] if x["t"] != "hint"])
        d.section(s)
    d.finish(); return d.page

if __name__ == "__main__":
    out = sys.argv[1]; n = build(out); build(out, n); print("Seiten:", n)
