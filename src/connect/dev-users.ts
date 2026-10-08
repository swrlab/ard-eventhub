/** SWR institution URN used by `pub-swr-2026-06-26`. */
export const SWR_INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'

/** Second institution for the multi-institution publisher (RFC §7.4). */
export const SHARED_INSTITUTION_ID = 'urn:ard:institution:b71c0e4d9a25f338'

/**
 * Well-known password for publishers and services in the local NATS config.
 * `sub-ui` has no password. Not a secret. The NATS config holds the bcrypt hash only.
 */
export const LOCAL_NATS_PASSWORD = 'local'

/** RFC §7.2 usernames shipped in the local NATS config. */
export const LOCAL_NATS_USERS = {
	pubSwr: 'pub-swr-2026-06-26',
	pubShared: 'pub-shared-playout-2026-06-26',
	subArdSounds: 'sub-ard-sounds-2026-06-26',
	/** Browser tail. No password. WebSocket only, subscribe `radio.>`. */
	subUi: 'sub-ui',
	svcSidecar: 'svc-sidecar',
	svcOperator: 'svc-operator',
	svcAdapterRadioplayer: 'svc-adapter-radioplayer',
	svcIngest: 'svc-ingest',
} as const
