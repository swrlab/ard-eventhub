/** SWR institution URN used by `pub-swr-2026-06-26`. */
export const SWR_INSTITUTION_ID = 'urn:ard:institution:a3004ff924ece1a2'

/** Second institution for the multi-institution publisher (RFC §7.4). */
export const SHARED_INSTITUTION_ID = 'urn:ard:institution:b71c0e4d9a25f338'

/**
 * Well-known local password for every user in `infra/nats/nats-users.conf`.
 * Not a secret. Production plaintext lives in sops; the NATS config holds bcrypt only.
 */
export const LOCAL_NATS_PASSWORD = 'local'

/** RFC §7.2 usernames shipped in the local NATS config. */
export const LOCAL_NATS_USERS = {
	pubSwr: 'pub-swr-2026-06-26',
	pubShared: 'pub-shared-playout-2026-06-26',
	subArdSounds: 'sub-ard-sounds-2026-06-26',
	svcSidecar: 'svc-sidecar',
	svcAdapterRadioplayer: 'svc-adapter-radioplayer',
	svcBridge: 'svc-bridge',
} as const
