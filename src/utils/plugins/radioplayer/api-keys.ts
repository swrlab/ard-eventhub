// fetch and convert env
const apiKeys = process.env.RADIOPLAYER_API_KEYS
if (!apiKeys) throw new Error('RADIOPLAYER_API_KEYS not found')
const decoded = JSON.parse(Buffer.from(apiKeys, 'base64').toString('utf8'))

// export content
export default decoded
