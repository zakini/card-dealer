import { WebSocket, WebSocketServer } from 'ws'

export const pingDelay = 30_000

export const cardMessage = 'deal-card-next'
export const settingsMessage = 'deal-card-settings'

interface FindOpenPortOptions<T> {
  attemptPort: (port: number) => T | Promise<T> | never
  isUnavailablePortError: (e: unknown) => boolean
}
const portRangeStart = 6660
const portRangeLength = 10
// eslint-disable-next-line max-len
export const findOpenPort = async <T>({ attemptPort, isUnavailablePortError }: FindOpenPortOptions<T>) => {
  for (let port = portRangeStart; port < portRangeStart + portRangeLength; port++) {
    try {
      return await attemptPort(port)
    } catch (e) {
      if (isUnavailablePortError(e)) continue
      throw e
    }
  }

  const portRangeString = `${portRangeStart} and ${portRangeStart + portRangeLength - 1}`
  throw new Error(`Failed to find open port between ${portRangeString}`)
}

interface WebSocketClient extends WebSocket {
  isAlive?: boolean
}

interface Logger {
  trace(message: string): void
  debug(message: string): void
  error(message: string): void
}

const isErrnoException = (v: unknown): v is NodeJS.ErrnoException => typeof v === 'object'
  && v !== null
  && 'code' in v
  && typeof v.code === 'string'

const waitForServerStart = async (server: WebSocketServer, logger: Logger) =>
  new Promise<void>((resolve, reject) => {
    const onSuccess = () => {
      server.off('error', onError)
      logger.debug(`Websocket server listening on port ${server.options.port}`)
      resolve()
    }
    const onError = (e: Error) => {
      server.off('connection', onSuccess)
      reject(e)
    }

    server.once('listening', onSuccess)
    server.once('error', onError)
  })

const detectBrokenConnections = (server: WebSocketServer, logger: Logger): void => {
  server.on('connection', (client: WebSocketClient) => {
    client.isAlive = true
    client.on('pong', function (this: WebSocketClient) {
      this.isAlive = true
    })
  })

  const intervalId = setInterval(() => {
    const clients: Set<WebSocketClient> = server.clients
    for (const client of clients) {
      if (client.isAlive === false) {
        logger.debug('Terminating unresponsive client connection')
        client.terminate()
        return
      }

      client.isAlive = false
      client.ping()
    }
  }, pingDelay)

  server.on('close', () => {
    clearInterval(intervalId)
  })
}

const log = (server: WebSocketServer, logger: Logger): void => {
  server.on('listening', () => {
    logger.debug(`Websocket server listening on port ${server.options.port}`)
  })
  server.on('error', (e) => {
    logger.error(`Websocket server error: ${e.message}`)
  })

  server.on('connection', (client) => {
    logger.debug('Websocket connection started')
    client.on('close', () => {
      logger.debug('Websocket connection closed')
    })
  })
}

export const createWebsocketServer = async (logger: Logger): Promise<WebSocketServer> => {
  // TODO retry this until server starts
  const server = await findOpenPort({
    attemptPort: async (port) => {
      logger.trace(`Attempting to start websocket server on port ${port}`)
      const server = new WebSocketServer({ port })
      await waitForServerStart(server, logger)
      return server
    },
    isUnavailablePortError: e => isErrnoException(e) && e.code === 'EADDRINUSE',
  })

  detectBrokenConnections(server, logger)
  log(server, logger)

  return server
}

export interface DealCardSettings {
  cardBack?: string | null
  cardFaces?: string[]
}

export type Message = { message: typeof cardMessage }
  | { message: typeof settingsMessage, data: DealCardSettings }

const isDealCardSettings = (v: unknown): v is DealCardSettings => typeof v === 'object'
  && v !== null
  && (!('cardBack' in v) || v.cardBack === null || typeof v.cardBack === 'string')
  && (
    !('cardFaces' in v)
      || (Array.isArray(v.cardFaces) && v.cardFaces.every(w => typeof w === 'string'))
  )

const isMessage = (v: unknown): v is Message => {
  const objectWithMessage = typeof v === 'object'
    && v !== null
    && 'message' in v
    && (v.message === cardMessage || v.message === settingsMessage)

  if (!objectWithMessage) return false

  if (v.message === cardMessage) return true

  return v.message === settingsMessage
    && 'data' in v
    && isDealCardSettings(v.data)
}

export const sendMessage = (socket: WebSocket, message: Message) => {
  socket.send(JSON.stringify(message))
}

export const receiveMessage = (message: MessageEvent<unknown>): Message => {
  const raw = message.data
  if (typeof raw !== 'string') throw new Error(`Invalid message data: ${JSON.stringify(raw)}`)

  const json = JSON.parse(raw)
  if (!isMessage(json)) throw new Error(`Invalid message data: ${raw}`)

  return json
}
