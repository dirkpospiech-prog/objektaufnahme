# Objektaufnahme – Immobilien Pospiech GbR

App für Ortstermine zur Marktwertermittlung: Aufnahmebogen (18 Abschnitte, Standardstufen nach ImmoWertV 2021), Fotos nach Kategorien, offline nutzbar. Daten, Fotos und ein Aufnahmeprotokoll landen im Google Drive des Büros.

## Aufbau

| Ordner | Inhalt |
| --- | --- |
| `app/` | Die App (HTML, CSS, JavaScript). Wird als Web-App veröffentlicht und in die Android-App gepackt. |
| `app/schema.js` | Fragen und Abschnitte des Aufnahmebogens – hier anpassen. |
| `app/config.js` | Server-Adresse (Web-App-URL aus Google Apps Script). |
| `server/Code.gs` | Server für Google Apps Script: Anmeldung, Freigaben, Rechte, Ablage im Drive. |
| `.github/workflows/` | Automatischer Bau der Android-App (APK) und der Web-App. |
| `assets/` | App-Symbol und Startbild für Android. |

## Downloads

- Android-App: `https://github.com/<KONTO>/objektaufnahme/releases/latest/download/Objektaufnahme.apk`
- Web-App: `https://<KONTO>.github.io/objektaufnahme/`

## Benötigte Secrets (Settings → Secrets and variables → Actions)

`ANDROID_KEY_ALIAS`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEYSTORE_BASE64` – Werte aus der separat übergebenen Datei `Signaturschluessel_GEHEIM.txt`. Ohne diese Secrets entsteht eine Test-APK, über die sich spätere Versionen nicht installieren lassen.

## Rechte

- Neue Nutzer beantragen den Zugang in der App, der Admin gibt ihn frei (App → Verwaltung oder Verwaltungstabelle im Drive).
- Nutzer sehen eigene Objekte und solche, die ihnen zugewiesen sind. Admins sehen alle.
- Passwörter werden nur als gesalzener Hash gespeichert; Anmeldungen laufen nach 60 Tagen ab, nach 8 Fehlversuchen ist die E-Mail-Adresse 15 Minuten gesperrt.

## Technik

Capacitor 8.5.2 (Android), keine weiteren Bibliotheken. Schriften DM Sans und Playfair Display (SIL Open Font License) liegen in `app/fonts/`.
