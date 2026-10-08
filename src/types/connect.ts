/**
 * @fileoverview Eventhub Connect types.
 * Covers the feed store, validation plans, and the operator UI, including the live tail.
 */

import type { MqttClient } from 'mqtt'
import type { ArdFeed } from './ard.ts'

/** Publisher or institution as the catalog and later validation see them. */
type KnownLivestreamParty = {
	id: string
	title: string
}

/**
 * One livestream this process knows about.
 * Feed rows and `allowed-livestreams.json` share this shape.
 */
export type KnownLivestream = {
	/** Livestream URN publishers send. Feed rows use `externalId`, not the fusion `id`. */
	id: string
	title: string
	publisher: KnownLivestreamParty
	/** Null when an overlay publisher is not in the loaded feed. */
	institution: KnownLivestreamParty | null
	/** Granted by `allowed-livestreams.json`, not by a row in the core feed. */
	overlay: boolean
}

/** What the last download did. */
export type FeedOutcome = 'stored' | 'unchanged' | 'rejected' | 'unavailable'

/** How late the last successful fetch is. `never` means this process has not stored or confirmed one. */
export type FeedStaleness = 'ok' | 'warn' | 'alert' | 'page' | 'never'

/** JSON the operator UI polls for the feed this process is serving. */
export type FeedReport = {
	at: string
	revision: number | null
	generatedAt: string | null
	itemCount: number | null
	institutionCount: number | null
	ageMs: number | null
	lastSuccessAt: string | null
	lastAttemptAt: string | null
	lastError: string | null
	staleness: FeedStaleness
	outcome: FeedOutcome | null
}

/** Serving feed plus the overlay rows. */
export type FeedCatalogReport = FeedReport & {
	note: string
	entries: KnownLivestream[]
}

export type MetaReport = {
	pollMs: number
	tailIdleMs: number
	tailCapMs: number
	tailPerSecond: number
	defaultFilter: string
	monitor: string
	natsUrl: string
	/** WebSocket listener the tail opens. The username is hardcoded in the page. */
	wsUrl: string
	user: string
}

export type ClusterNode = {
	name: string
	reachable: boolean
	version: string | null
	uptime: string | null
	connections: number
	slowConsumers: number
	staleConnections: number
	subscriptions: number
	memBytes: number | null
	routes: number | null
}

export type ReplicaHealth = {
	name: string
	current: boolean
	activeNs: number | null
}

export type ConsumerHealth = {
	server: string
	stream: string
	name: string
	pending: number | null
	ackPending: number | null
	redelivered: number | null
	waiting: number | null
}

export type ClusterReport = {
	at: string
	error: string | null
	cluster: string | null
	leader: string | null
	clusterSize: number | null
	metaPending: number | null
	storageBytes: number | null
	storageMaxBytes: number | null
	memoryBytes: number | null
	memoryMaxBytes: number | null
	streams: number | null
	consumers: number | null
	replicas: ReplicaHealth[]
	nodes: ClusterNode[]
	consumerDetails: ConsumerHealth[]
}

export type LiveConnection = {
	server: string
	cid: number
	ip: string
	user: string
	name: string
	connectedAt: string | null
	lastActivity: string | null
	subscriptions: string[]
	/** `MQTT`, `WEBSOCKET`, or `STANDARD`, matching `allowed_connection_types`. Null when `/connz` omitted `type`. */
	type: string | null
	mqttClient: string | null
}

export type UserRow = {
	username: string
	issued: string | null
	institutions: string[]
	allows: string[]
	connectionTypes: string[]
	connections: number
}

export type ConnectionsReport = {
	at: string
	error: string | null
	note: string | null
	users: UserRow[]
	connections: LiveConnection[]
}

export type OnAirTrack = {
	title: string | null
	artist: string | null
	publisherId: string | null
	at: string | null
}

export type OnAirControl = {
	name: string | null
	state: boolean | null
	validUntil: string | null
	at: string | null
}

export type OnAirData = {
	text: string | null
	at: string | null
}

export type OnAirStation = {
	livestreamId: string
	/** Institution URN from the retained payload. */
	institutionId: string | null
	/** Institution title from the feed row for this livestream. Null when the feed has no row. */
	institutionTitle: string | null
	/** Publisher title from the feed row for this livestream. Null when the feed has no row. */
	publisherTitle: string | null
	lastEventAt: string | null
	playing: OnAirTrack | null
	next: OnAirTrack | null
	control: OnAirControl | null
	data: OnAirData | null
}

export type OnAirReport = {
	at: string
	error: string | null
	note: string | null
	truncated: boolean
	stations: OnAirStation[]
}

export type Rejection = {
	created: string
	institutionId: string | null
	subject: string | null
	errors: ValidationErrorItem[]
	playlistItemId: string | null
	/** Rejected inbox event from the feedback body. Null when the feedback has none. */
	event: unknown
}

export type RejectionsReport = {
	at: string
	error: string | null
	note: string | null
	institution: string | null
	rejections: Rejection[]
}

/** Publisher and institution the ownership check compares. */
export type LivestreamOwner = {
	publisherId: string
	institutionId: string
}

/** One accepted document plus its JetStream sequence. */
export type FeedSnapshot = {
	feed: ArdFeed
	revision: number
}

/**
 * Shared store. The JetStream bucket is the production one. Tests pass a memory double.
 */
export type ArdFeedStore = {
	/**
	 * Latest accepted document, or null when the bucket is empty or the bytes fail validation.
	 */
	read: () => Promise<FeedSnapshot | null>
	/**
	 * Append a new revision.
	 * @param feed - Document that already passed the upstream checks
	 * @returns The stored snapshot, including the new sequence
	 */
	write: (feed: ArdFeed) => Promise<FeedSnapshot>
	/**
	 * Call `onSnapshot` for the current revision (when there is one) and every revision after it.
	 * @param onSnapshot - Validated revision
	 * @returns Stops the watch
	 */
	watch: (onSnapshot: (snapshot: FeedSnapshot) => void) => () => void
}

/** Result of comparing a fetched candidate with the feed that is serving. */
export type UpstreamDecision =
	| { action: 'store'; feed: ArdFeed }
	| { action: 'keep'; reason: string; successful: boolean }

/** In-memory feed this process is serving. `feed` and `revision` only ever come from KV. */
export type ArdFeedState = {
	feed: ArdFeed | null
	revision: number | null
	lastSuccessAt: string | null
	lastAttemptAt: string | null
	lastError: string | null
	outcome: FeedOutcome | null
}

export type RefreshInput = {
	store: ArdFeedStore
	url: string
	fetchFeed?: (url: string) => Promise<unknown>
	connected?: ReadonlySet<string> | null
	now?: () => Date
}

/** A followed feed: resolves once a KV revision is serving, and stops the watch. */
export type FollowedArdFeed = {
	/** Resolves once `state` serves a KV revision. Stays pending while KV is empty. */
	kvReady: Promise<void>
	unwatch: () => void
}

/** One problem with a rejected event, in the shape of the HTTPS API's 400 `errors[]` (`.body.services.0.id`). */
export type ValidationErrorItem = {
	path: string
	message: string
	errorCode: string
}

/** Why a delivery is termed. The term reason and the `cause` in the `validation rejected` log; not sent on `feedback/`. */
export type RejectCause = 'json' | 'schema' | 'ownership'

/** Retained MQTT publish (`radio/` or `feedback/`). */
export type MqttPublish = {
	topic: string
	body: unknown
}

/** NATS-native publish to a plugin subject. Not retained. */
export type NatsPublish = {
	subject: string
	body: unknown
}

/** Accepted: retain on every `radio/` topic, fan out to every plugin subject, then ack. */
export type ValidationAccept = {
	action: 'ack'
	radio: MqttPublish[]
	plugins: NatsPublish[]
	/**
	 * The accepted event for the log: the body that was retained, with `created` set to the delivery time.
	 * Oversized deliveries are a prefix (`truncated`, `bytes`, `head`) past 64 KiB, same as a rejection.
	 */
	payload: unknown
}

/** Rejected: retain the feedback (when the subject names an institution), then term. */
export type ValidationReject = {
	action: 'term'
	cause: RejectCause
	errors: ValidationErrorItem[]
	feedback: MqttPublish | null
	/** The full inbox payload for the log and the feedback body: decoded JSON, else the text. */
	payload: unknown
}

/** Work for one inbox message, before any publish or ack. */
export type ValidationPlan = ValidationAccept | ValidationReject

/** How the loop publishes. Tests can substitute an in-memory pair. */
export type ValidationPublisher = {
	/**
	 * MQTT publish with RETAIN. Used for `radio/` and `feedback/`.
	 * @param topic - MQTT topic (`/` separators)
	 * @param body - JSON value
	 * @returns Resolves after the QoS 1 PUBACK
	 */
	publishRetained: (topic: string, body: unknown) => Promise<void>
	/**
	 * NATS-native publish captured by the PLUGINS stream. Not retained.
	 * @param subject - `plugin.{target}.{livestreamId}.{class}`
	 * @param body - Validated event
	 * @returns Resolves after the JetStream pub ack
	 */
	publishPlugin: (subject: string, body: unknown) => Promise<void>
}

/** One settled inbox delivery, for tests and the duplicate counter. */
export type ValidationSettlement = {
	seq: number
	redelivered: boolean
	action: ValidationPlan['action']
}

/** The running loop and the MQTT connection it publishes on. */
export type RunningValidation = {
	controller: AbortController
	client: MqttClient
	task: Promise<void>
}

/** Event class on a retained `radio.{livestreamId}.{eventClass}` subject. */
export type RadioEventClass = 'track.playing' | 'track.next' | 'control' | 'data'

export type RadioObservation = {
	subject: string
	at: string
	payload: unknown
}

export type TailCloseReason = 'idle' | 'cap' | 'client' | 'nats' | 'denied'

export type TailClock = {
	openedAt: number
	lastBeatAt: number
}

export type RateWindow = {
	windowStart: number
	forwarded: number
	dropped: number
}

/** One frame the live tail shows. */
export type TailEvent = {
	subject: string
	at: string
	payload: unknown
	sampled: boolean
}

export type ConfiguredUser = {
	username: string
	issued: string | null
	institutions: string[]
	allows: string[]
	connectionTypes: string[]
}

export type RejectionLog = {
	push: (row: Rejection) => void
	list: () => Rejection[]
	setLiveError: (message: string | null) => void
	liveError: () => string | null
}

export type RetainedMessage = {
	subject: string
	at: string
	text: string
}

export type RetainedRead = {
	messages: RetainedMessage[]
	truncated: boolean
	error: string | null
}

export type VarzView = {
	name: string
	version: string | null
	uptime: string | null
	connections: number
	slowConsumers: number
	staleConnections: number
	subscriptions: number
	memBytes: number | null
	routes: number | null
	expected: string[]
}

export type ConnzView = {
	total: number
	connections: LiveConnection[]
}

export type Slot = {
	id: string
	varz: VarzView | null
	connz: ConnzView | null
}

export type MetaView = {
	cluster: string | null
	leader: string | null
	clusterSize: number | null
	metaPending: number | null
	storageBytes: number | null
	storageMaxBytes: number | null
	memoryBytes: number | null
	memoryMaxBytes: number | null
	streams: number | null
	consumers: number | null
	replicas: ReplicaHealth[]
	consumerDetails: ConsumerHealth[]
}

export type MonitorFetch = (input: string, init?: RequestInit) => Promise<Response>
