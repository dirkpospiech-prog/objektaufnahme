import asyncio, subprocess, sys, time, json, urllib.request, io
from playwright.async_api import async_playwright
from PIL import Image
API = "http://127.0.0.1:8701/exec"
def state(): return json.loads(urllib.request.urlopen("http://127.0.0.1:8701/__state").read())
def api(a, **kw): return json.loads(urllib.request.urlopen(urllib.request.Request(API, data=json.dumps({"action": a, **kw}).encode(), method="POST")).read())

async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs = []; shots = []
    try:
        api("register", email="dirkpospiech@googlemail.com", name="Dirk", password="geheim1234")
        tok = api("login", email="dirkpospiech@googlemail.com", password="geheim1234")["token"]
        inv = api("createInvite", token=tok, title="Seeweg 7, Rheinsberg", email="erika@example.com", name="Erika")
        oid = inv["objectId"]; link = inv["link"].replace("https://dirkpospiech-prog.github.io/objektaufnahme/", "http://127.0.0.1:8702/index.html")
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def ctx(url, w=400):
                c = await br.new_context(viewport={"width": w, "height": 860}); await c.add_init_script("localStorage.setItem('apiUrl','%s')" % API)
                pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); await pg.goto(url); await pg.wait_for_timeout(500); return pg
            C = await ctx(link)
            await C.fill("#ia_name", "Erika Muster"); await C.fill("#ia_pw", "erika1234"); await C.fill("#ia_pw2", "erika1234"); await C.click("#iaBtn"); await C.wait_for_timeout(2500)
            await C.click("[data-open]"); await C.wait_for_selector("#secnav")
            tabs = await C.eval_on_selector_all("#secnav button", "b => b.map(x => x.textContent.replace(/\\d+%|\\s+\\d+$/g,'').trim())")
            print("Reiter:", tabs)
            sec = lambda i: C.click(f'#secnav [data-sec="{i}"]')
            ov = await C.inner_text(".msg.info"); print("Übersicht:", ov.replace("\n", " ")[:120])
            await C.click('.msg.info [data-go]'); await C.wait_for_timeout(200); print("Start-Schritt:", await C.inner_text(".sec-head h2"), "| Weiter-Knopf:", (await C.inner_text(".secfoot .btn.primary")).strip())
            shots.append(await C.screenshot())
            await sec(1)
            await C.click('[data-k="ob_art"][data-v="Einfamilienhaus"]')
            await C.fill("#f_ob_str", "Seeweg 7"); await C.fill("#f_ob_ort", "Rheinsberg")
            print("Zeitraum sichtbar ohne Baujahr:", await C.locator('[data-k="k_bj_zeit"]').count() > 0)
            await C.fill("#f_k_wfl", "142"); await C.fill("#f_k_nfl", "60")
            await C.click('[data-k="k_keller"][data-v="voll unterkellert"]')
            print("Kellerart sichtbar:", await C.locator('[data-k="k_kellerart"]').count() > 0)
            await C.click('[data-k="k_kellerart"][data-v="teilweise ausgebaut, hochwertig nutzbar"]')
            await C.click('[data-k="k_dg"][data-v="teilausgebaut"]'); await C.click('[data-k="k_denkmal"][data-v="ja"]')
            await C.click('[data-k="k_extra"][data-v="Einbauküche"]'); await C.fill("#f_k_extra_info", "Einbauküche 2019, ca. 12.000 €")
            await sec(3); shots.append(await C.screenshot())
            await C.click('[data-k="k_r_bau"][data-v="Hochwertig"]'); await C.click('[data-k="k_r_fenster"][data-v="Durchschnittlich"]'); await C.click('[data-k="k_r_lage"][data-v="Besonders ruhig"]')
            print("Bewertung markiert:", await C.get_attribute('[data-k="k_r_bau"][data-v="Hochwertig"]', "aria-pressed"), await C.get_attribute('[data-k="k_r_bau"][data-v="Einfach"]', "aria-pressed"))
            await sec(4); await C.click('[data-k="pv"][data-v="Photovoltaik"]'); await C.fill("#f_pv_kwp", "9,8"); await C.click('[data-k="er_wasser"][data-v="eigener Brunnen"]')
            await sec(0); print("Name vorbelegt:", await C.input_value("#f_k_name"), "| E-Mail:", await C.input_value("#f_k_mail")); await C.fill("#f_k_name", "Erika Muster"); await C.fill("#f_k_tel", "0171 1234567"); await C.click('[data-k="k_auftrag"][data-v="Verkauf"]')
            await C.click('[data-k="k_eigentum"][data-v="Ehepaar / Lebenspartner"]')
            await sec(6); await C.fill("#f_k_gemarkung", "Rheinsberg"); await C.fill("#f_k_flur", "3")
            # Übergabe ohne Unterschrift
            await C.click('#secnav [data-sec="O"]'); await C.click("#submitK"); await C.wait_for_timeout(300)
            print("Ohne Unterschrift:", (await C.inner_text("#sheetBody")).split("\n")[0])
            await C.click("#toSign"); await C.wait_for_timeout(300)
            await C.fill("#f_k_beschreibung", "Ruhiges Haus am See, großer Garten, neue Heizung 2021."); await C.fill("#f_k_sign_ort", "Rheinsberg")
            await C.click('[data-signok="k_sign"]'); await C.wait_for_timeout(200); print("Leere Unterschrift abgelehnt:", await C.locator("[data-signclear]").count() == 0)
            pad = await C.query_selector("canvas.signpad"); bb = await pad.bounding_box()
            await C.mouse.move(bb["x"] + 30, bb["y"] + 120); await C.mouse.down()
            for i in range(30): await C.mouse.move(bb["x"] + 30 + i * 9, bb["y"] + 120 - 40 * ((i % 6) / 6))
            await C.mouse.up(); shots.append(await C.screenshot())
            await C.click('[data-signok="k_sign"]'); await C.wait_for_timeout(400); shots.append(await C.screenshot())
            await C.wait_for_timeout(6000)
            g = api("getObject", token=tok, id=oid)["object"]; kd = g["kd"]
            print("Server: Unterschrift", "img" in (kd.get("k_sign") or {}), len((kd.get("k_sign") or {}).get("img", "")) // 1024, "KB | k_r_bau:", kd.get("k_r_bau"), "| Gemarkung:", kd.get("k_gemarkung"))
            doc = [d for d in state()["docs"] if any("Angaben des Eigentümers" in str(x) for x in d)]
            print("Protokoll mit Bild:", any("[BILD" in str(x) for x in (doc[0] if doc else [])), "| Zeilen:", len(doc[0]) if doc else 0)
            await C.click('#secnav [data-sec="O"]'); await C.click("#submitK"); await C.click("#cOk"); await C.wait_for_timeout(4000)
            print("Übergeben:", await C.inner_text(".ov-sync .chip"))
            # Büro übernimmt
            A = await ctx("http://127.0.0.1:8702/index.html")
            await A.fill("#a_email", "dirkpospiech@googlemail.com"); await A.fill("#a_pw", "geheim1234"); await A.click("#authBtn"); await A.wait_for_timeout(3000)
            await A.click("[data-open]"); await A.wait_for_selector("#secnav"); await A.click('#secnav [data-sec="K"]'); await A.wait_for_selector("#kTake")
            shots.append(await A.screenshot(full_page=False))
            await A.click("#kTake"); await A.wait_for_timeout(400)
            d = await A.evaluate("cur.data")
            print("Übernahme:", {k: d.get(k) for k in ["wfl", "nfl", "keller", "kellernutzung", "dg", "eig_verh", "er_wasser", "pv_kwp", "gb_gem", "ag_name", "ag_tel"]})
            print("Standard:", d.get("st_wand"), d.get("st_dach"), d.get("st_fenster"), "| Denkmal:", d.get("r_denkmal"), d.get("r_any"), "| Beschreibung:", (d.get("beschr_plus") or "")[:40])
            print("Fehler:", errs)
            await br.close()
    finally:
        mock.terminate(); web.terminate()
        if shots:
            ims = [Image.open(io.BytesIO(s)) for s in shots]; w, h = ims[0].size; m = Image.new("RGB", (w * len(ims), h), "white")
            for i, im in enumerate(ims): m.paste(im, (i * w, 0))
            m.save("/tmp/claude-0/kunde2.png")
asyncio.run(main())
