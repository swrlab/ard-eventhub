import process from 'node:process'
import { getRequiredEnv } from '@frytg/check-required-env/get'
import mqtt from 'mqtt'
import { mqttTlsConnectOptions } from '../utils/mqtt/tls-ca.ts'
import { MQTT_SUB_USAGE, parseMqttSubArgs } from './mqtt-sub-args.ts'

const MQTT_V311 = 4

const argv = process.argv.slice(2)
if (argv.includes('--help') || argv.includes('-h')) {
	console.error(MQTT_SUB_USAGE)
	process.exit(0)
}

let target: ReturnType<typeof parseMqttSubArgs>
try {
	target = parseMqttSubArgs(argv)
} catch (error) {
	console.error(error instanceof Error ? error.message : error)
	process.exit(1)
}

const brokerUrl = getRequiredEnv('MQTT_BROKER_URL').trim()
const { topic } = target
const printTopic = target.kind === 'all'

const client = mqtt.connect(brokerUrl, {
	protocolVersion: MQTT_V311,
	clientId: `eventhub-mqtt-sub-${process.pid}`,
	clean: true,
	...mqttTlsConnectOptions(process.env.MQTT_TLS_CA ?? ''),
})

client.on('connect', () => {
	client.subscribe(topic, { qos: 1 }, (error) => {
		if (error) {
			console.error(error)
			process.exit(1)
		}
		console.error(`subscribed ${topic} on ${brokerUrl}`)
	})
})

client.on('message', (messageTopic, payload) => {
	if (printTopic) {
		console.log(messageTopic)
	}
	console.log(payload.toString())
})

client.on('error', (error) => {
	console.error(error)
	process.exit(1)
})
