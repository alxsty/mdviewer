# Markdown Viewer PWA

PWA installabile per visualizzare file Markdown locali in sola lettura, con indice heading, metadati YAML, pannello sorgente, ricerca nel documento e controlli rapidi di navigazione.

Versione corrente: **3.1.4**

Patch 3.1.4: il Markdown renderizzato evita il clipping del box di selezione azzurro quando una riga/blocco selezionato viene portato al bordo visibile; la X di chiusura file è stata spostata a sinistra del reader.

- Installazione stabile: <https://alxsty.github.io/mdviewer/>
- Versione dev / WIP: <https://alxsty.github.io/mdviewer/dev/>
- Note di versione: [CHANGELOG.md](./CHANGELOG.md)

## Funzioni principali

- apertura file `.md` / `.markdown` da filesystem locale
- collegamento all’ultimo file aperto tramite File System Access API, dove supportata
- al refresh/riavvio rilegge la versione corrente del file originale; se non è più disponibile resetta lo stato e mostra un messaggio
- render Markdown centrato in un box reader fisso con scroll interno
- indice laterale generato dagli heading `h1` ... `h6`
- frontmatter YAML iniziale renderizzato come card collassabile, escluso dall’indice e dalla ricerca
- commenti HTML `<!-- ... -->` esclusi dal render Markdown, ma ancora visibili nel pannello sorgente
- numeri di linea on/off sui blocchi renderizzati
- pannello **Sorgente** con virtualizzazione, adatto a file Markdown di qualche MB
- selezione intervallo righe e copia tramite template: solo riga, `[indice]: riga` o formato custom con placeholder `\riga`, `\indice`, `\n`
- click su blocco renderizzato per selezionare le righe sorgente corrispondenti
- doppio click su blocco renderizzato per copiare subito il blocco
- tema chiaro/scuro
- scelta font e dimensione
- ricerca nel Markdown renderizzato con highlight, contatore `n/tot`, prev/next circolare, case sensitive e parole intere
- pulsanti floating per andare all’inizio, alla fine o a una riga specifica del documento
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

## Template copia sorgente

Nel pannello **Sorgente** il vecchio toggle “copia con numeri” è stato sostituito da tre bottoni template accanto al comando **Copia**:

- **Solo riga** copia ogni riga come testo originale.
- **[indice]: riga** copia ogni riga nel formato `[numero]: contenuto`.
- **Custom** usa un template personale salvato dall’utente.

Nel template custom sono disponibili placeholder case sensitive:

- `\riga` = contenuto della riga
- `\indice` = numero della riga sorgente
- `\n` = newline reale

Esempio:

```text
[\indice]: \riga -->\n[\indice]: \riga
```

Sotto ai bottoni viene mostrato il template attivo: per i due preset è read-only, mentre per **Custom** diventa editabile quando non esiste ancora un template salvato oppure quando si usa la piccola matita di modifica. Il campo custom è single-line, massimo 200 caratteri, con pulsante interno di pulizia visibile solo quando contiene testo. `Esc` annulla l’editing senza salvare quando esiste un valore precedente, `Invio` salva solo un valore non vuoto. Il formato selezionato e il template custom vengono mantenuti tra una sessione e l’altra.

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

## File collegato — V3

Dove il browser supporta la File System Access API, il bottone **Apri file** usa il file picker avanzato e salva in IndexedDB un riferimento al file originale.

Al refresh o alla riapertura della PWA, l’app prova a rileggere il file originale dal dispositivo:

- se il file è ancora disponibile e il permesso di lettura è valido, viene caricata la versione corrente del file;
- se il file è stato spostato/cancellato o il permesso è stato revocato, l’app mostra un messaggio e torna allo stato “nessun file caricato”;
- non viene ripristinata automaticamente una vecchia copia cache del contenuto.

Nei browser senza File System Access API rimane disponibile il picker classico `<input type="file">`, ma dopo un refresh sarà necessario selezionare di nuovo il file.

## Aggiornamento della PWA installata

Quando viene pubblicata una nuova build, il service worker la rileva e mostra un banner **Nuova versione disponibile**.

Premendo **Aggiorna**, la PWA attiva il nuovo service worker e ricarica la pagina una sola volta.

Se nello stesso momento il file collegato richiede una nuova autorizzazione, il banner di aggiornamento ha priorità: il toast di autorizzazione viene rinviato e il controllo del file viene ripetuto dopo il reload della nuova versione.

### Icone UI

La V3 usa Google Material Symbols Rounded in modalità self-hosted: il file WOFF2 è incluso nel progetto e viene servito/cacheato dalla PWA senza dipendenze da CDN esterni.
