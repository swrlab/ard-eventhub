/**
 * @fileoverview CLI entry point that fetches the ARD feed and then exits.
 */

import { exit } from 'node:process'
import { getARDFeed } from '../data/index.ts'

await getARDFeed()
exit(0)
