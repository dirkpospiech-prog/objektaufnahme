import asyncio, subprocess, sys, time, io
from playwright.async_api import async_playwright
from PIL import Image
async def main():
    mock = subprocess.Popen(["node", "/home/claude/test/gas-mock.js"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    web = subprocess.Popen([sys.executable, "-m", "http.server", "8702", "-d", "/home/claude/repo/app", "-b", "127.0.0.1"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(1.2); shots=[]; errs=[]
    try:
        async with async_playwright() as p:
            br = await p.chromium.launch(); c = await br.new_context(viewport={"width":400,"height":860})
            await c.add_init_script("localStorage.setItem('apiUrl','http://127.0.0.1:8701/exec')")
            pg = await c.new_page(); pg.on("pageerror", lambda e: errs.append(str(e)))
            await pg.goto("http://127.0.0.1:8702/index.html"); await pg.wait_for_timeout(300)
            await pg.click('[data-tab="register"]'); await pg.fill("#a_name","Dirk"); await pg.fill("#a_email","dirkpospiech@googlemail.com"); await pg.fill("#a_pw","geheim1234"); await pg.click("#authBtn")
            await pg.wait_for_selector("#newObj"); await pg.click("#newObj"); await pg.wait_for_selector("#secnav"); await pg.click('#secnav [data-sec="1"]'); await pg.wait_for_selector("#secnav")
            await pg.click('[data-k="ob_art"][data-v="Einfamilienhaus"]'); await pg.fill("#f_ob_str","Seestraße 4"); await pg.fill("#f_ob_ort","Rheinsberg")
            await pg.click('#secnav [data-sec="O"]'); await pg.wait_for_timeout(200); shots.append(await pg.screenshot(full_page=True))
            await pg.click('#secnav [data-sec="3"]'); await pg.wait_for_timeout(100)
            print("Rechte ohne Leitfrage:", await pg.locator('[data-yn]').count()//3, "Fragen")
            await pg.click('[data-k="r_any"][data-v="ja"]'); await pg.wait_for_timeout(100)
            print("Rechte mit 'ja':", await pg.locator('[data-yn]').count()//3, "Fragen")
            await pg.click('#secnav [data-sec="2"]'); print("Stichtag-Datum sichtbar (aktuell):", await pg.locator('#f_stichtag').count())
            await pg.click('[data-k="stichtag_art"][data-v="zurückliegend (z. B. Todestag)"]'); await pg.wait_for_timeout(100); print("… zurückliegend:", await pg.locator('#f_stichtag').count())
            await pg.click('#secnav [data-sec="7"]'); print("Baujahr-Zeitraum vorher:", await pg.locator('[data-k="bj_zeitraum"]').count())
            await pg.fill("#f_bj","1936"); await pg.press("#f_bj","Tab"); await pg.wait_for_timeout(200); print("… nach Eingabe 1936:", await pg.locator('[data-k="bj_zeitraum"]').count())
            print("Genehmigung Ja-Klasse:", await pg.get_attribute('[data-yn="bg_vorhanden"][data-v="Ja"]','class'))
            await pg.click('#secnav [data-sec="9"]'); await pg.click('[data-stdall="3"]'); await pg.wait_for_timeout(200)
            print("Bauteile Stufe 3:", await pg.locator('.lv[aria-pressed="true"]').count())
            shots.append(await pg.screenshot())
            await pg.click('#secnav [data-sec="10"]'); print("Mängelfragen vorher:", await pg.locator('[data-yn^="m_"]').count()//3)
            await pg.click('[data-k="zustand"][data-v="Neubau / neuwertig"]'); await pg.wait_for_timeout(100); print("Modernisierungstabelle bei Neubau:", await pg.locator('[data-mod]').count())
            await pg.click('#secnav [data-sec="F"]'); await pg.set_input_files("#galIn", "/tmp/claude-0/test.jpg"); await pg.wait_for_timeout(1200)
            await pg.select_option('[data-pcat]', 'Küche'); await pg.wait_for_timeout(300)
            print("Foto-Kategorie jetzt:", await pg.inner_text('.catgroup h3'))
            await pg.click('#secnav [data-sec="O"]'); await pg.click('#sync2'); await pg.wait_for_selector("#slog .o:has-text('Abgleich abgeschlossen')", timeout=15000); await pg.click("#sclose")
            await pg.wait_for_timeout(300); shots.append(await pg.screenshot(full_page=False))
            print("Fehler:", errs)
            await br.close()
    finally:
        mock.terminate(); web.terminate()
        ims=[Image.open(io.BytesIO(s)) for s in shots]; H=max(i.size[1] for i in ims); W=sum(i.size[0] for i in ims); m=Image.new("RGB",(W,H),"white"); x=0
        for im in ims: m.paste(im,(x,0)); x+=im.size[0]
        m.save("/tmp/claude-0/ux.png")
asyncio.run(main())
