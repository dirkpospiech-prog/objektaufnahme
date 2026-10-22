import asyncio, subprocess, sys, time, json, urllib.request, io
from playwright.async_api import async_playwright
from PIL import Image
API = "http://127.0.0.1:8701/exec"
def api(a, **kw): return json.loads(urllib.request.urlopen(urllib.request.Request(API, data=json.dumps({"action": a, **kw}).encode(), method="POST")).read())

async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs = []; shots = []
    try:
        api("register", email="dirkpospiech@googlemail.com", name="Dirk", password="geheim1234")
        tok = api("login", email="dirkpospiech@googlemail.com", password="geheim1234")["token"]
        api("register", email="kollege@example.com", name="Max Kollege", password="kollege123")
        inv = api("createInvite", token=tok, title="Seeweg 7, Rheinsberg", email="erika@example.com", name="Erika")
        api("acceptInvite", invite=inv["link"].split("einladung=")[1], name="Erika", password="erika1234")
        inv2 = api("createInvite", token=tok, title="Am See 2, Lindow", email="offen@example.com", name="Otto Offen")
        async with async_playwright() as p:
            br = await p.chromium.launch()
            c = await br.new_context(viewport={"width": 400, "height": 860}); await c.add_init_script("localStorage.setItem('apiUrl','%s')" % API)
            A = await c.new_page(); A.on("pageerror", lambda e: errs.append(str(e))); await A.goto("http://127.0.0.1:8702/index.html"); await A.wait_for_timeout(400)
            await A.fill("#a_email", "dirkpospiech@googlemail.com"); await A.fill("#a_pw", "geheim1234"); await A.click("#authBtn"); await A.wait_for_selector("#toAdmin")
            await A.click("#toAdmin"); await A.wait_for_selector(".admin-row")
            print("Reiter:", await A.eval_on_selector_all("[data-at]", "b => b.map(x => x.textContent)"))
            print("Mitarbeiter:", await A.eval_on_selector_all(".admin-row .who b", "b => b.map(x => x.textContent)"))
            # Freigeben mit Kontrollfenster
            await A.click('[data-act="block"][data-e="kollege@example.com"]'); print("Kontrollfenster:", (await A.inner_text("#sheetBody h2")))
            await A.click("#ctlOk"); await A.wait_for_timeout(800)
            print("Kollege Status:", [u["status"] for u in api("listUsers", token=tok)["users"] if u["email"] == "kollege@example.com"])
            # Zum Admin + zurück
            await A.click('[data-act="role"][data-e="kollege@example.com"]'); await A.click("#ctlOk"); await A.wait_for_timeout(800)
            print("Rolle:", [u["role"] for u in api("listUsers", token=tok)["users"] if u["email"] == "kollege@example.com"])
            await A.click('[data-act="role"][data-e="kollege@example.com"]'); await A.click("#ctlOk"); await A.wait_for_timeout(800)
            # Abbrechen funktioniert
            await A.click('[data-act="block"][data-e="kollege@example.com"]'); await A.click("#sheetBody [data-close]"); await A.wait_for_timeout(300)
            print("Nach Abbrechen noch:", [u["status"] for u in api("listUsers", token=tok)["users"] if u["email"] == "kollege@example.com"])
            # Löschen mit LÖSCHEN
            await A.click('[data-act="del"][data-e="kollege@example.com"]'); print("Löschen-Knopf gesperrt:", await A.is_disabled("#ctlOk"))
            await A.fill("#ctlTxt", "löschen"); await A.click("#ctlOk"); await A.wait_for_timeout(900)
            print("Kollege noch da:", any(u["email"] == "kollege@example.com" for u in api("listUsers", token=tok)["users"]), "| Login:", api("login", email="kollege@example.com", password="kollege123").get("error"))
            print("Eigenes Konto löschen per API:", api("deleteUser", token=tok, email="dirkpospiech@googlemail.com").get("message"))
            # Eigentümer
            await A.click('[data-at="kunden"]'); await A.wait_for_selector("#newInv"); await A.wait_for_timeout(300); shots.append(await A.screenshot(full_page=True))
            print("Eigentümer-Liste:", [t.replace("\n", " ") for t in await A.eval_on_selector_all("#adm .admin-row .who", "b => b.map(x => x.innerText)")])
            rows = await A.query_selector_all("#adm .admin-row")
            # Erika sperren
            erika = [r for r in rows if "erika" in (await r.inner_text()).lower()][0]
            await (await erika.query_selector('[data-ka="block"]')).click(); print("Fenster:", await A.inner_text("#sheetBody h2")); await A.click("#ctlOk"); await A.wait_for_timeout(900)
            print("Erika Login gesperrt:", api("login", email="erika@example.com", password="erika1234").get("error"))
            rows = await A.query_selector_all("#adm .admin-row"); erika = [r for r in rows if "erika" in (await r.inner_text()).lower()][0]
            await (await erika.query_selector('[data-ka="block"]')).click(); await A.click("#ctlOk"); await A.wait_for_timeout(900)
            print("Erika Login wieder:", bool(api("login", email="erika@example.com", password="erika1234").get("token")))
            # Einladung zurückziehen
            rows = await A.query_selector_all("#adm .admin-row"); otto = [r for r in rows if "offen@" in (await r.inner_text())][0]
            await (await otto.query_selector('[data-ka="del"]')).click(); print("Fenster:", await A.inner_text("#sheetBody h2")); await A.click("#ctlOk"); await A.wait_for_timeout(900)
            print("Otto-Link danach:", api("acceptInvite", invite=inv2["link"].split("einladung=")[1], name="Otto", password="otto12345").get("error"))
            # Erika löschen
            rows = await A.query_selector_all("#adm .admin-row"); erika = [r for r in rows if "erika" in (await r.inner_text()).lower()][0]
            await (await erika.query_selector('[data-ka="del"]')).click(); await A.fill("#ctlTxt", "LÖSCHEN"); await A.click("#ctlOk"); await A.wait_for_timeout(900)
            objs = api("listObjects", token=tok)["objects"]
            print("Objekte bleiben:", [(o["title"], o.get("kunde")) for o in objs], "| Erika-Login:", api("login", email="erika@example.com", password="erika1234").get("error"))
            # Objekte: löschen
            await A.click('[data-at="objekte"]'); await A.wait_for_selector("[data-odel]"); shots.append(await A.screenshot(full_page=True))
            await A.click("[data-odel]"); print("Fenster:", await A.inner_text("#sheetBody h2"), "| Knopf gesperrt:", await A.is_disabled("#delGo"))
            await A.fill("#delConfirm", "LÖSCHEN"); await A.click("#delGo"); await A.wait_for_timeout(1200)
            print("Objekte danach:", len(api("listObjects", token=tok)["objects"]))
            print("Fehler:", errs); await br.close()
    finally:
        mock.terminate(); web.terminate()
        if shots:
            ims = [Image.open(io.BytesIO(s)) for s in shots]; w = sum(i.size[0] for i in ims); h = max(i.size[1] for i in ims); m = Image.new("RGB", (w, h), "white"); x = 0
            for im in ims: m.paste(im, (x, 0)); x += im.size[0]
            m.save("/tmp/claude-0/admin.png")
asyncio.run(main())
