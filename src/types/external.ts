import type { google } from '@google-cloud/pubsub/build/protos/protos.js'
import type { DecodedIdToken } from 'firebase-admin/auth'
import type { LoginTicket } from 'google-auth-library'

export type { Subscription } from '@google-cloud/pubsub'
export type { DecodedIdToken }

// Google PubSub
export type ISubscription = google.pubsub.v1.ISubscription
export type ITopic = google.pubsub.v1.ITopic

/**
 * Authenticated Firebase user with Eventhub institution fields attached at runtime.
 */
export type AuthUser = DecodedIdToken & {
	institutionId?: string
	institution?: {
		id: string
		name: string
	}
}

/**
 * Minimal request context passed to event helpers (replaces Express UserTokenRequest).
 */
export type EventRequestContext = {
	user?: AuthUser | undefined
	body: {
		event?: string
		type?: string
		start?: string
		[key: string]: unknown
	}
	headers: Record<string, string | undefined>
}

/**
 * Pub/Sub push auth context holding a verified Google LoginTicket.
 */
export type PubSubAuthContext = {
	user?: LoginTicket
}
