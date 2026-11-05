/** Server URL with userinfo removed, plus the credentials that were in it. */
export type EndpointAuth = {
	/** Same scheme and host, no username or password. Safe to log. */
	url: string
	user: string
	password: string
}

/**
 * Percent-decode a URL userinfo component.
 * Bun's `URL` getter leaves `%40` encoded. `decodeURIComponent` throws on a stray `%`.
 * @param value - Raw user or password from `URL`
 * @returns Decoded text, or the raw value when it is not valid encoding
 */
const decodeUserinfo = (value: string): string => {
	try {
		return decodeURIComponent(value)
	} catch {
		return value
	}
}

/**
 * Read `user:password` from a connection URL.
 * NATS's JS client ignores URL userinfo and wants `user` / `pass` options.
 * mqtt.js reads it, but we still split it off so logs and the UI never see the password.
 * @param raw - `scheme://user:password@host:port`, or a URL with no userinfo
 * @returns Host URL plus decoded user and password. Empty strings when absent
 */
export const parseUserinfoUrl = (raw: string): EndpointAuth => {
	const trimmed = raw.trim()
	try {
		const url = new URL(trimmed)
		return {
			url: `${url.protocol}//${url.host}`,
			user: decodeUserinfo(url.username),
			password: decodeUserinfo(url.password),
		}
	} catch {
		return { url: trimmed, user: '', password: '' }
	}
}

/**
 * MQTT gateway on the same host as a NATS URL, port 1883.
 * `tls://` becomes `mqtts://`. Userinfo is dropped.
 * @param nats - NATS server URL
 * @returns `mqtt://` or `mqtts://` URL with no credentials
 */
export const mqttUrlForNats = (nats: string): string => {
	try {
		const url = new URL(parseUserinfoUrl(nats).url)
		const scheme = url.protocol === 'tls:' ? 'mqtts:' : 'mqtt:'
		return `${scheme}//${url.hostname}:1883`
	} catch {
		return 'mqtt://127.0.0.1:1883'
	}
}
