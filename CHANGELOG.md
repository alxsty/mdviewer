# Changelog

## 3.0.0-alpha.17

- Migliorato layout mobile del pannello Sorgente: gutter dei numeri di riga più compatto.
- Sistemato il posizionamento dei toast/banner su smartphone: non debordano più a destra e i bottoni restano cliccabili.

## 3.0.0-alpha.16

- Migliorata la visibilità del bottone Installa: resta disponibile nel browser anche quando `beforeinstallprompt` non è ancora stato ricevuto.
- Aggiunto fallback con toast quando il prompt nativo non è disponibile e Chrome mostra l’icona installazione propria.
- Stato installazione separato per scope stable/dev usando la base URL della build.

## 3.0.0-alpha.14

- Aggiornato il font Material Symbols Rounded self-hosted con subset esteso e peso 400.
- Sostituita l’icona Apri file con `file_open`, più leggibile e meno pesante.
- Sostituito il separatore testuale `→` tra i campi sorgente con icona Material `arrow_forward`.

## 3.0.0-alpha.13

- Aggiunti Google Material Symbols Rounded self-hosted come font WOFF2 locale.
- Sostituite le principali icone SVG inline con Material Symbols coerenti.
- Icone self-hosted caricate come asset dell’app e cacheate dal service worker alla prima richiesta.

## 3.0.0-alpha.12

- Rifinito lo spacing del campo “Vai alla riga”: la X di pulizia resta separata dallo spinner numerico ma con meno spazio vuoto.

## 3.0.0-alpha.11

- Corretto il layout del comando **Vai alla riga**: la X di pulizia non si sovrappone più agli spinner del campo numerico quando il campo riceve il focus.

## 3.0.0-alpha.10

- Spostata la X di pulizia del comando **Vai alla riga** dentro il campo numerico.
- Aggiunto bottone **Chiudi file** nel box Markdown per tornare allo stato “nessun file caricato”.
- La chiusura del file azzera documento, indice, sorgente, ricerca, intervallo righe e collegamento persistente IndexedDB.

## 3.0.0-alpha.9

- Uniformato lo stile dei toast di file binding allo stile del banner update.
- Aggiunto controllo del file collegato su avvio, ritorno visibile, focus, online e click sul nome file in statusbar.
- Rimosso outline nativo anche dal pannello Sorgente.
- Aggiunto comando floating “Vai alla riga” tra top e bottom.

## 3.0.0-alpha.8

- Corretto glitch grafico del focus sul box Markdown: il reader mantiene il focus per le scorciatoie da tastiera, ma non mostra più il bordo bianco/outline nativo del browser.

## 3.0.0-alpha.7

- Rimosso il controllo periodico ogni 60 secondi degli aggiornamenti PWA.
- Mantenuti i controlli update su avvio, ritorno in visibilità, focus finestra e ritorno online.
- Nessuna modifica alla logica di file binding.

## 3.0.0-alpha.6

- Aggiunto controllo periodico degli aggiornamenti del service worker mentre la PWA resta aperta.
- Aggiunto controllo update al ritorno in foreground, al focus della finestra e al ritorno online.
- Pulito il pacchetto sorgente: esclusi `node_modules/` e `dist/` dallo zip distribuito.

## 3.0.0-alpha.5

- Sostituita la dicitura testuale `collegato` nella statusbar con una icona link compatta accanto al nome file.
- Nessuna modifica alla logica di file binding.

## 3.0.0-alpha.4

- Corretto il ripristino del file collegato dopo un aggiornamento PWA: se il browser richiede di nuovo l'autorizzazione, il collegamento non viene più cancellato automaticamente.
- Aggiunto toast con azione **Autorizza/Riprova** per rilanciare il ripristino del file collegato da un gesto utente.
- Il binding viene azzerato solo quando il file originale risulta non più disponibile.

## 3.0.0-alpha.2

- Aggiunto toast visibile quando il file collegato non è più disponibile al ripristino.
- Separata la statusbar in messaggi a sinistra e nome file a destra.
- Aggiunto stato file "collegato" nella sezione destra della statusbar.
- Aggiunta scorciatoia Ctrl/Cmd+C nelle aree Markdown e Sorgente per copiare l'intervallo Da/A corrente.

## 3.0.0-alpha.1

- Aggiunto primo supporto “file collegato” tramite File System Access API, dove disponibile.
- Il bottone **Apri file** usa `showOpenFilePicker()` sui browser compatibili.
- Salvataggio del `FileSystemFileHandle` in IndexedDB per ricordare l’ultimo file originale.
- Al refresh/riavvio la PWA prova a rileggere la versione corrente del file dal dispositivo.
- Se il file originale non è più disponibile o il permesso è revocato, l’app azzera lo stato e mostra un messaggio.
- Nessun restore automatico da copia cache: viene usato solo il file originale corrente.
- Fallback invariato con `<input type="file">` quando la File System Access API non è disponibile.

## 2.0.8

- Rifinito il box **Sorgente**: rimosse le label testuali `Da` / `A` dai campi intervallo.
- Aggiunto separatore grafico `→` tra riga iniziale e riga finale.
- Centrati i numeri nei campi intervallo con cifre tabulari per migliorare la leggibilità.

## 2.0.7

- Corretto un artefatto grafico nella barra impostazioni: nascosta la scrollbar/corner strip laterale quando la barra non necessita di scroll visibile.
- Rafforzato il clipping del box Markdown renderizzato per impedire allo sfondo interno di oltrepassare i bordi arrotondati inferiori.

## 2.0.6

- Corretto il comportamento del banner di aggiornamento PWA: se la UI caricata è già alla stessa versione del service worker in attesa, il service worker viene allineato in silenzio senza mostrare il banner e senza reload.
- Aggiunto handshake di versione tra app e service worker.

## 2.0.5

- Rifinita la barra impostazioni: rimosse le label testuali **Font**, **Dimensione** e **Tema scuro**.
- Raggruppati font e dimensione testo in un unico gruppo **Tipografia** con glifo circolare `Tt`.
- Trasformato il controllo tema in un bottone circolare con icona sole/luna coerente con lo stato del tema.
- Aggiunti tooltip e label accessibili ai nuovi controlli grafici.

## 2.0.4

- Sostituito lo switch testuale **Copia con numero** nel box **Sorgente** con un toggle circolare compatto `123`, accanto al bottone copia.
- Aggiunto supporto touch per la selezione intervallo nel Markdown renderizzato: long press su un blocco per impostare l’ancora, poi tap su un altro blocco per estendere `Da` / `A`.
- Mantenuto il comportamento desktop click / Shift+click.

## 2.0.2

- Spostato lo switch **Copia con numero** dal pannello impostazioni al box **Sorgente**, accanto al bottone copia.
- Aggiunto supporto a **Shift+click** nel Markdown renderizzato per estendere l’intervallo `Da` / `A` del sorgente.
- Aggiornata la nota del pannello **Sorgente** per descrivere il comportamento click / Shift+click su righe e blocchi renderizzati.

## 2.0.1

- Corretto il flusso di aggiornamento PWA: il nuovo service worker non si attiva più automaticamente prima del click su “Aggiorna”.
- Il reload automatico dopo `controllerchange` avviene solo se l’utente ha confermato l’aggiornamento.
- Rafforzata la prevenzione dello zoom pagina su tablet/smartphone con gesture/touch guard e `touch-action`.

## 2.0.0

- Consolidata la linea V2 come release stabile.
- Corretto il formato copia righe con numero da `[nn:] <riga>` a `[nn]: <riga>`.
- Disabilitato lo zoom pagina con pinch su tablet/smartphone per mantenere stabile il layout della PWA.
- Aggiornati versione applicativa, service worker e documentazione.

## 2.0.0-alpha.7

- Corretto il comportamento della ricerca quando viene chiusa: gli highlight vengono rimossi subito.
- Aggiunto supporto globale a `Esc` per chiudere la ricerca e pulire le evidenziazioni.
- La chiusura della ricerca azzera anche il testo cercato e il contatore risultati.

Tutte le modifiche principali del progetto Markdown Viewer PWA.

## 2.0.0-alpha.6

- Aggiunta animazione leggera di apertura/chiusura della search bar.
- Search bar in topbar con slide laterale su desktop/tablet larghi.
- Search bar mobile mantenuta come overlay compatto sotto la topbar.
- Aggiunto supporto `prefers-reduced-motion` per disabilitare la transizione quando richiesto dal sistema.
- Nessuna modifica alla logica di ricerca.

## 2.0.0-alpha.4

- Il box Markdown si allarga quando il pannello **Sorgente** viene nascosto.
- Riordinati i bottoni della topbar: ricerca, apri file, numeri riga, sorgente, separatore, impostazioni, installa.
- Spostato il controllo tema chiaro/scuro nella barra impostazioni come switch **Tema scuro**.
- Aggiunto separatore visivo tra azioni documento e azioni applicazione.

## 2.0.0-alpha.3

- Aggiunta ricerca nel Markdown renderizzato.
- Ricerca attiva da minimo 3 caratteri.
- Aggiunti toggle **case sensitive** e **parole intere**.
- Aggiunto contatore risultati `n/tot`.
- Aggiunti bottoni prev/next con navigazione circolare.
- Aggiunto highlight di tutte le occorrenze e highlight rinforzato dell’occorrenza corrente.
- La ricerca ignora metadati YAML, numeri di riga, indice, sorgente e toolbar.
- Aggiunto numero versione vicino al logo nella topbar.
- README ripulito e note di versione spostate in `CHANGELOG.md`.
- README aggiornato con link alla pagina di installazione GitHub Pages.

## 2.0.0-alpha.2

- I commenti HTML `<!-- ... -->` non vengono più renderizzati nel Markdown.
- Supportati commenti HTML multilinea.
- I commenti dentro blocchi codice fenced restano visibili.
- I commenti restano visibili nel pannello sorgente.
- I numeri di riga originali restano invariati.

## 2.0.0-alpha.1

- Aggiunti due pulsanti floating nel box Markdown per andare rapidamente all’inizio e alla fine del documento.
- I pulsanti compaiono solo quando è caricato un documento scrollabile.
- I pulsanti si disabilitano automaticamente quando il documento è già in cima o in fondo.

## 1.5.5

- Corretto il clipping della scrollbar interna del box Markdown.
- Il contenuto Markdown scrolla dentro una shell arrotondata con `overflow: hidden`.

## 1.5.4

- Fix numeri riga duplicati nei blockquote.
- Scrollbar del box Markdown rientrata dentro il bordo arrotondato.
- Scrollbar dell’Indice accorciata sul fondo per evitare clipping sul bordo arrotondato.
- Piccoli aggiustamenti allo stile scrollbar dei pannelli scrollabili.

## 1.5.3

- Aggiunto spazio tra box principali e status bar.
- Pannello Sorgente esteso correttamente fino al fondo del box.
- Layout interno del Sorgente trasformato in griglia robusta.
- Chip numeri riga non sovrapposti al testo.
- Altezza fissa dei chip numeri riga.
- Aggiunta maggiore corsia laterale per i numeri riga nel Markdown renderizzato.
- Scrollbar custom su Markdown, Indice, Sorgente, settings, code block, tabelle e raw metadata.
- Scrollbar coerenti con tema dark/light.

## 1.5.2

- Box Markdown renderizzato fisso come Indice e Sorgente.
- Testo Markdown scrollabile internamente al box.
- Titolo pannello righe rinominato in **Sorgente**.
- Badge metadati `start-end` visibile solo con numeri riga attivi.
- Rimossa la parola “righe” dal badge metadati.
- Badge metadati con stile ovale coerente coi numeri riga.
- Evitato doppio numero riga laterale sul box metadati.
- Bottone expand/collapse metadati reso coerente: circolare, trasparente, simbolo SVG.
- `IntersectionObserver` aggiornato per funzionare con lo scroll interno del Markdown.

## 1.5.1

- Fix: il toggle impostazioni non fa più collassare l’intera workspace.
- Griglia CSS resa più robusta con aree esplicite: topbar / settingsbar / workspace / statusbar.
- Box iniziale Markdown alto come i pannelli laterali.
- Aggiunto più spazio tra barra settings e i tre pannelli principali.

## 1.5.0

- Bottone **Copia** nel pannello righe trasformato in circolare con icona copia.
- Bottone numeri linea aggiornato da `№` a `123`.
- Bottone pannello righe aggiornato da `#` a icona sorgente/codice `</>`.
- Nuovo bottone impostazioni con icona gear.
- Bottone gear mostra/nasconde la riga settaggi.
- Riga settaggi contiene font, dimensione e **Copia con numero**.
- Quando la riga settaggi è nascosta, il layout recupera spazio verticale.

## 1.4.0

- Bottone Apri file allineato graficamente agli altri pulsanti circolari.
- Bottone pannello righe come toggle show/hide con stato visivo attivo/inattivo.
- Rimossa la X di chiusura dal pannello righe.
- Bottone tema come toggle di stato dark/light.
- Bottone Indice mobile come toggle show/hide.
- Rimossa la X dal pannello Indice.
- Switch **Numeri linea** trasformato in bottone circolare on/off nella topbar.
- **Copia con numero** resta switch nella barra impostazioni.

## 1.3.0

- Fix pulsante Installa sempre visibile.
- Pulsante Installa trasformato in bottone circolare con icona.
- Fix visibilità ultima riga dell’indice.
- Titoli indice su una sola riga con ellissi.
- Titolo completo disponibile come tooltip.
- Numero riga indice non va più a capo.
- Numero riga indice renderizzato come badge/ovale.
- Default **Mostra numeri di linea** impostato a `false`.

## 1.2.0

- Aggiunto banner **Nuova versione disponibile**.
- Aggiunto bottone **Aggiorna** per attivare il nuovo service worker.
- Aggiunto messaggio `SKIP_WAITING` verso il service worker.
- Reload automatico una sola volta dopo attivazione nuovo service worker.
- Pulsante Installa nascosto se la PWA è già avviata come app.
- Pulsante Apri file reso circolare con icona.
- Checkbox **Numeri linea** e **Copia con numero** convertite in switch.
- Build GitHub Pages senza file `.map`.

## 1.1.0

- Riconoscimento del blocco iniziale delimitato da `---` come frontmatter YAML.
- Frontmatter escluso dal rendering Markdown normale.
- Frontmatter mostrato sopra al documento come card collassata espandibile.
- Frontmatter escluso dall’indice laterale degli heading.
- Numeri di riga originali del file mantenuti.
- Blocco metadati ancora selezionabile/copiabile dal pannello sorgente.

## 1.0.0

- Prima versione PWA installabile.
- Caricamento file Markdown locale.
- Render Markdown in sola lettura.
- Indice heading laterale.
- Scroll su heading da indice.
- Tema chiaro/scuro.
- Font e dimensione configurabili.
- Numeri linea on/off.
- Pannello righe sorgente virtualizzato.
- Copia righe con/senza formato `[numero:]`.
- Click su blocco renderizzato per agganciare le righe sorgente.
- Doppio click su blocco per copiarlo.
- Web Worker per parsing Markdown.
- Disattivazione automatica syntax highlight su documenti grandi.
- Manifest + service worker per installazione PWA.
