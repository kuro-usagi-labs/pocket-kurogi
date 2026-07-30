import {
  applyAssistantCors,
  authenticateAssistantRequest,
  getAssistantSql,
  parseAssistantBody,
} from './_lib/assistantServer.js'
import {
  getChatRequestMeta,
  logChatTelemetry,
  runChatDatabaseOperation,
  sendChatError,
  validateChatRequest,
} from './_lib/chatServer.js'

export default async function handler(req, res) {
  const startedAt = Date.now()
  const meta = getChatRequestMeta(req)
  let operation = 'unknown'
  let statusCode = 500
  let errorCode = null
  try {
    applyAssistantCors(req, res)
    if (req.method === 'OPTIONS') {
      statusCode = 204
      res.status(204).end()
      return
    }
    if (!['GET', 'POST'].includes(req.method)) {
      const error = new Error('Method tidak didukung.')
      error.statusCode = 405
      throw error
    }
    const body = req.method === 'GET'
      ? {
          cursorCreatedAt: req.query?.cursorCreatedAt,
          cursorId: req.query?.cursorId,
        }
      : parseAssistantBody(req)
    operation = req.method === 'GET'
      ? String(req.query?.operation || 'list_messages')
      : String(body.operation || '')
    validateChatRequest(operation, body, req.method)
    const { userId } = await authenticateAssistantRequest(req)
    const data = await runChatDatabaseOperation({
      sql: getAssistantSql(), userId, operation, body, requestId: meta.requestId,
    })
    statusCode = 200
    res.status(200).json({ data, meta: { requestId: meta.requestId } })
  } catch (error) {
    statusCode = Number(error?.statusCode || (error?.code === 'P0001' ? 409 : 500))
    errorCode = error?.code || (statusCode >= 500 ? 'CHAT_UNAVAILABLE' : 'CHAT_REQUEST_ERROR')
    sendChatError(res, error, meta.requestId)
  } finally {
    logChatTelemetry({ ...meta, operation, durationMs: Date.now() - startedAt, statusCode, errorCode })
  }
}
