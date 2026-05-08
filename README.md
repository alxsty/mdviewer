# Markdown Viewer PWA — V1.1

PWA installabile per visualizzare file Markdown locali in sola lettura.

## Funzioni incluse

- apertura file `.md` / `.markdown` da filesystem locale
- render Markdown centrato nella pagina
- indice laterale generato dagli heading `h1` ... `h6`
- frontmatter YAML iniziale renderizzato come card collassabile, escluso dall’indice heading
- click sull'indice con scroll allo heading relativo
- numeri di linea sorgente on/off sui blocchi renderizzati
- pannello righe sorgente con virtualizzazione, adatto a file di qualche MB
- selezione intervallo righe e copia con/senza prefisso `[numero:]`
- click su blocco renderizzato per selezionare le righe sorgente corrispondenti
- doppio click su blocco renderizzato per copiare subito il blocco
- tema chiaro/scuro
- scelta font e dimensione
- service worker + manifest PWA
- drag & drop file Markdown

## Sintassi Markdown supportata

La V1 usa `markdown-it` con:

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

## Performance su file da qualche MB

Il parsing Markdown avviene in un Web Worker, quindi la UI principale rimane reattiva.

Il pannello righe usa virtualizzazione: non crea un nodo DOM per ogni riga del file, ma solo le righe visibili.

Per evitare tempi folli sui file grandi, l'highlight automatico del codice viene disattivato quando il documento supera circa 1.5 MB o quando un singolo blocco codice supera circa 80 KB.

## Avvio sviluppo

```bash
npm install
npm run dev
```

Apri:

```text
http://localhost:5173
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

## Installazione su Android

Per vedere il prompt di installazione PWA, Android/Chrome richiede in pratica:

- pagina servita in HTTPS, oppure
- `localhost` durante sviluppo

Quindi per test reale su smartphone conviene pubblicare `dist/` su un hosting HTTPS, per esempio GitHub Pages, Netlify, Cloudflare Pages, un reverse proxy Caddy/Nginx con certificato, ecc.

## Uso rapido

1. Premi **Apri file**.
2. Seleziona un file Markdown.
3. Usa l'indice laterale per navigare gli heading.
4. Attiva/disattiva **Numeri linea**.
5. Apri il pannello **#** per selezionare/copiare righe sorgente.
6. Attiva **Copia con numero** per ottenere righe nel formato:

```text
[12:]contenuto della riga
```

## Note V1

- Il caricamento da URL è predisponibile come V2, ma non incluso nella V1.
- Mermaid, KaTeX/MathJax, parsing YAML completo e persistenza dell'ultimo documento in IndexedDB sono buoni candidati per la V2.
- La corrispondenza linea/blocco usa le mappe sorgente dei token Markdown. È molto utile per navigazione/copia, ma non pretende di mostrare un numero per ogni riga visuale dopo il word-wrap.
