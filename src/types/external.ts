import type { google } from '@google-cloud/pubsub/build/protos/protos.js'
import type { DecodedIdToken } from 'firebase-admin/auth'

// Google PubSub
export type ISubscription = google.pubsub.v1.ISubscription
export type ITopic = google.pubsub.v1.ITopic

/**
 * Authenticated Firebase user with Eventhub institution attached after allow-list lookup.
 */
export type AuthUser = DecodedIdToken & {
	institution: {
		id: string
		name: string
	}
}
