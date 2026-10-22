import asyncio, subprocess, sys, time, io
from playwright.async_api import async_playwright
async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); errs=[]
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch()
            async def dev(reg):
                c = await br.new_context(viewport={"width":400,"height":860}); await c.add_init_script("localStorage.setItem('apiUrl','http://127.0.0.1:8701/exec')")
                pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
                await pg.goto("http://127.0.0.1:8702/index.html"); await pg.wait_for_timeout(300)
                if reg: await pg.click('[data-tab="register"]'); await pg.fill("#a_name","Dirk")
                await pg.fill("#a_email","dirkpospiech@googlemail.com"); await pg.fill("#a_pw","geheim1234"); await pg.click("#authBtn"); await pg.wait_for_selector("#newObj")
                return pg
            async def sync(pg):
                await pg.click("#sync"); await pg.wait_for_selector("#slog .o:has-text('Abgleich abgeschlossen')", timeout=15000); await pg.click("#sclose")
            A = await dev(True)
            await A.click("#newObj"); await A.wait_for_selector("#secnav"); await A.click('#secnav [data-sec="1"]'); await A.wait_for_selector("#secnav")
            await A.click('[data-k="ob_art"][data-v="Einfamilienhaus"]'); await A.fill("#f_ob_str","Testweg 1"); await A.fill("#f_ob_ort","Neuruppin")
            await sync(A)
            B = await dev(False); await B.wait_for_timeout(2500)
            cards = await B.eval_on_selector_all(".card", "els => els.map(e => e.innerText.split('\\n')[0] + ' | ' + (e.dataset.open ? 'lokal' : 'nur Server'))")
            print("Web nach Login:", cards)
            await B.click("[data-open]"); await B.wait_for_selector("#secnav"); await B.click('[data-sec="2"]'); await B.fill("#f_auftragsnr","221026-01"); await sync(B)
            # A geht zurück zur Übersicht -> soll sich selbst aktualisieren
            await A.click("#home"); await A.wait_for_timeout(16000); await A.evaluate("renderHome(false)"); await A.wait_for_timeout(2500)
            await A.click("[data-open]"); await A.wait_for_selector("#secnav"); await A.click('[data-sec="2"]')
            print("Handy sieht Auftragsnr:", await A.input_value("#f_auftragsnr"))
            # Konfliktfall: A ändert offline-artig, B ändert und gleicht ab
            await A.fill("#f_adressat","Sparkasse")
            await B.click('[data-sec="2"]'); await B.fill("#f_frist","2026-11-30"); await sync(B)
            await A.click("#home"); await A.wait_for_timeout(500); await A.evaluate("refreshRemote.at=0; renderHome(false)"); await A.wait_for_timeout(2500)
            print("Handy-Status bei eigenen Änderungen:", await A.inner_text(".card .chip"))
            print("Fehler:", errs)
            await br.close()
    finally:
        mock.terminate(); web.terminate()
asyncio.run(main())
