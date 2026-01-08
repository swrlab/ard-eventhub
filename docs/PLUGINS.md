# ARD Eventhub / Plugins

Der Eventhub ermöglicht die Integration verschiedener Plugins. Diese werden dafür verwendet Daten zu verarbeiten und zu transformieren und sie dann an die jeweils vorgesehenen Ziele zu senden. Die Plugins sind in JavaScript implementiert. Diese Seite gibt einen Überblick über die aktuell verfügbaren Plugins.

## DTS Xperi

Dieses Plugin ermöglicht das Senden von Metadaten an das DTS-System. Aktuell ist es als Opt-out-Feature konfiguriert — die Übermittlung erfolgt also standardmäßig. Das Opt-out gilt derzeit nur für Musiktitel (`type: music`). Das Senden kann für jedes einzelne Event überschrieben werden, sofern man es selber setzen möchte:

```json5
{
	"type": "music",
	// ...
	"plugins": [
		{
			"type": "dts",
			"isDeactivated": false
		}
	]
}
```

Folgende Optionen können gesetzt werden:

- `isDeactivated` (boolean, Standard `false`) - bei `true` werden keine Daten an das externe System gesendet
- `delay` (int, Standard `0`) - Verzögerungdie gewartet wird, bis die Daten angezeigt werden
- `album` (string, Standard `null`) - Albumtitel, falls vorhanden
- `composer` (string, Standard `null`) - Komponist, falls vorhanden
- `program` (string, Standard `null`) - Programmtitel, falls vorhanden
- `subject` (string, Standard `null`) - Thema, falls vorhanden
- `webUrl` (string, Standard `null`) - URL zur Webseite des Events
- `preferArtistMedia` (boolean, Standard `false`) - bei `true` wird Medienmaterial des Künstlers dem Cover vorgezogen
- `excludeFields` (array, Standard `[]`) - Felder, die vom Versand an das externe System ausgeschlossen werden

Wenn `plugins[].type === 'dts'` nicht gesetzt ist, wird es automatisch hinzugefügt (Opt-out-Prinzip). Das `isDeactivated` Feld ist optional und standardmäßig auf `false` gesetzt. Setzt man es auf `true`, werden die Daten nicht gesendet.

ARD Core IDs sind im externen System bereits gemappt. Änderungen an Ihren IDs (nicht empfohlen) erfordern manuelle Anpassungen — wenden Sie sich bei Bedarf an die zuständigen Stellen.

## Weitere Plugins

Es gibt technisch viele Möglichkeiten für Plugins; es gelten jedoch Richtlinien. Wenden Sie sich für Details an das Partner-Management.
