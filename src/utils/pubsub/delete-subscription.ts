import { pubSubClient } from './_client.ts'

export const deleteSubscription = async (name: string): Promise<void> => {
	await pubSubClient.subscription(name).delete()
}
