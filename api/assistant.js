import {
  applyAssistantCors,
  authenticateAssistantRequest,
  getAssistantSql,
  parseAssistantBody,
  runAssistantDatabaseOperation,
  sendAssistantError,
  validateAssistantOperationRequest,
} from './_lib/assistantServer.js'

export default async function handler(req, res) {
  let operation = null
  try {
    applyAssistantCors(req, res)

    if (req.method === 'OPTIONS') {
      res.status(204).end()
      return
    }
    if (!['GET', 'POST'].includes(req.method)) {
      res.setHeader('Allow', 'GET, POST, OPTIONS')
      res.status(405).json({
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Method tidak didukung.',
        },
      })
      return
    }

    const { userId } = await authenticateAssistantRequest(req)
    const sql = getAssistantSql()
    const body = req.method === 'POST' ? parseAssistantBody(req) : {}
    operation = req.method === 'GET'
      ? String(req.query?.operation || 'get_state')
      : String(body.operation || '')
    validateAssistantOperationRequest(operation, body, req.method)
    const data = await runAssistantDatabaseOperation({
      sql,
      userId,
      operation,
      body,
    })

    res.status(200).json({ data })
  } catch (error) {
    console.error('Assistant API error:', {
      name: error?.name,
      code: error?.code,
      statusCode: error?.statusCode,
      operation,
      message: error?.code === 'P0001' ? error.message : undefined,
    })
    sendAssistantError(res, error)
  }
}
