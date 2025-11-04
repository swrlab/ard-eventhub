/*

	ard-eventhub
	by SWR Audio Lab

*/
// load api feed (needed to get the file initialized)

import type { ArdLivestream, ArdPublisher } from '../../types.ard.ts'
import { ardFeed } from '../data/index.ts'

/**
 * Gets a publisher by id from core livestreams data
 * @param {string} publisherId - Publisher id
 * @returns {Object} - Publisher
 */
export const getPublisherById = (publisherId: string): ArdPublisher | undefined => {
	return ardFeed?.items?.find((x: ArdLivestream) => x.publisher.id === publisherId)?.publisher
}
