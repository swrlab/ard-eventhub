# ARD Eventhub / Plugins

The Eventhub is a platform that allows for the integration of various plugins. These plugins are used to process and transform data, and to send it to the appropriate destination. The plugins are written in JavaScript. This page provides an overview of the plugins that are currently available.

## DTS Xperi

This plugin makes it possible to send data to their system. It is currently set as an opt-out feature, meaning that data is sent by default. The opt-out feature only applies to music titles at the moment (`type: music`). Sending data can be toggled for every individual event, if you want to set it yourself:

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

There are also a couple of properties that can be set:

- `isDeactivated` (boolean, default `false`) - if `true`, the data will not be sent to the external system
- `delay` (int, default `0`) - if there is an offset to wait until this data is shown
- `album` (string, default `null`) - album title, if available
- `composer` (string, default `null`) - composer, if available
- `program` (string, default `null`) - program title, if available
- `subject` (string, default `null`) - subject, if available
- `webUrl` (string, default `null`) - URL to the web page of the event
- `preferArtistMedia` (boolean, default `false`) - if `true`, the artist media will be preferred over the cover (both, if available)
- `excludeFields` (array, default `[]`) - fields to exclude from the data sent to the external system

If `plugins[].type === 'dts'` is not set, it will be added automatically (opt-out principle). The `isDeactivated` property is optional and defaults to `false`. Setting it to `true` will prevent the data from being sent to the external system.

ARD Core IDs are already mapped in the external system. Changing your IDs (not recommended) requires manual updates (please contact for more details).

## Additional plugins

While there are technically endless possibilities for plugins, there are guidelines to follow. Please reach out internally to the partner management for more details.
