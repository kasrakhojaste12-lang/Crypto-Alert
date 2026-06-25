// Loads environment variables. Imported FIRST in every entrypoint so that
// modules creating connections at import-time (redis, prisma) see the vars.
import dotenv from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url)) // loads root + local .env

// App-local .env first (wins), then monorepo root .env fills the rest.
dotenv.config()
dotenv.config({ path: path.resolve(here, '../../../../.env') })
