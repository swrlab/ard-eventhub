// fetch and convert env
const radiohubKeys = Buffer.from(process.env.DTS_KEYS, 'base64').toString('utf8')
const decoded = JSON.parse(radiohubKeys)

// export content
module.exports = decoded
