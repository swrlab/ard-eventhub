/**
 * @fileoverview this file creates a CLI for hashing ids
 */

import { exit } from 'node:process'
import { getARDFeed } from '../data/index.ts'

await getARDFeed()
exit(0)
