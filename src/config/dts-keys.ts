import type { DTSKeys } from '#types'

const keys = Buffer.from(process.env.DTS_KEYS as string, 'base64').toString('utf8')
const dts: DTSKeys = JSON.parse(keys)

export default dts
