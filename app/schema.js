"use strict";
/* Aufbau des Aufnahmebogens – hier können Abschnitte und Fragen angepasst werden. */
const YN = (id, l) => ({ t: "yn", id, l });
const T = (id, l, o = {}) => ({ t: "text", id, l, ...o });
const H = l => ({ t: "h", l });
const SECTIONS = [
 { id: "s1", n: "1", t: "Anlass & Auftrag", f: [
  { t: "multi", id: "anlass", l: "Anlass", o: ["Verkauf", "Kauf / Kaufpreisprüfung", "Finanzierung / Beleihung", "Erbschaft / Nachlass", "Schenkung / Übertragung", "Scheidung / Vermögensaufteilung", "Steuerliche Zwecke", "Vermietung / Verpachtung", "Sonstiges"] },
  T("adressat", "Adressat / Verwendung (Bank, Finanzamt, Gericht …)", { full: 1 }),
  { t: "single", id: "stichtag_art", l: "Stichtag", o: ["aktuell (Ortstermin)", "zurückliegend (z. B. Todestag)"] },
  T("stichtag", "Wertermittlungsstichtag", { type: "date" }), T("qualstichtag", "Qualitätsstichtag", { type: "date" }),
  T("frist", "Gutachten benötigt bis", { type: "date" }), T("auftragsnr", "Auftrags-Nr."),
  { t: "multi", id: "verfahren", l: "Vorgesehene Verfahren", o: ["Vergleichswertverfahren", "Ertragswertverfahren", "Sachwertverfahren"] } ] },
 { id: "s2", n: "2", t: "Auftraggeber & Eigentum", f: [
  H("Auftraggeber/in"), T("ag_name", "Name, Vorname"), T("ag_firma", "Firma"), T("ag_str", "Straße, Hausnummer", { full: 1 }),
  T("ag_plz", "PLZ", { num: 1 }), T("ag_ort", "Ort"), T("ag_tel", "Telefon", { type: "tel" }), T("ag_mail", "E-Mail", { type: "email" }),
  { t: "single", id: "ag_rolle", l: "Auftraggeber/in ist", o: ["Eigentümer/in", "Miteigentümer/in", "Erbe / Erbin", "Bevollmächtigte(r) / Betreuer(in)", "Kaufinteressent/in", "Sonstiges"] },
  T("eig_name", "Eigentümer/in (falls abweichend)", { full: 1 }),
  { t: "single", id: "eig_verh", l: "Eigentumsverhältnis", o: ["Alleineigentum", "Miteigentum nach Bruchteilen", "Eheleute / Lebenspartner", "Erbengemeinschaft", "Gesellschaft (GbR, GmbH …)", "Wohnungs-/Teileigentum"] },
  T("eig_anteile", "Beteiligte und Anteile", { full: 1 }),
  H("Erwerb"), T("erw_jahr", "Erwerbsjahr", { num: 1 }), T("erw_art", "Art (Kauf, Erbe, Schenkung, Eigenbau)"), T("erw_preis", "Kaufpreis / Baukosten (€)", { num: 1 }) ] },
 { id: "s3", n: "3", t: "Objekt & Grundbuch", f: [
  T("ob_str", "Straße, Hausnummer", { full: 1 }), T("ob_plz", "PLZ", { num: 1 }), T("ob_ort", "Ort / Ortsteil"),
  { t: "single", id: "ob_art", l: "Objektart", o: ["Einfamilienhaus", "Zweifamilienhaus", "Doppelhaushälfte", "Reihenmittelhaus", "Reihenendhaus", "Mehrfamilienhaus", "Eigentumswohnung", "Wohn- und Geschäftshaus", "Gewerbe / Büro", "Bauland / unbebaut", "Wochenend- / Erholungsgrundstück", "Land- / Forstwirtschaft", "Sonstiges"] },
  H("Grundbuch und Kataster"), T("gb_ag", "Amtsgericht"), T("gb_von", "Grundbuch von"), T("gb_blatt", "Blatt"), T("gb_gem", "Gemarkung"),
  T("gb_flur", "Flur"), T("gb_flst", "Flurstück(e)"), T("gb_bv", "lfd. Nr. Bestandsverzeichnis") ] },
 { id: "s4", n: "4", t: "Rechte & Lasten", f: [
  { t: "hint", l: "Abteilung II, Baulastenverzeichnis und bekannte Vereinbarungen. Ja = wertrelevanter Umstand vorhanden." },
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
  YN("l_wasser", "Wassergrundstück, Seezugang, Steg"), YN("l_hochwasser", "Überschwemmungs-/Hochwasserrisikogebiet; frühere Überflutungen"),
  YN("l_laerm", "Beeinträchtigung durch Lärm, Geruch o. Ä."), YN("l_bebauung", "Weitere Bebauung / Teilung möglich oder geplant"), YN("l_beitraege", "Erschließungs- oder Anliegerbeiträge offen"),
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
  { t: "single", id: "keller", l: "Unterkellerung", o: ["voll unterkellert", "teilunterkellert", "nicht unterkellert"] },
  { t: "multi", id: "kellernutzung", l: "Keller", o: ["einfacher Nutzkeller", "teilweise ausgebaut", "feucht / eingeschränkt nutzbar"] },
  { t: "single", id: "dg", l: "Dachgeschoss", o: ["ausgebaut", "teilausgebaut", "nicht ausgebaut, ausbaufähig", "nicht ausbaufähig / Flachdach"] },
  H("Flächen"), T("wfl", "Wohnfläche (m²)", { num: 1 }), T("nfl", "Nutzfläche (m²)", { num: 1 }), T("gfl", "Gewerbe-/Bürofläche (m²)", { num: 1 }), T("bgf", "Bruttogrundfläche BGF (m²)", { num: 1 }),
  { t: "multi", id: "fl_quelle", l: "Flächenangaben beruhen auf", o: ["WoFlV / II. BV", "Bauakte", "Kaufvertrag / Teilungserklärung", "Aufmaß vor Ort", "Exposé / Schätzung", "unbekannt"] },
  H("Freisitz, Außenanlagen, Barrierefreiheit"),
  { t: "multi", id: "aussen", l: "Vorhanden", o: ["Balkon / Loggia", "Terrasse", "Wintergarten beheizt", "Wintergarten unbeheizt", "Garten", "Einfriedung / Tor", "Aufzug", "stufenlos / barrierearm", "Pool / Teich"] },
  H("Garagen und Stellplätze"),
  { t: "grid", id: "stellpl", l: "Stellplätze", cols: [["art", "Art (Garage, Carport …)", 1], ["anz", "Anzahl", 0, 1], ["bj", "Baujahr", 0, 1], ["zust", "Bauweise / Zustand", 1]] },
  H("Genehmigungen"), YN("bg_vorhanden", "Baugenehmigungen für alle Gebäude vorhanden"), YN("bg_ungenehmigt", "Nicht genehmigte An-/Umbauten oder Nutzungsänderungen") ] },
 { id: "s7", n: "7", t: "Eigentumswohnung", f: [
  { t: "hint", l: "Nur bei Wohnungs- oder Teileigentum." },
  T("etw_nr", "Nr. lt. Aufteilungsplan"), T("etw_mea", "Miteigentumsanteil (z. B. 85/1.000)"), T("etw_lage", "Geschoss / Lage im Haus"), T("etw_einheiten", "Einheiten in der Anlage", { num: 1 }),
  { t: "multi", id: "etw_snr", l: "Sondernutzungsrechte", o: ["Kellerraum", "Stellplatz / Garage", "Garten / Terrasse", "Dachboden / Abstellraum", "Sonstiges"] },
  T("etw_hausgeld", "Hausgeld gesamt (€/Monat)", { num: 1 }), T("etw_ruecklage_mon", "davon Erhaltungsrücklage (€/Monat)", { num: 1 }),
  T("etw_ruecklage", "Erhaltungsrücklage WEG gesamt (€)", { num: 1 }), T("etw_verwalter", "Hausverwaltung"),
  YN("etw_umlage", "Beschlossene Sonderumlagen / größere Maßnahmen"), YN("etw_streit", "Rechtsstreitigkeiten in der WEG") ] },
 { id: "s8", n: "8", t: "Ausstattungsstandard", f: [
  { t: "hint", l: "Standardstufen nach ImmoWertV 2021, Anlage 4. Mehrere Stufen ankreuzen, wenn Bauteile unterschiedlich ausgeführt sind." },
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
  H("Modernisierungen (ImmoWertV Anlage 2)"),
  { t: "modern", id: "mod", rows: ["Dach inkl. Wärmedämmung", "Fenster und Außentüren", "Leitungen (Strom, Gas, Wasser, Abwasser)", "Heizungsanlage", "Wärmedämmung Außenwände", "Bäder", "Innenausbau (Decken, Böden, Treppen)", "Wesentliche Grundrissverbesserung", "Sonstiges"] },
  H("Mängel und Schäden"),
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
