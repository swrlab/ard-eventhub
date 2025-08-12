// fetch and convert env
const keys = Buffer.from(process.env.DTS_KEYS as string, 'base64').toString(
	'utf8'
)

interface keys {
	credentials: any
	endpoints: any
	permittedExcludedFields: any
}

const decoded: keys = JSON.parse(keys)

// export content
export default {
	credentials: decoded.credentials,
	endpoints: decoded.endpoints,
	permittedExcludedFields: decoded.permittedExcludedFields,
}
