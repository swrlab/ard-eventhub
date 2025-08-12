/*

	ard-eventhub
	by SWR Audio Lab

*/
// load api feed (needed to get the file initialized)
import _feed from '../../data'

export default async (publisherId: string) => {
	const ardFeed = import('../../data/ard-core-livestreams.json')

	const publisher = await ardFeed.then((feed) =>
		feed.items.find((entry: any) => {
			return publisherId === entry.publisher.id
				? entry.publisher
				: null
		})
	)

	return Promise.resolve(publisher)
}
