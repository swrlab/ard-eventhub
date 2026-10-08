# subscribe on the local MQTT gateway (`just mqtt-sub`, `just mqtt-sub --all`, or an institution URN)
[group('MQTT')]
mqtt-sub *args:
	just env "bun run ./src/cli/mqtt-sub.ts {{ if args == '' { 'urn:ard:institution:a3004ff924ece1a2' } else { args } }}"
