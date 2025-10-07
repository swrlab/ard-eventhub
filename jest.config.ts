import type { Config } from '@jest/types'
// Sync object
const config: Config.InitialOptions = {
	setupFiles: ['./dotenv.config.ts'],
	verbose: true,
	transform: {
		'^.+\\.tsx?$': 'ts-jest',
	}
}

export default config
