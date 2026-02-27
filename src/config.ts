import { port, serviceName, stage } from '#env'
import pkg from '../package.json' with { type: 'json' }
import coreIdPrefixes from './config/core-id-prefixes.json' with { type: 'json' }

export const { version } = pkg

export { coreIdPrefixes }

const isDev = stage === 'dev'
const protocol = isDev ? 'http' : 'https'
const hostname = isDev ? 'localhost' : 'eventhub-ingest.ard.de'
export const serviceUrl = `${protocol}://${hostname}:${port}`
export const userAgent = `${serviceName}/${version}`
/**
 * HTTP Headers containing the service name as user-agent.
 */
export const defaultHeaders: HeadersInit = {
	'user-agent': userAgent,
}

export const pubSubPrefix = `de.ard.eventhub.${stage}.`
export const pubSubTopicSelf = `de.ard.eventhub.${stage}.internal`
