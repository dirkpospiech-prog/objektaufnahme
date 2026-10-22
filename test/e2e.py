import asyncio, json, subprocess, time, urllib.request, io, sys
from playwright.async_api import async_playwright
from PIL import Image

API = "http://127.0.0.1:8701/exec"
APP = "http://127.0.0.1:8702/index.html"
shots = []

def state():
    return json.loads(urllib.request.urlopen("http://127.0.0.1:8701/__state").read())

def api(action, **kw):
    req = urllib.request.Request(API, data=json.dumps({"action": action, **kw}).encode(), method="POST")
    return json.loads(urllib.request.urlopen(req).read())

async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2)
    img = Image.new("RGB", (3000, 2000), (180, 140, 90)); b = io.BytesIO(); img.save(b, "JPEG"); open("/tmp/claude-0/test.jpg", "wb").write(b.getvalue())
    errs = []
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def ctx():
                c = await br.new_context(viewport={"width": 400, "height": 860})
                await c.add_init_script(f"localStorage.setItem('apiUrl', '{API}')")
                pg = await c.new_page()
                pg.on("pageerror", lambda e: errs.append("pageerror " + str(e)))
                pg.on("console", lambda m: m.type == "error" and "ERR_" not in m.text and errs.append(m.text))
                await pg.goto(APP); await pg.wait_for_timeout(400)
                return pg
            # 1) Admin registriert sich (wird automatisch Admin)
            pg = await ctx()
            shots.append(await pg.screenshot())
            await pg.click('[data-tab="register"]')
            await pg.fill("#a_name", "Dirk Pospiech"); await pg.fill("#a_email", "dirkpospiech@googlemail.com"); await pg.fill("#a_pw", "geheim1234")
            await pg.click("#authBtn"); await pg.wait_for_selector("#newObj", timeout=8000)
            # 2) Neue Aufnahme
            await pg.click("#newObj"); await pg.wait_for_selector("#f_ob_str")
            await pg.fill("#f_ob_str", "Fehrbelliner Str. 12"); await pg.fill("#f_ob_ort", "16816 Neuruppin")
            await pg.click('[data-k="ob_art"][data-v="Einfamilienhaus"]')
            await pg.click('[data-sec="3"]'); await pg.click('[data-k="r_any"][data-v="ja"]'); await pg.click('[data-yn="r_weg"][data-v="Ja"]'); await pg.fill("#f_r_weg_n", "zugunsten Flst. 45")
            await pg.click('[data-sec="7"]'); await pg.click('[data-std="st_wand"][data-v="3"]')
            await pg.click('[data-sec="8"]'); await pg.fill("#f_mod_0_j", "2015"); await pg.click('[data-k="mod:0"][data-v="vollständig"]')
            shots.append(await pg.screenshot())
            await pg.click('[data-sec="F"]'); await pg.click('[data-cat="Bad / WC"]')
            await pg.set_input_files("#galIn", "/tmp/claude-0/test.jpg"); await pg.wait_for_timeout(1200)
            await pg.fill('[data-cap]', "Fliesen gerissen"); await pg.wait_for_timeout(500)
            shots.append(await pg.screenshot())
            await pg.click("#sync"); await pg.wait_for_selector("#slog .o:has-text('Abgleich abgeschlossen')", timeout=15000)
            shots.append(await pg.screenshot())
            st = state()
            obj_folders = [f for f in st["folders"] if f["parent"] == "1idz0oqS8e05Y91BPfiUxiX24zc_tVaG_"]
            jpgs = [f for f in st["files"] if f["name"].endswith(".jpg")]
            js = [f for f in st["files"] if f["name"] == "aufnahme.json"]
            print("Objektordner:", [f["name"] for f in obj_folders])
            print("Fotos:", [(f["name"], f["size"], f["desc"]) for f in jpgs])
            print("aufnahme.json:", len(js), "Protokoll-Zeilen:", len(st["docs"][0]) if st["docs"] else 0)
            print("Protokoll Auszug:", [x for x in st["docs"][0] if "Wege" in x or "Außenwände" in x or "Dach inkl" in x or "Bad" in x])
            assert len(obj_folders) == 1 and len(jpgs) == 1 and len(js) == 1
            # 3) Zweiter Nutzer beantragt Zugang, Admin gibt frei und weist Objekt zu
            await pg.click("#sclose")
            r = api("register", email="kollege@example.com", name="Max Kollege", password="kollege123"); print("register:", r["message"])
            r = api("login", email="kollege@example.com", password="kollege123"); print("login vor Freigabe:", r.get("message")); assert r["error"] == "pending"
            await pg.click("#home"); await pg.wait_for_selector("#toAdmin"); await pg.click("#toAdmin")
            await pg.wait_for_selector('[data-act="block"][data-e="kollege@example.com"]'); shots.append(await pg.screenshot())
            await pg.click('[data-act="block"][data-e="kollege@example.com"]'); await pg.click("#ctlOk"); await pg.wait_for_timeout(800)
            await pg.click('[data-at="objekte"]'); await pg.wait_for_selector("[data-sel]")
            await pg.select_option("[data-sel]", "kollege@example.com"); await pg.click("#ctlOk"); await pg.wait_for_timeout(800)
            shots.append(await pg.screenshot())
            print("Mails:", state()["mails"])
            # 4) Kollege meldet sich an, sieht das Objekt, lädt es und ergänzt
            pg2 = await ctx()
            await pg2.fill("#a_email", "kollege@example.com"); await pg2.fill("#a_pw", "kollege123"); await pg2.click("#authBtn")
            await pg2.wait_for_selector("[data-open]", timeout=8000); shots.append(await pg2.screenshot())
            await pg2.click("[data-open]"); await pg2.wait_for_selector("#secnav"); await pg2.click('[data-sec="2"]'); await pg2.wait_for_selector("#f_ob_str")
            assert await pg2.input_value("#f_ob_str") == "Fehrbelliner Str. 12"
            await pg2.click('[data-sec="F"]'); await pg2.wait_for_selector(".ph img", timeout=8000)
            await pg2.click('[data-sec="0"]'); await pg2.fill("#f_auftragsnr", "211026-01")
            await pg2.click("#sync"); await pg2.wait_for_selector("#slog .o:has-text('Abgleich abgeschlossen')", timeout=15000); await pg2.click("#sclose")
            # 5) Admin ändert alte Fassung -> Konflikt
            await pg.click("#adminBack"); await pg.wait_for_selector("[data-open]"); await pg.click("[data-open]")
            await pg.wait_for_selector("#secnav"); await pg.click('[data-sec="0"]'); await pg.fill("#f_adressat", "Sparkasse")
            await pg.click("#sync"); await pg.wait_for_selector("#cfLoad, #slog .o:has-text('Abgleich abgeschlossen')", timeout=15000); shots.append(await pg.screenshot())
            if await pg.locator("#cfLoad").count(): await pg.click("#cfMine"); await pg.wait_for_selector("#slog .o:has-text('Abgleich abgeschlossen')", timeout=15000)
            o = api("login", email="dirkpospiech@googlemail.com", password="geheim1234"); g = api("getObject", token=o["token"], id=json.loads(json.dumps(api("listObjects", token=o["token"])))["objects"][0]["id"])
            print("Endstand Version:", g["object"]["version"], "Adressat:", g["object"]["data"].get("adressat"), "Auftragsnr:", g["object"]["data"].get("auftragsnr"))
            # 6) Fremder Nutzer ohne Zuweisung sieht nichts
            api("register", email="fremd@example.com", name="Fremd", password="fremd12345")
            print("Fehler im Browser:", errs)
            await br.close()
    finally:
        mock.terminate(); web.terminate()
        ims = [Image.open(io.BytesIO(s)) for s in shots]
        if ims:
            w, h = ims[0].size; m = Image.new("RGB", (w * len(ims), h), "white")
            for i, im in enumerate(ims): m.paste(im, (i * w, 0))
            m.save("/tmp/claude-0/e2e.png")

asyncio.run(main())
