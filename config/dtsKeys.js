// fetch and convert env
const keys = Buffer.from(process.env.DTS_KEYS, 'base64').toString('utf8')
const decoded = JSON.parse(keys)

// export content
module.exports = decoded
