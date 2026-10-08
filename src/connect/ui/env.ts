import { join } from 'node:path'
import { getEnv } from '../../utils/env.ts'
import { LOCAL_NATS_PASSWORD, LOCAL_NATS_USERS } from '../dev-users.ts'
import { DEFAULT_NATS_URL } from '../env.ts'

/** HTTP port for the operator UI. */
export const uiPort = getEnv<number>('UI_PORT', { defaultValue: 4173, type: 'number' })

/** Bind address. Production should pin this to the CN-facing interface. */
export const uiHost = getEnv<string>('UI_HOST', { defaultValue: '0.0.0.0' })

/**
 * NATS monitoring origin. The dev cluster is `http://leno0:8222`.
 * Local `just nats-up` is `http://127.0.0.1:8222`.
 */
export const natsMonitorUrl = getEnv<string>('NATS_MONITOR_URL', { defaultValue: 'http://127.0.0.1:8222' })

/** NATS client URL for retained reads and the live tail. */
export const uiNatsUrl = getEnv<string>('NATS_URL', { defaultValue: DEFAULT_NATS_URL })

/**
 * Read-only NATS user. `svc-operator` can subscribe to radio and feedback.
 * The running dev cluster serves that user only after its config is reapplied.
 */
export const uiNatsUser = getEnv<string>('NATS_USER', { defaultValue: LOCAL_NATS_USERS.svcOperator })

/** NATS password. Local default is the well-known `local`. Never sent to the browser. */
export const uiNatsPassword = getEnv<string>('NATS_PASSWORD', { defaultValue: LOCAL_NATS_PASSWORD })

/** Path to the NATS users file. The board shows usernames and ACLs, never the hash. */
const defaultUsersConf = join(import.meta.dir, '../../../infra/kubernetes/components/users/nats-users.conf')

/** Override when the broker's user file is not the repo copy. */
export const usersConfPath = getEnv<string>('NATS_USERS_CONF', { defaultValue: defaultUsersConf })

/**
 * Comma-separated source CIDRs. Empty allows every peer, which is the local default.
 * Set this in production. The check uses the socket address, not `X-Forwarded-For`.
 */
export const uiAllowCidr = getEnv<string>('UI_ALLOW_CIDR', { defaultValue: '' })

/** Built Vue app. Missing until `just ui-build`. */
export const defaultDistDir = join(import.meta.dir, '../../../ui/dist')
