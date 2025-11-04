/*

	ard-eventhub
	by SWR Audio Lab

*/
// load api feed (needed to get the file initialized)
import { ardFeed } from '../../data/index.ts'

export default async (publisherId: string) => {
	const publisher = ardFeed?.items?.find((entry: any) => {
		return publisherId === entry.publisher.id ? entry.publisher : null
	})

	return publisher
}
