---
title: "KI-kompatible Dokumentation"
description: "Diese Docs für LLMs und Coding-Agenten nutzen — Markdown-URLs, Copy as Markdown und llms.txt."
sidebar:
  order: 2
---

Diese Dokumentation ist nicht nur im Browser lesbar. Sie lässt sich auch von KI-Assistenten und Coding-Agenten (Cursor, Claude Code, ChatGPT usw.) direkt einlesen — ohne HTML zu scrapen.

Die folgenden Formate stehen auf jeder Seite zur Verfügung.

## llms.txt

[`llms.txt`](https://llmstxt.org) ist ein kompakter Index der gesamten Dokumentation: Titel und Beschreibung der Site, danach alle Seiten als verlinkte Liste mit Kurzbeschreibung — gruppiert wie in der Sidebar. Agenten sehen damit die Struktur der Docs, nicht nur eine flache Linkliste.

Für die OpenAPI-Referenz gilt dasselbe: Die generierten API-Seiten sind in `/llms.txt` enthalten.

## llms-full.txt

`/llms-full.txt` enthält den vollständigen Markdown-Inhalt jeder Seite in einer Datei. Jeder Abschnitt beginnt mit Titel und Quell-URL — geeignet, wenn ein Agent die gesamte Dokumentation auf einmal laden soll.

## Markdown-URLs (`.md`)

Jede Seite ist auch als Roh-Markdown erreichbar: Hänge `.md` an die URL an.

| URL                    | Liefert                                                     |
| ---------------------- | ----------------------------------------------------------- |
| `/user/quickstart`     | Die gerenderte Seite im Browser                             |
| `/user/quickstart.md`  | Plain Markdown (Komponenten werden in Markdown umgewandelt) |
| `/user/quickstart.mdx` | Die unveränderte MDX-Quelle                                 |

Die Startseite liegt unter `/index.md`. Verschachtelte Pfade funktionieren genauso (`/plugins/radioplayer.md`).

Die `.md`-Variante wandelt eingebaute Komponenten in lesbares Markdown um — dieselbe Darstellung, die auch in `llms-full.txt` und bei **Als Markdown kopieren** verwendet wird. Für die Originalquelle nimm `.mdx`.

### Content Negotiation

Agenten müssen die `.md`-Konvention nicht kennen: Ein Request mit dem Header `Accept: text/markdown` auf die normale Seiten-URL liefert dieselbe Markdown-Variante zurück.

## Als Markdown kopieren

Auf jeder Seite findest du unter dem Inhaltsverzeichnis die Aktion **Als Markdown kopieren**. Sie kopiert den Markdown-Inhalt der aktuellen Seite in die Zwischenablage — identisch mit der `.md`-URL. Praktisch zum Einfügen in einen Chat, ein Issue oder eigene Notizen.

## Im Chat öffnen

Neben **Als Markdown kopieren** gibt es **Im Chat öffnen**: Die Aktion öffnet einen KI-Assistenten (z. B. ChatGPT, Claude oder Cursor) mit einem Prompt, der auf die `.md`-URL der aktuellen Seite verweist. Der Assistent kann die Seite direkt abrufen und Fragen dazu beantworten.

## Beispiel-URLs (Produktion)

Mit dem Deployment unter `https://swrlab.github.io/ard-eventhub`:

- Index: [`https://swrlab.github.io/ard-eventhub/llms.txt`](https://swrlab.github.io/ard-eventhub/llms.txt)
- Volltext: [`https://swrlab.github.io/ard-eventhub/llms-full.txt`](https://swrlab.github.io/ard-eventhub/llms-full.txt)
- Einzelne Seite: [`https://swrlab.github.io/ard-eventhub/user/quickstart.md`](https://swrlab.github.io/ard-eventhub/user/quickstart.md)
