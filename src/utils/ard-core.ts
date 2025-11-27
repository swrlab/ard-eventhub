/*

	ard-eventhub
	by SWR Audio Lab

*/
// load api feed (needed to get the file initialized)

import type { ArdLivestream, ArdPublisher } from '../../types.ard.ts'
import { ardFeed } from '../data/index.ts'

/**
 * Temporary publisher mapping for the ARD feed during the migration period
 */
const TEMP_PUBLISHER_MAPPING: Record<string, string> = {
	'urn:ard:publisher:d6ea740f7417ed56': 'urn:ard:publisher:d7b84d265c36f604', // inforadio
	'urn:ard:publisher:f3e5ab48670f74d5': 'urn:ard:publisher:1b6ae8b401a077fd', // antenne brandenburg
	'urn:ard:publisher:b9fa15c6413e47d3': 'urn:ard:publisher:c03f427b1367429c', // fritz
	'urn:ard:publisher:ef1f1e7569f8fc54': 'urn:ard:publisher:9e8b2b6352741adb', // radioeins
	'urn:ard:publisher:5ce081233481abdc': 'urn:ard:publisher:599a095fa84a416e', // rbb 88.8
	'urn:ard:publisher:186d6d95c32a3e80': 'urn:ard:publisher:91601d9841363177', // hr-info
	'urn:ard:publisher:9944e1d1f9ecfbc6': 'urn:ard:publisher:bb3ac9eaa762650d', // hr1
	'urn:ard:publisher:219807efdec52f82': 'urn:ard:publisher:d8537bdd4f74dda8', // hr2-kultur
	'urn:ard:publisher:8e9d2d848d4bf08b': 'urn:ard:publisher:9aa39a36e69eeb3b', // hr3
	'urn:ard:publisher:3d62b2d2d032a703': 'urn:ard:publisher:5db2b80a1ca0b08e', // hr4
	'urn:ard:publisher:926798b983bc780a': 'urn:ard:publisher:1f4259e1b54a861d', // you-fm
}

/**
 * Gets a publisher by id from core livestreams data
 * @param {string} publisherId - Publisher id
 * @returns {Object} - Publisher
 */
export const getPublisherById = (publisherId: string): ArdPublisher | undefined => {
	const mappedPublisherId = TEMP_PUBLISHER_MAPPING[publisherId]
	return ardFeed?.items?.find((x: ArdLivestream) => x.publisher.id === mappedPublisherId)?.publisher
}
