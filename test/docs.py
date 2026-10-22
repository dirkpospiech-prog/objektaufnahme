import asyncio, subprocess, sys, time, json, urllib.request, io
from playwright.async_api import async_playwright
from PIL import Image
def state(): return json.loads(urllib.request.urlopen("http://127.0.0.1:8701/__state").read())
async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs=[]; shots=[]
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def dev(reg):
                c = await br.new_context(viewport={"width":400,"height":860}); await c.add_init_script("localStorage.setItem('apiUrl','http://127.0.0.1:8701/exec')")
                pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto("http://127.0.0.1:8702/index.html"); await pg.wait_for_timeout(300)
                if reg: await pg.click('[data-tab="register"]'); await pg.fill("#a_name","Dirk")
                await pg.fill("#a_email","dirkpospiech@googlemail.com"); await pg.fill("#a_pw","geheim1234"); await pg.click("#authBtn"); await pg.wait_for_selector("#newObj"); return pg
            A = await dev(True)
            await A.click("#newObj"); await A.wait_for_selector("#secnav"); await A.click('#secnav [data-sec="1"]'); await A.wait_for_selector("#secnav"); await A.click('[data-k="ob_art"][data-v="Einfamilienhaus"]'); await A.fill("#f_ob_str","Am See 2"); await A.fill("#f_ob_ort","Lindow")
            await A.click('#secnav [data-sec="D"]'); await A.wait_for_selector("#docType")
            await A.select_option("#docType", label="Bauzeichnungen")
            await A.set_input_files("#scanIn", "/tmp/claude-0/seite.jpg"); await A.wait_for_selector("#scanDone")
            await A.set_input_files("#scanIn", "/tmp/claude-0/seite.jpg"); await A.wait_for_timeout(800)
            shots.append(await A.screenshot())
            await A.click("#scanDone"); await A.wait_for_selector(".filerow", timeout=15000)
            await A.select_option("#docType", label="Grundbuchauszug (max. 3 Monate)")
            await A.set_input_files("#docIn", "/tmp/claude-0/grundbuch.pdf"); await A.wait_for_timeout(800)
            shots.append(await A.screenshot())
            print("Dateien in App:", await A.eval_on_selector_all(".finfo b", "e=>e.map(x=>x.textContent)"))
            await A.click('#secnav [data-sec="4"]'); print("Abschnitt 17 Status:", await A.eval_on_selector_all('.doc .pill[aria-pressed="true"]', "e=>e.map(x=>x.dataset.k+'='+x.dataset.v)"))
            await A.click("#sync"); await A.wait_for_selector("#slog .o:has-text('Abgleich abgeschlossen')", timeout=20000); await A.click("#sclose")
            st = state(); un = [f for f in st["folders"] if f["name"]=="Unterlagen"]
            print("Drive-Unterlagen:", [(f["name"], f["type"], f["size"]//1024, f["desc"]) for f in st["files"] if un and un[0]["id"] in f["parents"]])
            B = await dev(False); await B.wait_for_timeout(2500); await B.click("[data-open]"); await B.wait_for_selector("#secnav"); await B.click('#secnav [data-sec="D"]')
            print("Zweites Gerät sieht:", await B.eval_on_selector_all(".finfo b", "e=>e.map(x=>x.textContent)"))
            await B.click("#home"); await B.wait_for_selector("#toAdmin"); await B.click("#toAdmin"); await B.click('[data-at="objekte"]'); await B.wait_for_selector("[data-odel]")
            await B.click("[data-odel]"); await B.fill("#delConfirm","löschen"); await B.click("#delGo"); await B.wait_for_timeout(1500)
            st = state(); print("Ordner im Papierkorb:", [f["name"] for f in st["folders"] if f["trashed"]], "| Objekte im Sheet:", len([r for r in [s for s in st["sheets"] if s["name"]=="Objekte"][0]["rows"]])-1)
            await A.click("#home"); await A.wait_for_timeout(300); await A.evaluate("refreshRemote.at=0; renderHome(false)"); await A.wait_for_timeout(2500)
            print("Handy nach Löschung:", await A.locator(".card").count(), "Objekte")
            print("Fehler:", errs)
            await br.close()
    finally:
        mock.terminate(); web.terminate()
        if shots:
            ims=[Image.open(io.BytesIO(s)) for s in shots]; w,h=ims[0].size; m=Image.new("RGB",(w*len(ims),h)); [m.paste(im,(i*w,0)) for i,im in enumerate(ims)]; m.save("/tmp/claude-0/docs.png")
asyncio.run(main())
