/** JSON shapes the operator UI polls. The live tail is a separate socket. */

export type { FeedReport } from '../ard-feed.ts'

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
	deprecated: string[]
}

export type RejectionsReport = {
	at: string
	error: string | null
	note: string | null
	institution: string | null
	rejections: Rejection[]
}
