import type { Config } from 'jest'

// Sync object
const config: Config = {
	setupFiles: ['./dotenv.config.ts'],
	verbose: true,
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	},
}

export default config
