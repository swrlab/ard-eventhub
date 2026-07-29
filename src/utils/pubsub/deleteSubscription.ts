import pubSubClient from './_client.ts'

export default async (name: string): Promise<void> => {
	await pubSubClient.subscription(name).delete()
}
