# Markdown Viewer PWA

PWA installabile per visualizzare file Markdown locali in sola lettura, con indice heading, metadati YAML, pannello sorgente, ricerca nel documento e controlli rapidi di navigazione.

Versione corrente: **2.0.3**

- Installazione / demo: <https://alxsty.github.io/mdviewer/>
- Note di versione: [CHANGELOG.md](./CHANGELOG.md)

## Funzioni principali

- apertura file `.md` / `.markdown` da filesystem locale
- render Markdown centrato in un box reader fisso con scroll interno
- indice laterale generato dagli heading `h1` ... `h6`
- frontmatter YAML iniziale renderizzato come card collassabile, escluso dall’indice e dalla ricerca
- commenti HTML `<!-- ... -->` esclusi dal render Markdown, ma ancora visibili nel pannello sorgente
- numeri di linea on/off sui blocchi renderizzati
- pannello **Sorgente** con virtualizzazione, adatto a file Markdown di qualche MB
- selezione intervallo righe e copia con/senza prefisso `[numero]: `
- click su blocco renderizzato per selezionare le righe sorgente corrispondenti
- doppio click su blocco renderizzato per copiare subito il blocco
- tema chiaro/scuro
- scelta font e dimensione
- ricerca nel Markdown renderizzato con highlight, contatore `n/tot`, prev/next circolare, case sensitive e parole intere
- pulsanti floating per andare all’inizio/fine del documento
- service worker + manifest PWA
- banner di aggiornamento app quando è disponibile una nuova versione
- pulsante installazione nascosto quando l’app è già avviata come PWA
- drag & drop file Markdown
- zoom pagina disabilitato su tablet/smartphone per mantenere stabile il layout PWA

## Sintassi Markdown supportata

La PWA usa `markdown-it` con:

- CommonMark di base
- tabelle
- task list
- footnote
- link automatici
- typography
- blocchi custom `:::tip`, `:::note`, `:::warning`
- highlight dei code block tramite `highlight.js`

Per sicurezza l'HTML inline nel Markdown è disabilitato (`html: false`) e l'output viene comunque sanitizzato con `DOMPurify`.

## Frontmatter YAML

Se il file inizia con un blocco delimitato da `---`, la PWA lo interpreta come frontmatter YAML:

```yaml
---
title: "THE SILENT ARCHITECT — v7_wip_63"
series: "Cyber Seinen Nexus"
status: "Working draft"
---
```

Il blocco viene rimosso dal normale render Markdown e mostrato sopra al documento come card collassata/espandibile.

Gli heading successivi non vengono sporcati dai metadati e i numeri di riga restano quelli originali del file, quindi il pannello sorgente continua a copiare/selezionare le righe reali.

## Ricerca nel documento

Il bottone di ricerca apre una toolbar compatta stile “find”:

- ricerca attiva da almeno 3 caratteri
- default case sensitive: off
- default parole intere: off
- contatore `n/tot`
- prev/next circolare
- highlight di tutte le occorrenze
- evidenza più forte sull’occorrenza corrente

La ricerca lavora solo nel Markdown renderizzato e ignora metadati, indice, sorgente raw, toolbar e numeri di riga.

## Performance su file da qualche MB

Il parsing Markdown avviene in un Web Worker, quindi la UI principale rimane reattiva.

Il pannello sorgente usa virtualizzazione: non crea un nodo DOM per ogni riga del file, ma solo le righe visibili.

Per evitare tempi eccessivi sui file grandi, l'highlight automatico del codice viene disattivato quando il documento supera circa 1.5 MB o quando un singolo blocco codice supera circa 80 KB.

## Avvio sviluppo

```bash
npm install
npm run dev
```

Apri:

```text
http://localhost:5173
```

## Sviluppo in HTTPS locale

```bash
npm run dev:https
```

## Build produzione

```bash
npm run build
npm run preview
```

La cartella pubblicabile è:

```text
dist/
```

## Build GitHub Pages

```bash
npm run build:pages
```

La build GitHub Pages usa `base: /mdviewer/` e non genera file `.map` di produzione.

## Installazione su Android

Per installare la PWA su Android/Chrome apri:

<https://alxsty.github.io/mdviewer/>

Poi usa il prompt del browser oppure il menu Chrome:

```text
⋮ → Aggiungi a schermata Home / Installa app
```

## Uso rapido

1. Premi **Apri file**.
2. Seleziona un file Markdown.
3. Usa l'indice laterale per navigare gli heading.
4. Attiva/disattiva **123** per mostrare i numeri linea.
5. Apri il pannello **Sorgente** con il bottone `</>` per selezionare/copiare righe sorgente.
6. Apri la ricerca con il bottone lente.
7. Usa i bottoni floating per andare all’inizio/fine documento.

## Aggiornamento della PWA installata

Quando viene pubblicata una nuova build, il service worker la rileva e mostra un banner **Nuova versione disponibile**.

Premendo **Aggiorna**, la PWA attiva il nuovo service worker e ricarica la pagina una sola volta.
