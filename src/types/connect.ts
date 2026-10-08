/**
 * @fileoverview Eventhub Connect types shared by the service and the operator UI.
 * The polled JSON shapes live here. The live tail is a separate socket.
 */

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
	institutionId: string | null
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
	at: string
	institutionId: string | null
	subject: string | null
	message: string
	cause: string | null
	disagreed: string[]
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
