---
title: "Demo Markdown Viewer PWA"
series: "Cyber Seinen Nexus"
subtitle: "Frontmatter + reader test"
status: "Working draft"
format_note: "Markdown di lavorazione"
---

# Demo Markdown Viewer PWA

Questo è un file di test per la V1.

## Funzioni base

- Render Markdown
- Indice laterale
- Numeri di linea
- Copia righe
- Tema chiaro/scuro

## Tabella

| Feature | Stato |
|---|---:|
| PWA | OK |
| Worker | OK |
| Copia righe | OK |

## Task list

- [x] Aprire file locale
- [x] Renderizzare Markdown
- [ ] Caricamento da URL futuro

## Codice Java

```java
public class HelloMarkdown {
    public static void main(String[] args) {
        System.out.println("Hello, Markdown Viewer!");
    }
}
```

## Note custom

:::tip
Questo è un blocco `tip`.
:::

:::warning
Questo è un blocco `warning`.
:::

## Footnote

Una nota a piè pagina[^1].

[^1]: Ecco la nota.
