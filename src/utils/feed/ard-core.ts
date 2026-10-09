import type { ArdLivestream, ArdPublisher } from '#types'
import { ardFeed } from './ard-feed.ts'

/**
 * Publisher lookup source. Tests stub `getById` with sinon instead of seeding the ARD feed.
 */
export const publisherLookup = {
	/**
	 * Resolve a publisher by id from core livestreams data.
	 * @param publisherId - Publisher id
	 * @returns Publisher, or `undefined` when unknown
	 */
	getById(publisherId: string): ArdPublisher | undefined {
		return ardFeed?.items?.find((x: ArdLivestream) => x.publisher.id === publisherId)?.publisher
	},
}

/**
 * Gets a publisher by id from core livestreams data
 * @param publisherId - Publisher id
 * @returns Publisher, or `undefined` when unknown
 */
export const getPublisherById = (publisherId: string): ArdPublisher | undefined => publisherLookup.getById(publisherId)
