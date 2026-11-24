import process from 'node:process'
import { getRequiredEnv } from '@frytg/check-required-env/get'
import mqtt from 'mqtt'
import { mqttBrokerClientOptions, mqttBrokerLabel, parseMqttBrokerList } from '../utils/mqtt/broker-urls.ts'
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

const brokers = parseMqttBrokerList(getRequiredEnv('MQTT_BROKER_URL'))
if (brokers.servers.length === 0) {
	console.error('MQTT_BROKER_URL has no usable mqtt:// or mqtts:// broker')
	process.exit(1)
}
if (brokers.rejectedHosts.length > 0 || brokers.invalidCount > 0) {
	console.error(
		`skipped mqtt brokers rejected=${brokers.rejectedHosts.join(',') || '-'} invalid=${brokers.invalidCount}`
	)
}
// Hosts only. Userinfo stays off this line.
const brokerHost = brokers.servers.map(mqttBrokerLabel).join(',')
const { topic } = target
const printTopic = target.kind === 'all'

const client = mqtt.connect({
	protocolVersion: MQTT_V311,
	clientId: `eventhub-mqtt-sub-${process.pid}`,
	clean: true,
	...mqttBrokerClientOptions(brokers),
	...mqttTlsConnectOptions(process.env.MQTT_TLS_CA ?? ''),
})

client.on('connect', () => {
	client.subscribe(topic, { qos: 1 }, (error) => {
		if (error) {
			console.error(error)
			process.exit(1)
		}
		console.error(`subscribed ${topic} on ${brokerHost}`)
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
