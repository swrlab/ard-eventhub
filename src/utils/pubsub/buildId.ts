import { pubSubPrefix } from '#config'

export default (input: string) => `${pubSubPrefix}${encodeURIComponent(input)}`
