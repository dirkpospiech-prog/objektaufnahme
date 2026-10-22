"use strict";
/* Aufbau des Aufnahmebogens – hier können Abschnitte und Fragen angepasst werden. */
const YN = (id, l) => ({ t: "yn", id, l });
const YNg = (id, l) => ({ t: "yn", id, l, good: 1 });   /* „Ja“ ist hier positiv */
const T = (id, l, o = {}) => ({ t: "text", id, l, ...o });
const H = l => ({ t: "h", l });
const SECTIONS = [
 { id: "s1", n: "1", t: "Anlass & Auftrag", f: [
  { t: "multi", id: "anlass", l: "Anlass", o: ["Verkauf", "Kauf / Kaufpreisprüfung", "Finanzierung / Beleihung", "Erbschaft / Nachlass", "Schenkung / Übertragung", "Scheidung / Vermögensaufteilung", "Steuerliche Zwecke", "Vermietung / Verpachtung", "Sonstiges"] },
  T("adressat", "Adressat / Verwendung (Bank, Finanzamt, Gericht …)", { full: 1 }),
  { t: "single", id: "stichtag_art", l: "Stichtag", o: ["aktuell (Ortstermin)", "zurückliegend (z. B. Todestag)"] },
  { t: "hint", id: "stichtag_hint", l: "Wertermittlungs- und Qualitätsstichtag = Tag des Ortstermins (Abschnitt 16)." },
  T("stichtag", "Wertermittlungsstichtag", { type: "date" }), T("qualstichtag", "Qualitätsstichtag (falls abweichend)", { type: "date" }),
  T("frist", "Gutachten benötigt bis", { type: "date" }), T("auftragsnr", "Auftrags-Nr."),
  { t: "multi", id: "verfahren", l: "Vorgesehene Verfahren", o: ["Vergleichswertverfahren", "Ertragswertverfahren", "Sachwertverfahren"] } ] },
 { id: "s2", n: "2", t: "Auftraggeber & Eigentum", f: [
  H("Auftraggeber/in"), T("ag_name", "Name, Vorname"), T("ag_firma", "Firma"), T("ag_str", "Straße, Hausnummer", { full: 1 }),
  T("ag_plz", "PLZ", { num: 1 }), T("ag_ort", "Ort"), T("ag_tel", "Telefon", { type: "tel" }), T("ag_mail", "E-Mail", { type: "email" }),
  { t: "single", id: "ag_rolle", l: "Auftraggeber/in ist", o: ["Eigentümer/in", "Miteigentümer/in", "Erbe / Erbin", "Bevollmächtigte(r) / Betreuer(in)", "Kaufinteressent/in", "Sonstiges"] },
  T("eig_name", "Eigentümer/in (falls abweichend)", { full: 1 }),
  { t: "single", id: "eig_verh", l: "Eigentumsverhältnis", o: ["Alleineigentum", "Miteigentum nach Bruchteilen", "Eheleute / Lebenspartner", "Erbengemeinschaft", "Gesellschaft (GbR, GmbH …)"] },
  T("eig_anteile", "Beteiligte und Anteile", { full: 1 }),
  H("Erwerb"), T("erw_jahr", "Erwerbsjahr", { num: 1 }), T("erw_art", "Art (Kauf, Erbe, Schenkung, Eigenbau)"), T("erw_preis", "Kaufpreis / Baukosten (€)", { num: 1 }) ] },
 { id: "s3", n: "3", t: "Objekt & Grundbuch", f: [
  { t: "single", id: "ob_art", l: "Objektart – bestimmt, welche Fragen erscheinen", o: ["Einfamilienhaus", "Zweifamilienhaus", "Doppelhaushälfte", "Reihenmittelhaus", "Reihenendhaus", "Mehrfamilienhaus", "Eigentumswohnung", "Wohn- und Geschäftshaus", "Gewerbe / Büro", "Bauland / unbebaut", "Wochenend- / Erholungsgrundstück", "Land- / Forstwirtschaft", "Sonstiges"] },
  T("ob_str", "Straße, Hausnummer", { full: 1 }), T("ob_plz", "PLZ", { num: 1 }), T("ob_ort", "Ort / Ortsteil"),
  H("Grundbuch und Kataster"), T("gb_ag", "Amtsgericht"), T("gb_von", "Grundbuch von"), T("gb_blatt", "Blatt"), T("gb_gem", "Gemarkung"),
  T("gb_flur", "Flur"), T("gb_flst", "Flurstück(e)"), T("gb_bv", "lfd. Nr. Bestandsverzeichnis") ] },
 { id: "s4", n: "4", t: "Rechte & Lasten", f: [
  { t: "single", id: "r_any", l: "Gibt es Rechte, Lasten oder Beschränkungen? (Grundbuch Abt. II, Baulasten, Denkmalschutz, Bindungen …)", o: ["keine bekannt", "ja", "unbekannt – noch prüfen"] },
  { t: "hint", id: "r_hint", l: "Bitte jeweils angeben, was zutrifft. Ja = wertrelevanter Umstand vorhanden." },
  YN("r_weg", "Wege-, Geh- oder Fahrrecht"), YN("r_leitung", "Leitungsrecht"), YN("r_wohnrecht", "Wohnungsrecht"), YN("r_niess", "Nießbrauchrecht"),
  T("r_berechtigt", "Wohnrecht/Nießbrauch: Berechtigte(r)"), T("r_gebjahr", "Geburtsjahr(e) Berechtigte", { num: 1 }), T("r_entgelt", "Vereinbartes Entgelt (€/Monat)", { num: 1 }),
  YN("r_erbbau", "Erbbaurecht"), T("r_erbbauzins", "Erbbauzins (€/Jahr)", { num: 1 }), T("r_erbbauende", "Laufzeit bis (Jahr)", { num: 1 }),
  YN("r_vorkauf", "Vorkaufsrecht"), YN("r_reallast", "Reallast, Leibrente oder Rückauflassungsvormerkung"), YN("r_ueberbau", "Überbau (vom / auf Nachbargrundstück)"),
  YN("r_baulast", "Baulasten"), YN("r_nichteingetragen", "Nicht eingetragene Rechte / Nachbarabsprachen"), YN("r_sanierung", "Sanierungs-, Entwicklungs- oder Umlegungsgebiet; offene Ausgleichsbeträge"),
  YN("r_denkmal", "Denkmalschutz"), YN("r_bindung", "Miet- oder Belegungsbindung"), YN("r_sonst", "Sonstige Eintragungen Abt. II"),
  H("Besonderheiten vor 1990"), YN("r_gebeigentum", "Getrenntes Gebäudeeigentum"), YN("r_schuldr", "Nutzungsvertrag nach Schuldrechtsanpassungsgesetz"), YN("r_bodenreform", "Bodenreform / Rückübertragungsansprüche") ] },
 { id: "s5", n: "5", t: "Grundstück & Lage", f: [
  T("gr_flaeche", "Grundstücksfläche (m²)", { num: 1 }), T("gr_teilflaechen", "Bauland / Garten / sonstige (m²)"),
  { t: "multi", id: "gr_zuschnitt", l: "Zuschnitt", o: ["regelmäßig", "unregelmäßig", "Eckgrundstück", "Hinterlieger"] },
  { t: "single", id: "gr_topo", l: "Topografie", o: ["eben", "leicht hängig", "stark hängig"] },
  { t: "multi", id: "gr_ausr", l: "Ausrichtung Garten / Terrasse", o: ["Nord", "Ost", "Süd", "West"] },
  YNg("l_wasser", "Wassergrundstück, Seezugang, Steg"), YN("l_hochwasser", "Überschwemmungs-/Hochwasserrisikogebiet; frühere Überflutungen"),
  YN("l_laerm", "Beeinträchtigung durch Lärm, Geruch o. Ä."), YNg("l_bebauung", "Weitere Bebauung / Teilung möglich oder geplant"), YN("l_beitraege", "Erschließungs- oder Anliegerbeiträge offen"),
  H("Planungsrecht"), { t: "single", id: "pl_bplan", l: "Planungsrecht", o: ["Bebauungsplan", "§ 34 BauGB (Innenbereich)", "§ 35 BauGB (Außenbereich)", "unbekannt"] },
  T("pl_art", "Art der Nutzung (WA, MI …)"), T("pl_grz", "GRZ", { num: 1 }), T("pl_gfz", "GFZ", { num: 1 }), T("pl_brw", "Bodenrichtwert (€/m²)", { num: 1 }),
  T("gr_grundsteuer", "Grundsteuer (€/Jahr)", { num: 1 }), { t: "area", id: "lage_notiz", l: "Lagebeschreibung (Makro-/Mikrolage, Infrastruktur)" } ] },
 { id: "s6", n: "6", t: "Gebäude", f: [
  T("bj", "Ursprüngliches Baujahr", { num: 1 }), T("bj_anbau", "An-/Umbauten (Art, Jahr)"),
  { t: "single", id: "bj_zeitraum", l: "Falls Baujahr unbekannt", o: ["vor 1900", "1900–1930", "1931–1948", "1949–1967", "1968–1980", "1981–1990", "1991–2000", "2001–2010", "2011–2020", "nach 2020"] },
  H("Bauweise und Dach"),
  { t: "multi", id: "bauweise", l: "Bauweise", o: ["Massivbau", "Fertighaus", "Holz-/Holzständerbau", "Fachwerk", "Plattenbau / Montagebau", "Sonstige"] },
  T("fertighaus", "Fertighaus: Hersteller / Typ"), T("dacheindeckung", "Dacheindeckung (Material)"),
  { t: "single", id: "dachform", l: "Dachform", o: ["Satteldach", "Walm-/Krüppelwalmdach", "Flachdach", "Pultdach", "Mansarddach", "Sonstige"] },
  H("Geschosse und Räume"), T("geschosse", "Vollgeschosse", { num: 1 }), T("zimmer", "Zimmer gesamt", { num: 1 }), T("baeder", "Badezimmer", { num: 1 }),
  T("wcs", "Gäste-WCs", { num: 1 }), T("we", "Wohneinheiten", { num: 1 }), T("ge", "Gewerbeeinheiten", { num: 1 }),
  { t: "single", id: "einlieger", l: "Einliegerwohnung", o: ["keine", "vorhanden"] },
  { t: "single", id: "keller", l: "Unterkellerung", o: ["voll unterkellert", "teilunterkellert", "nicht unterkellert"] },
  { t: "multi", id: "kellernutzung", l: "Keller", o: ["einfacher Nutzkeller", "teilweise ausgebaut", "feucht / eingeschränkt nutzbar"] },
  { t: "single", id: "dg", l: "Dachgeschoss", o: ["ausgebaut", "teilausgebaut", "nicht ausgebaut, ausbaufähig", "nicht ausbaufähig / Flachdach"] },
  H("Flächen"), T("wfl", "Wohnfläche (m²)", { num: 1 }), T("nfl", "Nutzfläche (m²)", { num: 1 }), T("gfl", "Gewerbe-/Bürofläche (m²)", { num: 1 }), T("bgf", "Bruttogrundfläche BGF (m²)", { num: 1 }),
  { t: "multi", id: "fl_quelle", l: "Flächenangaben beruhen auf", o: ["WoFlV / II. BV", "Bauakte", "Kaufvertrag / Teilungserklärung", "Aufmaß vor Ort", "Exposé / Schätzung", "unbekannt"] },
  H("Freisitz, Außenanlagen, Barrierefreiheit"),
  { t: "multi", id: "aussen", l: "Vorhanden", o: ["Balkon / Loggia", "Terrasse", "Wintergarten beheizt", "Wintergarten unbeheizt", "Garten", "Einfriedung / Tor", "Aufzug", "stufenlos / barrierearm", "Pool / Teich"] },
  H("Garagen und Stellplätze"),
  { t: "grid", id: "stellpl", l: "Stellplätze", cols: [["art", "Art (Garage, Carport …)", 1], ["anz", "Anzahl", 0, 1], ["bj", "Baujahr", 0, 1], ["zust", "Bauweise / Zustand", 1]] },
  H("Genehmigungen"), YNg("bg_vorhanden", "Baugenehmigungen für alle Gebäude vorhanden"), YN("bg_ungenehmigt", "Nicht genehmigte An-/Umbauten oder Nutzungsänderungen") ] },
 { id: "s7", n: "7", t: "Eigentumswohnung", f: [
  { t: "hint", id: "etw_hint", l: "Nur bei Wohnungs- oder Teileigentum." },
  T("etw_nr", "Nr. lt. Aufteilungsplan"), T("etw_mea", "Miteigentumsanteil (z. B. 85/1.000)"), T("etw_lage", "Geschoss / Lage im Haus"), T("etw_einheiten", "Einheiten in der Anlage", { num: 1 }),
  { t: "multi", id: "etw_snr", l: "Sondernutzungsrechte", o: ["Kellerraum", "Stellplatz / Garage", "Garten / Terrasse", "Dachboden / Abstellraum", "Sonstiges"] },
  T("etw_hausgeld", "Hausgeld gesamt (€/Monat)", { num: 1 }), T("etw_ruecklage_mon", "davon Erhaltungsrücklage (€/Monat)", { num: 1 }),
  T("etw_ruecklage", "Erhaltungsrücklage WEG gesamt (€)", { num: 1 }), T("etw_verwalter", "Hausverwaltung"),
  YN("etw_umlage", "Beschlossene Sonderumlagen / größere Maßnahmen"), YN("etw_streit", "Rechtsstreitigkeiten in der WEG") ] },
 { id: "s8", n: "8", t: "Ausstattungsstandard", f: [
  { t: "hint", l: "Standardstufen nach ImmoWertV 2021, Anlage 4. Mehrere Stufen ankreuzen, wenn Bauteile unterschiedlich ausgeführt sind." },
  { t: "stdall", id: "st_all", l: "Schnellauswahl: Stufe für alle noch offenen Bauteile übernehmen, danach Abweichungen anpassen" },
  { t: "std", id: "st_wand", l: "Außenwände", o: ["Holzfachwerk, Ziegelmauerwerk; einfacher Putz/Verkleidung; kein oder veralteter Wärmeschutz (vor ca. 1980)", "Mauerwerk z. B. Hohlblock, verputzt oder Holzverkleidung; nicht zeitgemäßer Wärmeschutz (vor ca. 1995)", "Leichtziegel, Kalksandstein, Porenbeton; Edelputz; WDVS oder Wärmedämmputz (nach ca. 1995)", "Verblendmauerwerk zweischalig, hinterlüftete Vorhangfassade; Dämmung nach ca. 2005", "Aufwendige Fassade (Naturstein, Sichtbeton, Glas); Passivhausstandard"] },
  { t: "std", id: "st_dach", l: "Dach", o: ["Dachpappe, Faserzement-/Wellplatten; keine bis geringe Dämmung", "Einfache Betondachsteine/Tonziegel, Bitumenschindeln; Dämmung vor ca. 1995", "Beschichtete Betondachsteine/Tonziegel, Folienabdichtung, Zinkrinnen; Dämmung nach ca. 1995", "Glasierte Tonziegel, besondere Dachform, Aufsparrendämmung (nach ca. 2005)", "Schiefer/Kupfer, Dachbegrünung, aufwendige Dachlandschaft; Passivhausstandard"] },
  { t: "std", id: "st_fenster", l: "Fenster und Außentüren", o: ["Einfachverglasung; einfache Holztüren", "Zweifachverglasung vor ca. 1995; Haustür ohne zeitgemäßen Wärmeschutz", "Zweifachverglasung nach ca. 1995, Rollläden manuell; zeitgemäße Haustür", "Dreifachverglasung, Sonnenschutzglas, elektr. Rollläden; Haustür mit Einbruchschutz", "Große Festverglasungen, Spezialglas; Außentüren hochwertig"] },
  { t: "std", id: "st_innen", l: "Innenwände und -türen", o: ["Fachwerk, Lehmputz, Kalkanstrich; einfache Füllungstüren", "Leichte Trennwände (Gipskarton); leichte Türen, Stahlzargen", "Massive bzw. gedämmte Trennwände; schwere Türen, Holzzargen", "Sichtmauerwerk, Vertäfelungen; Massivholz-, Schiebe-, Glastüren", "Gestaltete Wandabläufe, Edelholz/Metall; raumhohe Türelemente"] },
  { t: "std", id: "st_decken", l: "Decken und Treppen", o: ["Holzbalkendecken ohne Füllung; einfache Weichholztreppe", "Holzbalkendecken mit Füllung, Kappendecken; einfache Stahl-/Hartholztreppe", "Decken mit Tritt-/Luftschallschutz (schwimmender Estrich); Stahlbetontreppe", "Größere Spannweiten, Deckenverkleidung; gewendelte oder hochwertige Holztreppe", "Gegliederte Decken mit Edelholz/Metall; repräsentative Treppenanlage"] },
  { t: "std", id: "st_boden", l: "Fußböden", o: ["Ohne Belag", "Linoleum, Teppich, Laminat, PVC einfach", "Linoleum, Teppich, Laminat, PVC besser; Fliesen, Kunststein", "Naturstein, Fertigparkett, hochwertige Fliesen, Massivholzdielen", "Hochwertiges Parkett, Naturstein, Edelholz"] },
  { t: "std", id: "st_sanitaer", l: "Sanitär", o: ["Einfaches Bad, Stand-WC, Installation auf Putz", "Ein Bad mit WC, Dusche oder Wanne; teilweise gefliest", "Ein Bad mit WC, Dusche und Wanne; Gäste-WC; raumhoch gefliest", "1–2 Bäder gehoben, bodengleiche Dusche, Doppelwaschtisch", "Mehrere großzügige, hochwertige Bäder"] },
  { t: "std", id: "st_heizung", l: "Heizung", o: ["Einzelöfen, Schwerkraftheizung", "Zentral-/Fernheizung älterer Bauart, Gastherme, Nachtspeicher", "Elektronisch geregelte Zentral-/Fernheizung, NT- oder Brennwertkessel", "Fußbodenheizung, Solarthermie für Warmwasser, Kaminanschluss", "Wärmepumpe, Solar für Heizung, BHKW, Hybridsysteme"] },
  { t: "std", id: "st_elektro", l: "Elektro und Technik", o: ["Sehr wenige Steckdosen, kein FI, Leitungen teils auf Putz", "Wenige Steckdosen, Schalter und Sicherungen", "Zeitgemäße Ausstattung, Zählerschrank mit Unterverteilung", "Zahlreiche Steckdosen, Lüftung mit WRG, Netzwerkanschlüsse", "Video-/Alarmanlage, zentrale Lüftung, Klima, Bussystem"] } ] },
 { id: "s9", n: "9", t: "Modernisierung & Mängel", f: [
  { t: "single", id: "zustand", l: "Gesamtzustand", o: ["Neubau / neuwertig", "kernsaniert", "umfassend modernisiert", "teilweise modernisiert", "überwiegend Ursprungszustand", "sanierungsbedürftig"] },
  T("kernsaniert_jahr", "Kernsanierung im Jahr", { num: 1 }),
  { t: "h", id: "mod_h", l: "Modernisierungen (ImmoWertV Anlage 2)" },
  { t: "modern", id: "mod", rows: ["Dach inkl. Wärmedämmung", "Fenster und Außentüren", "Leitungen (Strom, Gas, Wasser, Abwasser)", "Heizungsanlage", "Wärmedämmung Außenwände", "Bäder", "Innenausbau (Decken, Böden, Treppen)", "Wesentliche Grundrissverbesserung", "Sonstiges"] },
  H("Mängel und Schäden"),
  { t: "single", id: "m_any", l: "Bekannte Mängel oder Schäden?", o: ["keine bekannt", "ja", "unbekannt – noch prüfen"] },
  YN("m_feucht", "Feuchtigkeit / Nässe"), YN("m_schimmel", "Schimmel"), YN("m_risse", "Risse, Setzungen"), YN("m_undicht", "Undichtigkeiten / Wasserschäden"),
  YN("m_holz", "Holzschädlinge / Hausschwamm"), YN("m_sonst", "Sonstige Bauschäden"),
  T("instand", "Instandhaltungsstau / anstehende Maßnahmen", { full: 1 }), T("instand_kosten", "Geschätzte Kosten (€)", { num: 1 }),
  T("rnd", "Restnutzungsdauer (SV-Einschätzung, Jahre)", { num: 1 }) ] },
 { id: "s10", n: "10", t: "Energie & Erschließung", f: [
  { t: "multi", id: "energie", l: "Energieträger", o: ["Erdgas", "Heizöl", "Flüssiggas", "Wärmepumpe", "Fernwärme", "Pellets / Holz", "Strom (Nachtspeicher)", "Solarthermie", "Sonstiges"] },
  { t: "single", id: "heizsystem", l: "Heizsystem", o: ["Zentralheizung", "Etagenheizung", "Einzelöfen"] },
  { t: "multi", id: "waermevert", l: "Wärmeverteilung", o: ["Heizkörper", "Fußbodenheizung", "Kamin- / Kachelofen"] },
  T("wz_bj", "Baujahr Wärmeerzeuger", { num: 1 }), T("wz_typ", "Hersteller / Typ"), T("ww", "Warmwasserbereitung", { full: 1 }),
  H("Photovoltaik, Speicher, Wallbox"),
  { t: "multi", id: "pv", l: "Vorhanden", o: ["Photovoltaik", "Batteriespeicher", "Wallbox"] },
  T("pv_kwp", "PV-Leistung (kWp)", { num: 1 }), T("pv_bj", "Baujahr PV", { num: 1 }), T("pv_speicher", "Speicher (kWh)", { num: 1 }),
  { t: "single", id: "pv_eigentum", l: "PV-Anlage ist", o: ["Eigentum", "gepachtet / gemietet", "geleast"] },
  H("Energieausweis"), { t: "single", id: "ea_art", l: "Art", o: ["Bedarfsausweis", "Verbrauchsausweis", "nicht vorhanden"] },
  T("ea_klasse", "Effizienzklasse"), T("ea_kwh", "Endenergie (kWh/m²a)", { num: 1 }), T("ea_ausgestellt", "Ausgestellt am", { type: "date" }), T("ea_gueltig", "Gültig bis", { type: "date" }),
  H("Erschließung"),
  { t: "single", id: "er_wasser", l: "Trinkwasser", o: ["öffentliches Netz", "eigener Brunnen", "beides"] },
  { t: "single", id: "er_abwasser", l: "Abwasser", o: ["öffentlicher Kanal", "Kleinkläranlage", "abflusslose Sammelgrube"] },
  { t: "single", id: "er_strom", l: "Strom", o: ["angeschlossen", "anliegend", "nicht vorhanden"] },
  { t: "single", id: "er_gas", l: "Gasnetz", o: ["angeschlossen", "anliegend", "nicht vorhanden"] },
  { t: "single", id: "er_internet", l: "Internet", o: ["Glasfaser", "VDSL / Kabel", "langsames DSL / keiner"] },
  { t: "single", id: "er_tank", l: "Brennstofftank", o: ["keiner", "oberirdisch / Keller", "Erdtank (auch stillgelegt)"] } ] },
 { id: "s11", n: "11", t: "Besondere Bauteile", f: [
  { t: "hint", l: "Einbauküche, Kamin, Sauna, Pool, Nebengebäude, Werkstatt, Zisterne, Brunnen, Alarmanlage, Markisen …" },
  { t: "grid", id: "bes", l: "Bauteil", cols: [["bez", "Bezeichnung", 1], ["bj", "Baujahr", 0, 1], ["kosten", "Kosten ca. (€)", 0, 1], ["zust", "Zustand / Bemerkung", 1]] } ] },
 { id: "s12", n: "12", t: "Nutzung & Vermietung", f: [
  { t: "multi", id: "nutzung", l: "Nutzung", o: ["eigengenutzt", "teilweise vermietet", "vollständig vermietet", "verpachtet", "leerstehend"] },
  T("leer_seit", "Leerstand seit"),
  H("Miet- und Nutzungseinheiten"),
  { t: "grid", id: "mieten", l: "Einheit", cols: [["einheit", "Einheit / Lage", 0], ["nutz", "Nutzung", 0], ["fl", "Fläche (m²)", 0, 1], ["miete", "Nettokaltmiete (€/Monat)", 0, 1], ["beginn", "Mietbeginn", 0], ["bes", "Staffel / Index / befristet", 0]] },
  YN("v_erhoehung", "Mieterhöhung in den letzten 3 Jahren"), YN("v_rueckstand", "Mietrückstände, Minderungen, Streit"), YN("v_kuendigung", "Kündigungen / bevorstehender Auszug"),
  H("Nicht umlagefähige Kosten"), T("bk_verw", "Verwaltung (€/Jahr)", { num: 1 }), T("bk_inst", "Instandhaltung (€/Jahr)", { num: 1 }), T("bk_sonst", "Sonstige (€/Jahr)", { num: 1 }) ] },
 { id: "s13", n: "13", t: "Schadstoffe & Altlasten", f: [
  { t: "single", id: "sch_any", l: "Hinweise auf Schadstoffe oder Altlasten?", o: ["keine bekannt", "ja", "unbekannt – noch prüfen"] },
  YN("sch_asbest", "Asbest (Wellplatten, Fassade, Floor-Flex, Nachtspeicher)"), YN("sch_kmf", "Künstliche Mineralfasern (vor 1996)"), YN("sch_holz", "Holzschutzmittel (PCP, Lindan)"),
  YN("sch_pak", "Teer / PAK (Parkettkleber, Dachpappe)"), YN("sch_blei", "Bleileitungen"), YN("sch_boden", "Altlastenverdacht Boden"), YN("sch_sonst", "Sonstige Schadstoffe") ] },
 { id: "s14", n: "14", t: "Vergleichsverkäufe", f: [
  { t: "grid", id: "vgl", l: "Verkauf", cols: [["adr", "Adresse / Lage", 1], ["art", "Objektart, Größe", 0], ["preis", "Kaufpreis (€)", 0, 1], ["datum", "Datum", 0], ["bes", "Besonderheiten", 1]] } ] },
 { id: "s15", n: "15", t: "Beschreibung", f: [
  { t: "area", id: "beschr_plus", l: "Besonderheiten / Vorzüge" }, { t: "area", id: "beschr_minus", l: "Nachteile / Mängel" } ] },
 { id: "s16", n: "16", t: "Ortstermin", f: [
  T("ot_datum", "Datum", { type: "date" }), T("ot_zeit", "Uhrzeit"), T("ot_anwesend", "Anwesende Personen", { full: 1 }), T("ot_wetter", "Witterung"), T("ot_zutritt", "Zutritt / Schlüssel"),
  { t: "multi", id: "ot_besichtigt", l: "Besichtigt", o: ["alle Wohn- und Nutzräume", "Keller", "Dachboden / Spitzboden", "Heizung / Technik", "Nebengebäude / Garage", "Außenanlagen"] },
  { t: "area", id: "ot_nicht", l: "Nicht besichtigte Bereiche und Gründe" }, { t: "area", id: "ot_eindruck", l: "Eindruck vor Ort" } ] },
 { id: "s17", n: "17", t: "Unterlagen", f: [
  { t: "docs", id: "docs", rows: ["Grundbuchauszug (max. 3 Monate)", "Flurkarte / Liegenschaftskarte", "Baulastenauskunft", "Bauzeichnungen", "Baugenehmigung / Bauakte", "Baubeschreibung, Flächenberechnung", "Energieausweis", "Kauf-/Übergabe-/Schenkungsvertrag", "Nachweise Modernisierungen", "Prüfberichte Heizung / Schornsteinfeger", "Grundsteuerbescheid", "Gebäudeversicherung", "Vorhandene Gutachten", "Mietverträge, Mieterliste, NK-Abrechnung", "Erbbaurechtsvertrag", "Teilungserklärung mit Aufteilungsplan", "Wirtschaftsplan, Hausgeld, Protokolle WEG", "Trinkwasser-/Legionellenprüfung"], o: ["liegt vor", "folgt", "nicht vorhanden", "wir beschaffen"] } ] },
 { id: "s18", n: "18", t: "Notizen SV", f: [
  { t: "area", id: "sv_notizen", l: "Notizen" }, { t: "area", id: "sv_offen", l: "Offene Punkte / Nachforderungen" } ] }
];
const PHOTO_CATS = ["Straßenansicht", "Rückansicht / Garten", "Seitenansichten", "Wohnräume", "Küche", "Bad / WC", "Keller", "Dach / Dachboden", "Heizung / Technik", "Zähler", "Schäden", "Außenanlagen", "Nebengebäude / Garage", "Unterlagen", "Lage / Umgebung", "Sonstiges"];

/* =====================================================================
   KASKADE – was je nach Objektart und Antworten angezeigt wird.
   Ist noch keine Objektart gewählt (oder „Sonstiges“), erscheint alles.
   Ausgeblendete Angaben bleiben gespeichert, zählen aber nicht mit
   und erscheinen nicht im Aufnahmeprotokoll.
   ===================================================================== */
const ART = {
  HAUS: ["Einfamilienhaus", "Doppelhaushälfte", "Reihenmittelhaus", "Reihenendhaus"],
  ZFH: ["Zweifamilienhaus"],
  ETW: ["Eigentumswohnung"],
  ERTRAG: ["Mehrfamilienhaus", "Wohn- und Geschäftshaus", "Gewerbe / Büro"],
  UNBEBAUT: ["Bauland / unbebaut", "Land- / Forstwirtschaft"],
  FREIZEIT: ["Wochenend- / Erholungsgrundstück"]
};
const known = d => !!d.ob_art && d.ob_art !== "Sonstiges";
const is = (d, ...g) => known(d) && g.some(x => ART[x].includes(d.ob_art));
const only = (d, ...g) => !known(d) || is(d, ...g);      // nur bei diesen Arten (unbekannt: zeigen)
const not = (d, ...g) => !is(d, ...g);                    // nicht bei diesen Arten
const bebaut = d => not(d, "UNBEBAUT");
const ja = (d, id) => (d[id] || {}).v === "Ja";
const has = (d, id, v) => Array.isArray(d[id]) ? d[id].includes(v) : d[id] === v;
const vermietet = d => ["teilweise vermietet", "vollständig vermietet", "verpachtet"].some(v => has(d, "nutzung", v));
const mietrelevant = d => vermietet(d) || is(d, "ERTRAG");

/* Antworten, nach deren Änderung der Bogen neu aufgebaut wird */
const DEPENDS = new Set(["ob_art", "nutzung", "r_erbbau", "r_wohnrecht", "r_niess", "bauweise", "zustand", "pv", "ag_rolle", "eig_verh",
  "r_any", "m_any", "sch_any", "stichtag_art", "bj"]);

/* Leitfragen: Einzelfragen erscheinen erst bei „ja“ (bei älteren Aufnahmen auch, wenn dort schon etwas eingetragen ist) */
const R_IDS = ["r_weg", "r_leitung", "r_wohnrecht", "r_niess", "r_erbbau", "r_vorkauf", "r_reallast", "r_ueberbau", "r_baulast", "r_nichteingetragen", "r_sanierung", "r_denkmal", "r_bindung", "r_sonst"];
const M_IDS = ["m_feucht", "m_schimmel", "m_risse", "m_undicht", "m_holz", "m_sonst"];
const SCH_IDS = ["sch_asbest", "sch_kmf", "sch_holz", "sch_pak", "sch_blei", "sch_boden", "sch_sonst"];
const anyYN = (d, ids) => ids.some(id => d[id] && (d[id].v || d[id].n));
const master = (id, ids) => d => d[id] === "ja" || (!d[id] && anyYN(d, ids));
const rDetails = master("r_any", R_IDS), mDetails = master("m_any", M_IDS), schDetails = master("sch_any", SCH_IDS);
const zurueck = d => d.stichtag_art === "zurückliegend (z. B. Todestag)";

/* Vorgesehene Verfahren je Objektart (erste Angabe wird vorausgewählt) */
const VERFAHREN = d =>
  is(d, "HAUS") || is(d, "FREIZEIT") ? ["Sachwertverfahren", "Vergleichswertverfahren"] :
  is(d, "ZFH") ? ["Sachwertverfahren", "Vergleichswertverfahren", "Ertragswertverfahren"] :
  is(d, "ETW") ? ["Vergleichswertverfahren", "Ertragswertverfahren"] :
  is(d, "ERTRAG") ? ["Ertragswertverfahren", "Vergleichswertverfahren", "Sachwertverfahren"] :
  is(d, "UNBEBAUT") ? ["Vergleichswertverfahren (Bodenwert)"] :
  ["Vergleichswertverfahren", "Ertragswertverfahren", "Sachwertverfahren"];

const WHEN_SECTION = {
  s6: bebaut, s7: d => only(d, "ETW"), s8: bebaut, s9: bebaut, s11: bebaut,
  s12: d => bebaut(d) || has(d, "ob_art", "Land- / Forstwirtschaft")
};
const WHEN_FIELD = {
  stichtag: zurueck, qualstichtag: zurueck, stichtag_hint: d => !zurueck(d),
  r_hint: rDetails, etw_hint: d => !known(d),
  bj_zeitraum: d => !d.bj,
  mod: d => !has(d, "zustand", "Neubau / neuwertig"), mod_h: d => !has(d, "zustand", "Neubau / neuwertig"),
  eig_name: d => !has(d, "ag_rolle", "Eigentümer/in"),
  eig_anteile: d => !d.eig_verh || ["Miteigentum nach Bruchteilen", "Eheleute / Lebenspartner", "Erbengemeinschaft", "Gesellschaft (GbR, GmbH …)"].includes(d.eig_verh),
  ...Object.fromEntries(R_IDS.map(id => [id, rDetails])),
  ...Object.fromEntries(M_IDS.map(id => [id, mDetails])),
  r_berechtigt: d => rDetails(d) && (ja(d, "r_wohnrecht") || ja(d, "r_niess")),
  r_gebjahr: d => rDetails(d) && (ja(d, "r_wohnrecht") || ja(d, "r_niess")),
  r_entgelt: d => rDetails(d) && (ja(d, "r_wohnrecht") || ja(d, "r_niess")),
  r_erbbauzins: d => rDetails(d) && ja(d, "r_erbbau"), r_erbbauende: d => rDetails(d) && ja(d, "r_erbbau"),
  r_gebeigentum: d => not(d, "ETW"), r_schuldr: d => not(d, "ETW", "ERTRAG"),
  gr_zuschnitt: d => not(d, "ETW"), gr_topo: d => not(d, "ETW"), gr_teilflaechen: d => not(d, "ETW"),
  l_bebauung: d => not(d, "ETW"), l_wasser: d => not(d, "ETW"),
  fertighaus: d => has(d, "bauweise", "Fertighaus"),
  dachform: d => not(d, "ETW"), dacheindeckung: d => not(d, "ETW"),
  we: d => not(d, "HAUS"), ge: d => not(d, "HAUS", "ZFH", "ETW"),
  einlieger: d => is(d, "HAUS"),
  gfl: d => not(d, "HAUS", "ZFH", "ETW"),
  keller: d => not(d, "ETW"), kellernutzung: d => not(d, "ETW"), dg: d => not(d, "ETW"),
  bg_vorhanden: d => not(d, "ETW"),
  kernsaniert_jahr: d => has(d, "zustand", "kernsaniert"),
  energie: bebaut, heizsystem: bebaut, waermevert: bebaut, wz_bj: bebaut, wz_typ: bebaut, ww: bebaut, pv: bebaut,
  pv_kwp: d => bebaut(d) && (d.pv || []).length > 0, pv_bj: d => bebaut(d) && (d.pv || []).length > 0,
  pv_speicher: d => bebaut(d) && has(d, "pv", "Batteriespeicher"), pv_eigentum: d => bebaut(d) && has(d, "pv", "Photovoltaik"),
  ea_art: bebaut, ea_klasse: bebaut, ea_kwh: bebaut, ea_ausgestellt: bebaut, ea_gueltig: bebaut,
  er_tank: d => bebaut(d) && not(d, "ETW"),
  leer_seit: d => has(d, "nutzung", "leerstehend"),
  mieten: mietrelevant, v_erhoehung: mietrelevant, v_rueckstand: mietrelevant, v_kuendigung: mietrelevant,
  bk_verw: mietrelevant, bk_inst: mietrelevant, bk_sonst: mietrelevant,
  sch_asbest: d => bebaut(d) && schDetails(d), sch_kmf: d => bebaut(d) && schDetails(d), sch_holz: d => bebaut(d) && schDetails(d),
  sch_pak: d => bebaut(d) && schDetails(d), sch_blei: d => bebaut(d) && schDetails(d), sch_sonst: d => bebaut(d) && schDetails(d), sch_boden: schDetails
};
const WHEN_HEAD = {
  "Photovoltaik, Speicher, Wallbox": bebaut, "Energieausweis": bebaut,
  "Miet- und Nutzungseinheiten": mietrelevant, "Nicht umlagefähige Kosten": mietrelevant
};
const OPTIONS = {
  verfahren: VERFAHREN,
  ot_besichtigt: d => bebaut(d) ? ["alle Wohn- und Nutzräume", "Keller", "Dachboden / Spitzboden", "Heizung / Technik", "Nebengebäude / Garage", "Außenanlagen"] : ["Grundstück", "Aufwuchs / Außenanlagen", "Zufahrt / Umgebung"]
};
/* Unterlagen: gleiche Reihenfolge wie in Abschnitt 17 (null = immer) */
const DOC_WHEN = [null, null, null, bebaut, bebaut, bebaut, bebaut, null, bebaut, bebaut, null, bebaut, null,
  mietrelevant, d => ja(d, "r_erbbau"), d => only(d, "ETW"), d => only(d, "ETW"), d => only(d, "ERTRAG")];

/* Übersicht: Abschnitte in der Reihenfolge, in der sie meist bearbeitet werden ("F" = Fotos) */
const PHASES = [
  { t: "Vorbereitung im Büro", s: ["s1", "s2", "s3", "s4", "s17", "D"] },
  { t: "Ortstermin", s: ["s16", "s5", "s6", "s7", "s8", "s9", "s10", "s11", "s12", "s13", "F"] },
  { t: "Nachbereitung", s: ["s14", "s15", "s18"] }
];

/* =====================================================================
   VERKAUFS-FRAGEBOGEN FÜR EIGENTÜMER (Kundenzugang)
   Einfache Sprache; Felder mit gleicher Kennung wie im Aufnahmebogen
   (z. B. ob_art, nutzung, mod) lassen sich vom SV per Knopf übernehmen.
   ===================================================================== */
const RATE = (id, l, ex, words) => ({ t: "rate", id, l, o: (words || ["Sehr hochwertig", "Hochwertig", "Durchschnittlich", "Einfach", "Sehr einfach"]).map((w, i) => [w, ex[i]]) });
const GOOD = ["Sehr gut", "Gut", "Durchschnittlich", "Schlecht", "Sehr schlecht"];
const KSECTIONS = [
 { id: "k0", n: "1", t: "Über Sie", f: [
  { t: "hint", l: "Bitte füllen Sie aus, was Sie wissen. Felder, die Sie nicht kennen, lassen Sie einfach leer – wir klären das gemeinsam. Je vollständiger Ihre Angaben, desto genauer unser Ergebnis." },
  T("k_name", "Name, Vorname", { full: 1 }), T("k_anschrift", "Ihre Anschrift (falls abweichend vom Objekt)", { full: 1 }),
  T("k_tel", "Telefon", { type: "tel" }), T("k_mail", "E-Mail", { type: "email" }),
  { t: "single", id: "k_eigentum", l: "Wem gehört die Immobilie?", o: ["mir allein", "Ehepaar / Lebenspartner", "mehreren Personen (Miteigentum / Bruchteil)", "einer Erbengemeinschaft", "einer Firma"] },
  { t: "single", id: "k_vertretung", l: "Sie handeln als", o: ["Eigentümer/in", "Bevollmächtigte(r) / Vertretung"] },
  { t: "area", id: "k_eigentuemer", l: "Weitere Eigentümer (Name, Anteil)" },
  { t: "single", id: "k_auftrag", l: "Worum geht es?", o: ["Verkauf", "Wertermittlung / Gutachten", "Vermietung / Verpachtung"] } ] },
 { id: "k1", n: "2", t: "Ihre Immobilie", f: [
  { t: "single", id: "ob_art", l: "Um welche Art von Immobilie geht es?", o: ["Einfamilienhaus", "Zweifamilienhaus", "Doppelhaushälfte", "Reihenmittelhaus", "Reihenendhaus", "Mehrfamilienhaus", "Eigentumswohnung", "Wohn- und Geschäftshaus", "Gewerbe / Büro", "Bauland / unbebaut", "Wochenend- / Erholungsgrundstück", "Land- / Forstwirtschaft", "Sonstiges"] },
  T("ob_str", "Straße, Hausnummer", { full: 1 }), T("ob_plz", "PLZ", { num: 1 }), T("ob_ort", "Ort / Ortsteil"),
  T("k_bj", "Baujahr (falls bekannt)", { num: 1 }),
  { t: "single", id: "k_bj_zeit", l: "Baujahr unbekannt? Dann bitte einen Zeitraum wählen", o: ["vor 1900", "1901 – 1930", "1931 – 1947", "1948 – 1967", "1968 – 1980", "1981 – 1990", "1991 – 2010", "nach 2010"] },
  { t: "single", id: "k_denkmal", l: "Steht das Gebäude unter Denkmalschutz?", o: ["nein", "ja", "weiß ich nicht"] },
  { t: "h", l: "Flächen und Räume" },
  T("k_wfl", "Wohnfläche ca. (m²)", { num: 1 }), T("k_nfl", "Nutzfläche ca. (m², Keller, Lager etc.)", { num: 1 }), T("k_grund", "Grundstücksgröße ca. (m²)", { num: 1 }),
  { t: "single", id: "k_wfl_basis", l: "Woher stammt die Wohnfläche?", o: ["Wohnflächenverordnung (WoFlV)", "DIN 277", "II. Berechnungsverordnung", "selbst ausgemessen", "weiß ich nicht"] },
  T("k_zimmer", "Anzahl Zimmer", { num: 1 }), T("k_baeder", "Anzahl Bäder", { num: 1 }), T("k_geschosse", "Anzahl Geschosse", { num: 1 }),
  T("k_we", "Anzahl Wohneinheiten", { num: 1 }), T("k_etage", "Etage der Wohnung"),
  { t: "single", id: "k_keller", l: "Keller", o: ["voll unterkellert", "teilweise unterkellert", "kein Keller", "Kellerraum (Wohnung)"] },
  { t: "single", id: "k_kellerart", l: "Wie ist der Keller?", o: ["normaler Nutzkeller (wie zum Baujahr üblich)", "teilweise ausgebaut, hochwertig nutzbar", "eingeschränkt nutzbar (Feuchtigkeit / Schimmel)"] },
  { t: "single", id: "k_dg", l: "Dachgeschoss", o: ["ausgebaut", "teilausgebaut", "nicht ausgebaut, aber ausbaufähig", "nicht ausbaufähig / Flachdach"] },
  { t: "multi", id: "k_park", l: "Parken", o: ["Garage", "Doppelgarage", "Carport", "Stellplatz im Freien", "Tiefgarage", "keiner"] },
  T("k_park_anz", "Anzahl (z. B. 1 Garage, 2 Stellplätze)", { full: 1 }),
  { t: "multi", id: "k_extra", l: "Was ist vorhanden?", o: ["Balkon / Loggia", "Terrasse", "Garten", "Wintergarten", "Einbauküche", "Kamin / Kachelofen", "Sauna", "Swimmingpool", "Gäste-WC", "Aufzug", "barrierearm", "Nebengebäude / Gartenhaus", "Brunnen"] },
  { t: "area", id: "k_extra_info", l: "Baujahr und ungefähre Herstellungskosten (z. B. Einbauküche 2019, ca. 12.000 €; Pool 2015, ca. 25.000 €)" } ] },
 { id: "k2", n: "3", t: "Zustand & Modernisierung", f: [
  { t: "single", id: "k_sanierung", l: "Welche Beschreibung passt am besten?", o: ["Neubau", "umfassend saniert und instand gesetzt", "teilsaniert und renoviert", "im Zustand des Baujahres"] },
  { t: "single", id: "k_zustand", l: "Wie würden Sie den Zustand beschreiben?", o: ["neu / neuwertig", "gepflegt", "teilweise renoviert", "renovierungsbedürftig", "sanierungsbedürftig"] },
  { t: "hint", l: "Was wurde wann erneuert? Ungefähre Jahre genügen." },
  { t: "modern", id: "mod", rows: ["Dach inkl. Wärmedämmung", "Fenster und Außentüren", "Leitungen (Strom, Gas, Wasser, Abwasser)", "Heizungsanlage", "Wärmedämmung Außenwände / Fassade", "Bäder / Sanitäranlagen", "Innenausbau (Decken, Böden, Türen, Treppen)", "Wesentliche Grundrissverbesserung", "Sonstiges"] },
  { t: "multi", id: "k_schad", l: "Sind Schadstoffe bekannt? (soweit bekannt)", o: ["Asbest (z. B. Dach, Fassade, Boden)", "Künstliche Mineralfasern (KMF)", "Holzschutzmittel (z. B. PCP, Lindan)", "Sonstige", "keine bekannt"] },
  { t: "area", id: "k_schad_text", l: "Ergänzung zu Schadstoffen" },
  { t: "area", id: "k_maengel", l: "Gibt es Mängel oder Schäden, die Sie kennen? (z. B. Feuchtigkeit, Risse, undichtes Dach)" } ] },
 { id: "k8", n: "4", t: "Ausstattung & Lage", f: [
  { t: "hint", l: "Wählen Sie je Bereich die Beschreibung, die am ehesten passt. Die Beispiele dienen nur zur Orientierung." },
  RATE("k_r_bau", "Mauerwerk & Dach", ["z. B. Massivbau, aufwändige Fassade mit Zierelementen, hochwertige Dachpfannen", "z. B. Massivbau oder Skelettbau mit hochwertiger Fassade (z. B. Vollwärmeschutz)", "z. B. Massivbau, Beton- oder Tondachpfannen, gut verputzt", "z. B. Fertigbau oder Massivbau mit einfachem Putz, Betondachpfannen", "z. B. einfacher Fertigbau oder veralteter Massivbau, Bitumen- oder Asbestdach"]),
  RATE("k_r_daemm", "Dämmung", ["z. B. sehr hochwertige Dämmung von Wänden und Dach", "z. B. zusätzliche Dach- oder Wanddämmung", "z. B. baujahrestypische Dachdämmung, keine zusätzliche Dämmung", "z. B. keine zusätzliche Dämmung, einfach gedämmtes Dach", "z. B. ungedämmtes Dach, dünnes Mauerwerk (unter 36,5 cm)"]),
  RATE("k_r_fenster", "Fenster & Außentüren", ["z. B. Dreifachverglasung oder Wärmeschutzglas mit Sonnenschutz", "z. B. Kunststofffenster mit Isolierverglasung", "z. B. Holzfenster mit Isolierverglasung", "z. B. einfache Holzfenster, Doppelfenster", "z. B. veraltete Holzfenster mit Einfachverglasung"]),
  RATE("k_r_tueren", "Innentüren", ["z. B. Massivholz oder Ganzglas", "z. B. holz- oder kunststofffurniert, hochwertig", "z. B. Standardtüren, teils mit Glaseinsatz, Holzzarge", "z. B. einfache Türen, Stahlzarge", "z. B. minderwertige Innentüren"]),
  RATE("k_r_wand", "Wandbeläge", ["z. B. Naturstein (Marmor)", "z. B. teilweise Natur- oder Kunststein, Bad & WC gefliest", "z. B. Bad und WC gefliest, Wohnräume tapeziert oder gespachtelt", "z. B. Fliesen nur an der Sanitärinstallation", "z. B. Wände nur verputzt"]),
  RATE("k_r_boden", "Bodenbeläge", ["z. B. Naturstein oder hochwertiges Parkett", "z. B. teilweise Naturstein, Parkett oder Vinyl", "z. B. Fliesen oder Teppich, teilweise Parkett oder Vinyl", "z. B. Fliesen, Teppich oder Laminat", "z. B. PVC, einfacher Teppich oder Linoleum"]),
  RATE("k_r_sanitaer", "Sanitär (Bad, WC)", ["z. B. Naturstein, ebenerdige Dusche, besondere Ausstattung", "z. B. moderne Ausstattung, hochwertige Dusche und Waschtisch", "z. B. Standardausführung, zweckmäßige Wanne und Waschbecken", "z. B. Leitungen unter Putz, veraltete oder einfache Ausstattung", "z. B. Leitungen auf Putz, veraltete Ausstattung"]),
  RATE("k_r_heizung", "Heizung", ["z. B. moderne Technik mit Erdwärme, Pellets oder Solar, Fußbodenheizung", "z. B. moderne Öl- oder Gasheizung, Fußbodenheizung", "z. B. Öl-/Gasheizung mit Standardbrenner, Plattenheizkörper", "z. B. einfache Ölheizung, Stahlradiatoren", "z. B. Einzelöfen, Nachtspeicheröfen"]),
  RATE("k_r_elektro", "Elektroinstallation", ["z. B. hochwertige Verkabelung, Netzwerk / Smart Home", "z. B. hochwertige Schalter und Dosen, eingebaute Leuchten", "z. B. Leitungen unter Putz, Kupferkabel", "z. B. nur in Wohnräumen unter Putz, Aluminiumkabel", "z. B. Leitungen großteils auf Putz, Aluminiumkabel"]),
  RATE("k_r_raum", "Raumaufteilung / -zuschnitt", ["z. B. sehr großzügige Raumaufteilung", "z. B. große, gut geschnittene Räume", "z. B. Räume normaler Größe, üblicher Zuschnitt", "z. B. kleine oder ungünstig geschnittene Räume, Durchgangszimmer", "z. B. sehr kleine Räume, teils nicht nutzbar"], GOOD),
  RATE("k_r_licht", "Besonnung / Belichtung", ["z. B. sehr helle Räume, große Fensterflächen", "z. B. helle Räume", "z. B. weder besonders hell noch dunkel", "z. B. dunkle Räume", "z. B. sehr dunkle Räume, teils ohne Fenster"], GOOD),
  RATE("k_r_aussicht", "Aussicht", ["z. B. Wald- oder Seeblick", "z. B. Blick ins Grüne oder aus dem Dachgeschoss", "z. B. typisch für Lage und Umgebung", "z. B. auf unattraktive Nachbarbebauung", "z. B. auf Industrie oder Autobahn"], ["Besonders attraktiv", "Attraktiv", "Durchschnittlich", "Unattraktiv", "Besonders unattraktiv"]),
  RATE("k_r_lage", "Lage / Ruhe", ["z. B. am Waldrand oder in Alleinlage", "z. B. Sackgasse oder verkehrsberuhigte Straße", "z. B. entsprechend der Wohnumgebung", "z. B. durch Straßenverkehr belastet", "z. B. starker Verkehr oder Industrie"], ["Besonders ruhig", "Ruhig", "Durchschnittlich", "Belastet", "Besonders belastet"]) ] },
 { id: "k3", n: "5", t: "Heizung, Energie & Anschlüsse", f: [
  { t: "multi", id: "energie", l: "Womit wird geheizt?", o: ["Erdgas", "Heizöl", "Flüssiggas", "Wärmepumpe", "Fernwärme", "Pellets / Holz", "Strom (Nachtspeicher)", "Solarthermie", "Sonstiges"] },
  T("k_heiz_bj", "Baujahr der Heizung (ca.)", { num: 1 }), T("k_heiz_typ", "Typ / Fabrikat der Heizung"),
  { t: "single", id: "er_tank", l: "Brennstofftank", o: ["keiner", "oberirdisch / Keller", "Erdtank (auch stillgelegt)"] },
  { t: "multi", id: "pv", l: "Vorhanden", o: ["Photovoltaik", "Batteriespeicher", "Wallbox"] },
  T("pv_bj", "Baujahr Photovoltaik", { num: 1 }), T("pv_kwp", "Leistung (kWp)", { num: 1 }),
  { t: "single", id: "pv_eigentum", l: "Die Photovoltaik-Anlage ist", o: ["Eigentum", "gepachtet / gemietet", "geleast"] },
  { t: "multi", id: "k_pv_info", l: "Außerdem", o: ["noch finanziert", "Einspeisevertrag vorhanden"] },
  { t: "single", id: "ea_art", l: "Energieausweis", o: ["Bedarfsausweis", "Verbrauchsausweis", "nicht vorhanden"] },
  { t: "h", l: "Anschlüsse" },
  { t: "single", id: "er_wasser", l: "Trinkwasser", o: ["öffentliches Netz", "eigener Brunnen", "beides"] },
  { t: "single", id: "er_abwasser", l: "Abwasser", o: ["öffentlicher Kanal", "Kleinkläranlage", "abflusslose Sammelgrube"] },
  { t: "single", id: "er_strom", l: "Strom", o: ["angeschlossen", "anliegend", "nicht vorhanden"] },
  { t: "single", id: "er_gas", l: "Gasnetz", o: ["angeschlossen", "anliegend", "nicht vorhanden"] },
  { t: "single", id: "er_internet", l: "Internet", o: ["Glasfaser", "VDSL / Kabel", "langsames DSL / keiner"] } ] },
 { id: "k4", n: "6", t: "Nutzung & Kosten", f: [
  { t: "multi", id: "nutzung", l: "Wie wird die Immobilie genutzt?", o: ["eigengenutzt", "teilweise vermietet", "vollständig vermietet", "verpachtet", "leerstehend"] },
  { t: "area", id: "k_mieter", l: "Mietverhältnisse (Wohnung/Einheit, Kaltmiete, seit wann)" },
  T("k_miete", "Ist-Miete gesamt (€/Monat, kalt)", { num: 1 }), T("k_miete_soll", "Soll-Miete / erzielbare Miete (€/Monat, kalt)", { num: 1 }),
  T("k_hausgeld", "Hausgeld (€/Monat)", { num: 1 }), T("k_ruecklage", "davon Rücklage (€/Monat)", { num: 1 }),
  T("k_grundsteuer", "Grundsteuer (€/Jahr)", { num: 1 }), T("k_nk", "Nebenkosten ca. (€/Monat)", { num: 1 }) ] },
 { id: "k5", n: "7", t: "Grundbuch & Rechtliches", f: [
  { t: "h", l: "Grundbuch und Kataster (steht im Grundbuchauszug)" },
  T("k_gemarkung", "Gemarkung"), T("k_blatt", "Grundbuchblatt"), T("k_flur", "Flur"), T("k_flurstueck", "Flurstück(e)"),
  { t: "h", l: "Rechte und Genehmigungen" },
  { t: "single", id: "k_rechte", l: "Gibt es Rechte oder Lasten? (z. B. Wegerecht, Wohnrecht, Erbbaurecht, Baulasten)", o: ["nein", "ja", "weiß ich nicht"] },
  { t: "area", id: "k_rechte_text", l: "Welche? (kurz beschreiben)" },
  { t: "single", id: "k_genehmigt", l: "Sind alle Gebäude und Anbauten genehmigt?", o: ["ja", "nein / teilweise", "weiß ich nicht"] } ] },
 { id: "k6", n: "8", t: "Ihre Wünsche & Besichtigung", f: [
  { t: "single", id: "k_frei", l: "Ab wann ist die Immobilie frei?", o: ["sofort", "nach Vereinbarung", "zu einem bestimmten Datum", "bleibt vermietet"] },
  T("k_frei_datum", "Frei ab", { type: "date" }),
  T("k_preis", "Ihre Preisvorstellung (€)", { num: 1 }),
  T("k_mietwunsch", "Ihre Mietvorstellung (€/Monat, kalt)", { num: 1 }),
  T("k_besicht", "Wann sind Besichtigungen möglich?", { full: 1 }),
  { t: "area", id: "k_plus", l: "Was gefällt Ihnen besonders an Ihrer Immobilie?" },
  { t: "area", id: "k_hinweise", l: "Platz für Ihre Notizen oder Fragen" } ] },
 { id: "k7", n: "9", t: "Unterlagen-Liste", f: [
  { t: "hint", l: "Kreuzen Sie an, was Sie haben. Fehlende Unterlagen besorgen wir gern für Sie." },
  { t: "docs", id: "docs", rows: ["Grundbuchauszug", "Flurkarte", "Energieausweis", "Grundrisse / Bauzeichnungen", "Wohnflächenberechnung", "Baubeschreibung", "Baugenehmigung", "Teilungserklärung", "Wirtschaftsplan / Hausgeldabrechnung", "Protokolle Eigentümerversammlungen", "Mietverträge", "Grundsteuerbescheid", "Gebäudeversicherung", "Rechnungen zu Modernisierungen", "Sonstiges", "Baulastenauszug", "Vorhandene Gutachten", "Nebenkostenaufstellung", "Prüfberichte Heizung / Schornsteinfeger", "Prüfbericht Trinkwasser / Legionellen"], order: [0, 1, 2, 3, 4, 5, 6, 15, 7, 8, 9, 10, 17, 11, 12, 13, 16, 18, 19, 14], o: ["habe ich", "besorge ich", "nicht vorhanden", "bitte für mich besorgen"] } ] },
 { id: "k9", n: "10", t: "Beschreibung & Unterschrift", f: [
  { t: "area", id: "k_beschreibung", l: "Beschreiben Sie Ihre Immobilie in eigenen Worten – was macht sie aus? Besonderheiten, Lage, Nachbarschaft, bekannte Mängel (gern stichpunktartig)", big: 1 },
  { t: "hint", l: "Datenschutz: Ihre Angaben verarbeiten wir ausschließlich zur Durchführung des Makler- bzw. Bewertungsauftrags (Art. 6 Abs. 1 lit. b DSGVO). Eine Weitergabe an Dritte, etwa an finanzierende Banken, erfolgt nur, soweit dies zur Auftragserfüllung erforderlich ist oder Sie eingewilligt haben. Einzelheiten und Ihre Rechte: Datenschutzerklärung auf www.immobilien-neuruppin.de." },
  { t: "sign", id: "k_sign", l: "Ich bestätige, dass meine Angaben der Wahrheit entsprechen und nach bestem Wissen und Gewissen gemacht wurden." },
  T("k_sign_ort", "Ort (das Datum wird beim Unterschreiben automatisch gespeichert)", { full: 1 }) ] }
];
const KPHASES = [
  { t: "Über Sie", s: ["k0"] },
  { t: "Ihre Immobilie", s: ["k1", "k2", "k8", "k3", "k4", "k5"] },
  { t: "Ihre Wünsche", s: ["k6"] },
  { t: "Fotos & Unterlagen", s: ["F", "D", "k7"] },
  { t: "Abschluss", s: ["k9"] }
];
const verkauf = d => d.k_auftrag !== "Vermietung / Verpachtung" && d.k_auftrag !== "Wertermittlung / Gutachten";
const kKeller = d => ["voll unterkellert", "teilweise unterkellert", "Kellerraum (Wohnung)"].includes(d.k_keller);
const K_WHEN = {
  k_etage: d => only(d, "ETW"), k_grund: d => not(d, "ETW"), k_dg: d => not(d, "ETW", "UNBEBAUT"),
  k_keller: d => not(d, "UNBEBAUT"), k_kellerart: d => not(d, "UNBEBAUT") && kKeller(d),
  k_zimmer: d => not(d, "UNBEBAUT"), k_baeder: d => not(d, "UNBEBAUT"), k_wfl: d => not(d, "UNBEBAUT"), k_nfl: d => not(d, "UNBEBAUT"), k_wfl_basis: d => not(d, "UNBEBAUT"),
  k_bj: d => not(d, "UNBEBAUT"), k_bj_zeit: d => not(d, "UNBEBAUT") && !d.k_bj, k_denkmal: d => not(d, "UNBEBAUT"),
  k_geschosse: d => not(d, "UNBEBAUT"), k_we: d => not(d, "ETW", "UNBEBAUT"),
  k_extra: d => not(d, "UNBEBAUT"), k_extra_info: d => not(d, "UNBEBAUT") && (d.k_extra || []).length > 0,
  k_park_anz: d => (d.k_park || []).some(x => x !== "keiner"),
  k_schad_text: d => (d.k_schad || []).some(x => x !== "keine bekannt"),
  energie: bebaut, k_heiz_bj: bebaut, k_heiz_typ: bebaut, er_tank: bebaut, pv: bebaut, ea_art: bebaut,
  pv_bj: d => (d.pv || []).includes("Photovoltaik"), pv_kwp: d => (d.pv || []).includes("Photovoltaik"),
  pv_eigentum: d => (d.pv || []).includes("Photovoltaik"), k_pv_info: d => (d.pv || []).includes("Photovoltaik"),
  k_mieter: vermietet, k_miete: vermietet, k_miete_soll: d => vermietet(d) || d.k_auftrag === "Vermietung / Verpachtung",
  k_hausgeld: d => only(d, "ETW"), k_ruecklage: d => only(d, "ETW"),
  k_rechte_text: d => d.k_rechte === "ja",
  k_eigentuemer: d => !!d.k_eigentum && d.k_eigentum !== "mir allein",
  k_frei_datum: d => d.k_frei === "zu einem bestimmten Datum",
  k_preis: verkauf, k_mietwunsch: d => d.k_auftrag === "Vermietung / Verpachtung"
};
["k_r_bau", "k_r_daemm", "k_r_fenster", "k_r_tueren", "k_r_wand", "k_r_boden", "k_r_sanitaer", "k_r_heizung", "k_r_elektro", "k_r_raum", "k_r_licht"].forEach(k => { K_WHEN[k] = bebaut; });
const K_WHEN_SECTION = { k2: bebaut };
const K_DOC_WHEN = [null, null, bebaut, bebaut, bebaut, bebaut, bebaut, d => only(d, "ETW"), d => only(d, "ETW"), d => only(d, "ETW"), vermietet, null, bebaut, bebaut, null, null, null, d => vermietet(d) || only(d, "ETW"), bebaut, d => only(d, "ERTRAG")];
["k_rechte", "k_eigentum", "k_frei", "k_auftrag", "k_keller", "k_park", "k_schad", "k_extra"].forEach(k => DEPENDS.add(k));
KSECTIONS.forEach(sec => {
  if (K_WHEN_SECTION[sec.id]) sec.when = K_WHEN_SECTION[sec.id];
  sec.f.forEach(f => { if (f.id && K_WHEN[f.id]) f.when = K_WHEN[f.id]; if (f.t === "docs") f.rowWhen = K_DOC_WHEN; });
});
/* Übernahme Eigentümer-Angaben → Aufnahmebogen (nur in leere Felder) */
const K_TO_SV = { ob_art: "ob_art", ob_str: "ob_str", ob_plz: "ob_plz", ob_ort: "ob_ort", k_bj: "bj", k_wfl: "wfl", k_nfl: "nfl", k_grund: "gr_flaeche", k_zimmer: "zimmer", k_baeder: "baeder",
  k_geschosse: "geschosse", k_we: "we", energie: "energie", k_heiz_bj: "wz_bj", k_heiz_typ: "wz_typ", er_tank: "er_tank", pv: "pv", pv_bj: "pv_bj", pv_kwp: "pv_kwp", pv_eigentum: "pv_eigentum",
  ea_art: "ea_art", er_wasser: "er_wasser", er_abwasser: "er_abwasser", er_strom: "er_strom", er_gas: "er_gas", er_internet: "er_internet", nutzung: "nutzung",
  k_grundsteuer: "gr_grundsteuer", k_hausgeld: "etw_hausgeld", k_ruecklage: "etw_ruecklage_mon", mod: "mod",
  k_name: "ag_name", k_tel: "ag_tel", k_mail: "ag_mail", k_gemarkung: "gb_gem", k_blatt: "gb_blatt", k_flur: "gb_flur", k_flurstueck: "gb_flst" };
/* Übernahmen mit Umrechnung (Wert des Eigentümers → Wert im Aufnahmebogen) */
const RATE_LV = { "Sehr hochwertig": 5, "Hochwertig": 4, "Durchschnittlich": 3, "Einfach": 2, "Sehr einfach": 1 };
const K_CONV = {
  k_keller: ["keller", v => ({ "voll unterkellert": "voll unterkellert", "teilweise unterkellert": "teilunterkellert", "kein Keller": "nicht unterkellert" })[v]],
  k_kellerart: ["kellernutzung", v => ["einfacher Nutzkeller", "teilweise ausgebaut", "feucht / eingeschränkt nutzbar"][["normaler Nutzkeller (wie zum Baujahr üblich)", "teilweise ausgebaut, hochwertig nutzbar", "eingeschränkt nutzbar (Feuchtigkeit / Schimmel)"].indexOf(v)]],
  k_dg: ["dg", v => ({ "ausgebaut": "ausgebaut", "teilausgebaut": "teilausgebaut", "nicht ausgebaut, aber ausbaufähig": "nicht ausgebaut, ausbaufähig", "nicht ausbaufähig / Flachdach": "nicht ausbaufähig / Flachdach" })[v]],
  k_eigentum: ["eig_verh", v => ({ "mir allein": "Alleineigentum", "Ehepaar / Lebenspartner": "Eheleute / Lebenspartner", "mehreren Personen (Miteigentum / Bruchteil)": "Miteigentum nach Bruchteilen", "einer Erbengemeinschaft": "Erbengemeinschaft", "einer Firma": "Gesellschaft (GbR, GmbH …)" })[v]],
  k_vertretung: ["ag_rolle", v => v === "Bevollmächtigte(r) / Vertretung" ? "Bevollmächtigte(r) / Betreuer(in)" : "Eigentümer/in"],
  k_denkmal: ["r_denkmal", v => v === "ja" ? { v: "Ja" } : v === "nein" ? { v: "Nein" } : undefined],
  k_r_bau: [["st_wand", "st_dach"], v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined],
  k_r_fenster: ["st_fenster", v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined],
  k_r_tueren: ["st_innen", v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined],
  k_r_boden: ["st_boden", v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined],
  k_r_sanitaer: ["st_sanitaer", v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined],
  k_r_heizung: ["st_heizung", v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined],
  k_r_elektro: ["st_elektro", v => RATE_LV[v] ? { lv: [RATE_LV[v]] } : undefined]
};

SECTIONS.forEach(sec => {
  if (WHEN_SECTION[sec.id]) sec.when = WHEN_SECTION[sec.id];
  sec.f.forEach(f => {
    if (f.id && WHEN_FIELD[f.id]) { const w = WHEN_FIELD[f.id], prev = f.when; f.when = prev ? d => prev(d) && w(d) : w; }
    if (f.t === "h" && WHEN_HEAD[f.l]) f.when = WHEN_HEAD[f.l];
    if (f.id && OPTIONS[f.id]) f.opts = OPTIONS[f.id];
    if (f.t === "docs") f.rowWhen = DOC_WHEN;
  });
});
