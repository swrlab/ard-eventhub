import type { ConfigUser } from '../../schemas/config.ts'
import usersJson from '../../config/users.json' with { type: 'json' }
import { usersConfig } from '../../schemas/config.ts'

const parsed = usersConfig.parse(usersJson)

/** Exact email → allow-listed user, built once at module load. */
const usersByEmail = new Map<string, ConfigUser>(parsed.users.map((user) => [user.email, user]))

/**
 * Look up an allow-listed user by exact email match from `src/config/users.json`.
 * @param email - Firebase / request email (must match the config entry exactly)
 * @returns Config user when allow-listed, otherwise `undefined`
 */
export const getConfigUser = (email: string): ConfigUser | undefined => usersByEmail.get(email)
