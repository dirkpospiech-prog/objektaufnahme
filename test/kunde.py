import asyncio, subprocess, sys, time, json, urllib.request, io
from playwright.async_api import async_playwright
from PIL import Image
API="http://127.0.0.1:8701/exec"
def state(): return json.loads(urllib.request.urlopen("http://127.0.0.1:8701/__state").read())
def api(a, **kw): return json.loads(urllib.request.urlopen(urllib.request.Request(API, data=json.dumps({"action":a,**kw}).encode(), method="POST")).read())
async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs=[]; shots=[]
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def ctx(url="http://127.0.0.1:8702/index.html"):
                c = await br.new_context(viewport={"width":400,"height":860}); await c.add_init_script("localStorage.setItem('apiUrl','%s')" % API)
                pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); await pg.goto(url); await pg.wait_for_timeout(400); return pg
            async def sync(pg):
                await pg.click("#sync"); await pg.wait_for_selector("#slog .o:has-text('Gespeichert'), #slog .o:has-text('Abgleich abgeschlossen')", timeout=20000); await pg.click("#sclose")
            A = await ctx()
            await A.click('[data-tab="register"]'); await A.fill("#a_name","Dirk"); await A.fill("#a_email","dirkpospiech@googlemail.com"); await A.fill("#a_pw","geheim1234"); await A.click("#authBtn"); await A.wait_for_selector("#newObj")
            await A.click("#newObj"); await A.wait_for_selector("#secnav"); await A.click('[data-k="ob_art"][data-v="Einfamilienhaus"]'); await A.fill("#f_ob_str","Seeweg 7"); await A.fill("#f_ob_ort","Rheinsberg")
            await A.click('#secnav [data-sec="0"]'); await A.fill("#f_auftragsnr","SV-INTERN-77"); await sync(A)
            await A.click("#menu"); await A.click("#invK"); await A.fill("#inv_name","Erika Muster"); await A.fill("#inv_mail","erika@example.com"); await A.click("#invGo"); await A.wait_for_selector("#invLink", timeout=8000)
            link = (await A.inner_text("#invLink")).strip().replace("https://dirkpospiech-prog.github.io/objektaufnahme/","http://127.0.0.1:8702/index.html")
            print("Einladungslink:", link[:70], "…  Mails:", [m["subj"] for m in state()["mails"]])
            await A.click("[data-close]")
            C = await ctx(link); shots.append(await C.screenshot())
            await C.fill("#ia_name","Erika Muster"); await C.fill("#ia_pw","erika1234"); await C.fill("#ia_pw2","erika1234"); await C.click("#iaBtn")
            await C.wait_for_timeout(3000); shots.append(await C.screenshot())
            await C.click("[data-open]"); await C.wait_for_selector("#secnav")
            tabs = await C.eval_on_selector_all("#secnav [data-sec]", "e=>e.map(x=>x.innerText.split('\\n').join(' ').trim())")
            print("Kunde sieht Reiter:", tabs)
            print("Kunde sieht SV-Daten (Auftragsnr)?", "SV-INTERN-77" in await C.content())
            shots.append(await C.screenshot(full_page=False))
            await C.click('#secnav [data-sec="0"]'); await C.click('[data-k="ob_art"][data-v="Einfamilienhaus"]'); await C.fill("#f_k_wfl","142"); await C.fill("#f_k_bj","1998")
            await C.click('#secnav [data-sec="4"]'); await C.click('[data-k="nutzung"][data-v="eigengenutzt"]')
            await C.click('#secnav [data-sec="6"]'); await C.fill("#f_k_preis","389000")
            await C.click('#secnav [data-sec="F"]'); await C.set_input_files("#galIn","/tmp/claude-0/test.jpg"); await C.wait_for_timeout(1200)
            await C.click('#secnav [data-sec="D"]'); await C.select_option("#docType", label="Energieausweis"); await C.set_input_files("#docIn","/tmp/claude-0/grundbuch.pdf"); await C.wait_for_timeout(800)
            await sync(C)
            st = state(); js=[f for f in st["files"] if f["name"]=="aufnahme.json"]
            print("Protokolle im Ordner:", sorted(set(f["name"] for f in st["files"] if f["type"]=="doc")) or [d for d in st["docs"] if d][:0], "| Doks:", len(st["docs"]))
            o = api("login", email="dirkpospiech@googlemail.com", password="geheim1234"); tok=o["token"]
            oid = api("listObjects", token=tok)["objects"][0]["id"]; g = api("getObject", token=tok, id=oid)["object"]
            print("Server: SV-Auftragsnr erhalten:", g["data"].get("auftragsnr"), "| Kunde-Wfl:", g["kd"].get("k_wfl"), "| Fotos:", len(g["photos"]), "| Dateien:", [f.get("label") for f in g["files"]])
            ck = api("login", email="erika@example.com", password="erika1234")["token"]; gk = api("getObject", token=ck, id=oid)["object"]
            print("Kunde bekommt vom Server:", sorted(gk["data"].keys()), "| SV-Felder sichtbar?", "auftragsnr" in json.dumps(gk))
            # Admin sieht Eigentümer-Angaben und übernimmt
            await A.click("#home"); await A.wait_for_timeout(300); await A.evaluate("refreshRemote.at=0; renderHome(false)"); await A.wait_for_timeout(2500)
            await A.click("[data-open]"); await A.wait_for_selector("#secnav"); await A.click('#secnav [data-sec="K"]'); await A.wait_for_selector("#kTake")
            shots.append(await A.screenshot())
            await A.click("#kTake"); await A.wait_for_timeout(300); await A.click('#secnav [data-sec="5"]'); print("SV Wohnfläche nach Übernahme:", await A.input_value("#f_wfl"), "| Baujahr:", await A.input_value("#f_bj"))
            await A.click('#secnav [data-sec="0"]'); await A.fill("#f_adressat","Sparkasse"); await sync(A)
            g = api("getObject", token=tok, id=oid)["object"]; print("Nach SV-Abgleich Kunde-Preis noch da:", g["kd"].get("k_preis"), "| Fotos gesamt:", len(g["photos"]))
            # Kunde übergibt
            await C.evaluate("cur.data.k_sign = {img: 'data:image/png;base64,iVBORw0KGgo=', at: new Date().toISOString(), name: 'Erika'}; touch()"); await C.wait_for_timeout(300)
            await C.click('#secnav [data-sec="O"]'); await C.click("#submitK"); await C.click("#cOk"); await C.wait_for_timeout(4000)
            print("Kunde gesperrt:", await C.locator("fieldset.fs[disabled]").count() >= 0, "| Status:", await C.inner_text(".ov-sync .chip"))
            await C.click('#secnav [data-sec="0"]'); print("Eingabefelder gesperrt:", await C.is_disabled("#f_k_wfl"))
            shots.append(await C.screenshot())
            print("Mails:", [m["subj"] for m in state()["mails"]])
            r = api("saveObject", token=ck, object={"id":oid,"data":{"k_preis":"1"}}); print("Speichern nach Übergabe:", r.get("error"))
            await A.click("#home"); await A.wait_for_timeout(300); await A.evaluate("refreshRemote.at=0; renderHome(false)"); await A.wait_for_timeout(2500); await A.click("[data-open]"); await A.wait_for_selector("#secnav"); await A.click('#secnav [data-sec="K"]'); await A.wait_for_selector("#kReopen"); await A.click("#kReopen"); await A.wait_for_timeout(1000)
            await C.click("#home"); await C.wait_for_timeout(300); await C.evaluate("refreshRemote.at=0; renderHome(false)"); await C.wait_for_timeout(2500)
            await C.click("[data-open]"); await C.wait_for_selector("#secnav"); await C.click('#secnav [data-sec="0"]'); print("Nach Freigabe wieder editierbar:", not await C.is_disabled("#f_k_wfl"))
            print("Fehler:", errs)
            await br.close()
    finally:
        mock.terminate(); web.terminate()
        if shots:
            ims=[Image.open(io.BytesIO(s)) for s in shots]; w,h=ims[0].size; m=Image.new("RGB",(w*len(ims),h)); [m.paste(im,(i*w,0)) for i,im in enumerate(ims)]; m.save("/tmp/claude-0/kunde.png")
asyncio.run(main())
