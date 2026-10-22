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
        inv = api("inviteStaff", token=tok, name="Max", email="max@example.com", role="nutzer")
        api("acceptInvite", invite=inv["link"].split("=")[1], password="maxmax123"); mt = api("login", email="max@example.com", password="maxmax123")["token"]
        o1 = api("createInvite", token=tok, title="Seeweg 7, Rheinsberg", email="erika@example.com", name="Erika Muster")
        api("acceptInvite", invite=o1["link"].split("=")[1], password="erika1234")
        o2 = api("createInvite", token=tok, title="Am See 2, Lindow", email="otto@example.com", name="Otto")
        for o in [o1, o2]: api("setAccess", token=tok, objectId=o["objectId"], emails=["max@example.com"])
        print("Max sieht vorher:", [o["title"] for o in api("listObjects", token=mt)["objects"]])
        async with async_playwright() as p:
            br = await p.chromium.launch()
            c = await br.new_context(viewport={"width": 360, "height": 740}); await c.add_init_script("localStorage.setItem('apiUrl','%s')" % API)
            A = await c.new_page(); A.on("pageerror", lambda e: errs.append(str(e))); await A.goto("http://127.0.0.1:8702/index.html"); await A.wait_for_timeout(400)
            await A.fill("#a_email", "dirkpospiech@googlemail.com"); await A.fill("#a_pw", "geheim1234"); await A.click("#authBtn"); await A.wait_for_selector("#toAdmin")
            await A.click("#toAdmin"); await A.wait_for_selector("#newStaff"); await A.click("#newStaff"); await A.wait_for_timeout(300)
            box = await A.eval_on_selector("#sheetBody", "e => { const r = e.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), innerHeight]; }")
            print("Einladungsfenster oben/unten/Bildschirm:", box); shots.append(await A.screenshot())
            await A.click("#sheetBody [data-close]")
            # Objekt archivieren
            await A.click('[data-at="objekte"]'); await A.wait_for_selector("[data-arch]")
            await A.click(f'[data-arch="{o2["objectId"]}"]'); print("Fenster:", await A.inner_text("#sheetBody h2")); shots.append(await A.screenshot()); await A.click("#ctlOk"); await A.wait_for_timeout(900)
            print("Max sieht danach:", [o["title"] for o in api("listObjects", token=mt)["objects"]], "| Otto-Objekt für Max:", api("getObject", token=mt, id=o2["objectId"]).get("error"))
            st = state(); arch = [f for f in st["folders"] if f["name"] == "Archiv"]
            print("Archiv-Ordner:", len(arch), "| darin:", [f["name"] for f in st["folders"] if arch and f["parent"] == arch[0]["id"]])
            print("Archiv-Bereich:", await A.inner_text("details.arch summary"))
            await A.click("details.arch summary"); await A.wait_for_timeout(200); shots.append(await A.screenshot(full_page=True))
            # Kunde archivieren inkl. Objekte
            await A.click('[data-at="kunden"]'); await A.wait_for_selector("[data-ka]"); await A.wait_for_timeout(300)
            rows = await A.query_selector_all("#adm > .admin-row"); er = [r for r in rows if "Erika" in await r.inner_text()][0]
            await (await er.query_selector('[data-ka="arch"]')).click(); print("Fenster:", await A.inner_text("#sheetBody h2"), "| Objekte mit archivieren angehakt:", await A.is_checked("#archObjs"))
            await A.click("#ctlOk"); await A.wait_for_timeout(1200)
            print("Erika Login:", api("login", email="erika@example.com", password="erika1234").get("message"))
            print("Kunden aktiv:", [t.split("\n")[0] for t in await A.eval_on_selector_all("#adm > .admin-row .who", "b => b.map(x => x.innerText)")], "| Archiv:", await A.inner_text("details.arch summary"))
            await A.click("details.arch summary"); shots.append(await A.screenshot(full_page=True))
            # Wiederherstellen
            await A.click('details.arch [data-ka="unarch"]'); await A.wait_for_timeout(300)
            arch_rows = await A.query_selector_all('details.arch [data-ka="unarch"]')
            await A.click("#ctlOk"); await A.wait_for_timeout(1200)
            print("Nach Wiederherstellen – Login Erika:", bool(api("login", email="erika@example.com", password="erika1234").get("token")),
                  "| Max sieht:", sorted(o["title"] for o in api("listObjects", token=mt)["objects"]))
            print("Fehler:", errs); await br.close()
    finally:
        mock.terminate(); web.terminate()
        if shots:
            ims = [Image.open(io.BytesIO(s)) for s in shots]; w = sum(i.size[0] for i in ims); h = max(i.size[1] for i in ims); m = Image.new("RGB", (w, h), "white"); x = 0
            for im in ims: m.paste(im, (x, 0)); x += im.size[0]
            m.save("/tmp/claude-0/archive.png")
asyncio.run(main())
