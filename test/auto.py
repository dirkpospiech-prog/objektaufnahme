import asyncio, subprocess, sys, time, json, urllib.request
from playwright.async_api import async_playwright
API="http://127.0.0.1:8701/exec"
def api(a, **kw): return json.loads(urllib.request.urlopen(urllib.request.Request(API, data=json.dumps({"action":a,**kw}).encode(), method="POST")).read())
async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs=[]
    try:
        api("register", email="dirkpospiech@googlemail.com", name="Dirk", password="geheim1234")
        tok = api("login", email="dirkpospiech@googlemail.com", password="geheim1234")["token"]
        inv = api("createInvite", token=tok, title="Seeweg 7, Rheinsberg", email="erika@example.com", name="Erika")
        oid = inv["objectId"]; link = inv["link"].replace("https://dirkpospiech-prog.github.io/objektaufnahme/","http://127.0.0.1:8702/index.html")
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def ctx(url):
                c = await br.new_context(viewport={"width":400,"height":860}); await c.add_init_script("localStorage.setItem('apiUrl','%s')" % API)
                pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e))); await pg.goto(url); await pg.wait_for_timeout(500); return pg
            C = await ctx(link)
            await C.fill("#ia_name","Erika"); await C.fill("#ia_pw","erika1234"); await C.fill("#ia_pw2","erika1234"); await C.click("#iaBtn"); await C.wait_for_timeout(2500)
            await C.click("[data-open]"); await C.wait_for_selector("#secnav")
            await C.click('#secnav [data-sec="0"]'); await C.click('[data-k="ob_art"][data-v="Einfamilienhaus"]'); await C.fill("#f_k_wfl","142")
            print("Chip direkt nach Eingabe:", await C.inner_text("#syncChip"))
            await C.wait_for_timeout(7000)
            print("Chip nach 7 s:", await C.inner_text("#syncChip"))
            g = api("getObject", token=tok, id=oid)["object"]; print("Server hat Wohnfläche:", g["kd"].get("k_wfl"))
            await C.click('#secnav [data-sec="F"]'); await C.set_input_files("#galIn", "/tmp/claude-0/test.jpg"); await C.wait_for_timeout(6000)
            g = api("getObject", token=tok, id=oid)["object"]; print("Fotos auf Server:", len(g["photos"]), "| Chip:", await C.inner_text("#syncChip"))
            # zweites Gerät
            D = await ctx("http://127.0.0.1:8702/index.html")
            await D.fill("#a_email","erika@example.com"); await D.fill("#a_pw","erika1234"); await D.click("#authBtn"); await D.wait_for_timeout(3000)
            await D.click("[data-open]"); await D.wait_for_selector("#secnav"); await D.click('#secnav [data-sec="0"]')
            print("Zweites Gerät sieht Wohnfläche:", await D.input_value("#f_k_wfl"))
            print("Fehler:", errs); await br.close()
    finally: mock.terminate(); web.terminate()
asyncio.run(main())
