import { pubSubPrefix } from '#config'

export const pubsubBuildId = (input: string) => `${pubSubPrefix}${encodeURIComponent(input)}`
