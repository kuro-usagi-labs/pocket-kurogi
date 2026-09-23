import {
  applyAssistantCors,
  authenticateAssistantRequest,
  getAssistantSql,
  parseAssistantBody,
  runAssistantDatabaseOperation,
  sendAssistantError,
  validateAssistantOperationRequest,
} from './_lib/assistantServer.js'
import { getGeminiReply } from './_lib/geminiAssistant.js'
import { readOwnedLanguageContext } from './_lib/languageContext.js'

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
    if (['language', 'interpret', 'interpret_v2'].includes(operation) && req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store')
      const structured = operation === 'interpret_v2'
      const context = structured ? await readOwnedLanguageContext(sql, userId) : body.context
      const data = await getGeminiReply({ sql, userId, text: body.text, context, classify: operation !== 'language', structured })
      res.status(200).json({ data })
      return
    }
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
