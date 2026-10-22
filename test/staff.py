import asyncio, subprocess, sys, time, json, urllib.request, io
from playwright.async_api import async_playwright
from PIL import Image
API = "http://127.0.0.1:8701/exec"
def state(): return json.loads(urllib.request.urlopen("http://127.0.0.1:8701/__state").read())
def api(a, **kw): return json.loads(urllib.request.urlopen(urllib.request.Request(API, data=json.dumps({"action": a, **kw}).encode(), method="POST")).read())
LOCAL = lambda l: l.replace("https://dirkpospiech-prog.github.io/objektaufnahme/", "http://127.0.0.1:8702/index.html")

async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs = []; shots = []
    try:
        api("register", email="dirkpospiech@googlemail.com", name="Dirk", password="geheim1234")
        tok = api("login", email="dirkpospiech@googlemail.com", password="geheim1234")["token"]
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def ctx(url):
                c = await br.new_context(viewport={"width": 400, "height": 860}); await c.add_init_script("localStorage.setItem('apiUrl','%s')" % API)
                pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); await pg.goto(url); await pg.wait_for_timeout(500); return pg
            A = await ctx("http://127.0.0.1:8702/index.html")
            await A.fill("#a_email", "dirkpospiech@googlemail.com"); await A.fill("#a_pw", "geheim1234"); await A.click("#authBtn"); await A.wait_for_selector("#toAdmin")
            await A.click("#toAdmin"); await A.wait_for_selector("#newStaff")
            async def invite(name, mail, role):
                await A.click("#newStaff"); await A.fill("#si_name", name); await A.fill("#si_mail", mail)
                await A.check(f'[name="si_role"][value="{role}"]'); shots.append(await A.screenshot())
                await A.click("#siGo"); print("Kontrollfenster:", (await A.inner_text("#sheetBody")).split("\n")[1][:110])
                await A.click("#ctlOk"); await A.wait_for_selector("#siLink"); link = (await A.inner_text("#siLink")).strip(); await A.click("#sheetBody [data-close]"); await A.wait_for_timeout(600); return link
            l1 = await invite("Max Kollege", "max@example.com", "nutzer")
            l2 = await invite("Anna Admin", "anna@example.com", "admin")
            print("Mails:", [(m["to"], m["subj"]) for m in state()["mails"]])
            print("Offene Einladungen:", [t.replace("\n", " ") for t in await A.eval_on_selector_all("#adm .admin-row .who", "b => b.map(x => x.innerText)")])
            shots.append(await A.screenshot(full_page=True))
            # erneut senden ersetzt alten Link
            l1b = await invite("Max Kollege", "max@example.com", "nutzer")
            print("Alter Link nach Erneut-Senden:", api("acceptInvite", invite=l1.split("=")[1], password="maxmax123").get("message", "")[:60])
            # Max löst ein
            M = await ctx(LOCAL(l1b)); await M.wait_for_timeout(800)
            print("Begrüßung Max:", await M.inner_text("#iaIntro"), "| Name vorbelegt:", await M.input_value("#ia_name"))
            await M.fill("#ia_pw", "maxmax123"); await M.fill("#ia_pw2", "maxmax123"); await M.click("#iaBtn"); await M.wait_for_timeout(2500)
            print("Max eingeloggt, neue Aufnahme möglich:", await M.locator("#newObj").count() > 0, "| Verwaltung sichtbar:", await M.locator("#toAdmin").count() > 0)
            # Anna löst ein
            N = await ctx(LOCAL(l2)); await N.wait_for_timeout(800); print("Begrüßung Anna:", (await N.inner_text("#iaIntro"))[:45])
            await N.fill("#ia_pw", "anna12345"); await N.fill("#ia_pw2", "anna12345"); await N.click("#iaBtn"); await N.wait_for_timeout(2500)
            print("Anna Verwaltung sichtbar:", await N.locator("#toAdmin").count() > 0)
            users = {u["email"]: (u["role"], u["status"]) for u in api("listUsers", token=tok)["users"]}
            print("Benutzer:", users, "| offene Einladungen:", len(api("listUsers", token=tok)["invites"]))
            # Einladung zurückziehen
            l3 = await invite("Zoe Test", "zoe@example.com", "nutzer")
            await A.click('[data-inv="del"]'); await A.click("#ctlOk"); await A.wait_for_timeout(800)
            print("Zoe-Link nach Zurückziehen:", api("acceptInvite", invite=l3.split("=")[1], password="zoezoe123").get("error"))
            print("Doppelte Einladung:", api("inviteStaff", token=tok, name="Max", email="max@example.com", role="nutzer").get("message"))
            print("Eigentümer-Link Begrüßung:", api("inviteInfo", invite="quatsch").get("error"))
            await A.click('[data-at="kunden"]'); await A.click('[data-at="users"]'); await A.wait_for_timeout(800); shots.append(await A.screenshot(full_page=True))
            print("Fehler:", errs); await br.close()
    finally:
        mock.terminate(); web.terminate()
        if shots:
            ims = [Image.open(io.BytesIO(s)) for s in shots]; w = sum(i.size[0] for i in ims); h = max(i.size[1] for i in ims); m = Image.new("RGB", (w, h), "white"); x = 0
            for im in ims: m.paste(im, (x, 0)); x += im.size[0]
            m.save("/tmp/claude-0/staff.png")
asyncio.run(main())
