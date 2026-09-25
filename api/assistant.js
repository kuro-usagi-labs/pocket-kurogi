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
import { readFinancialReport } from './_lib/financialReport.js'
import { readTransactionHistory } from './_lib/transactionHistory.js'
import { randomUUID } from 'node:crypto'
import { assistantDiagnostic } from './_lib/assistantTelemetry.js'

export default async function handler(req, res) {
  let operation = null
  let stage = 'authentication'
  const requestId = randomUUID()
  const startedAt = Date.now()
  const record = (outcome, extra = {}) => console.info(assistantDiagnostic({ requestId, startedAt, operation, stage, outcome, ...extra }))
  try {
    res.setHeader('X-Request-Id', requestId)
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
    stage = 'validation'
    const sql = getAssistantSql()
    const body = req.method === 'POST' ? parseAssistantBody(req) : {}
    operation = req.method === 'GET'
      ? String(req.query?.operation || 'get_state')
      : String(body.operation || '')
    if (operation === 'transaction_history' && req.method === 'POST') {
      stage = 'database'
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ data: await readTransactionHistory(sql, userId, body.cursor ?? null) })
      record('success')
      return
    }
    if (operation === 'financial_report' && req.method === 'POST') {
      stage = 'report'
      res.setHeader('Cache-Control', 'no-store')
      res.status(200).json({ data: await readFinancialReport(sql, userId, body.month) })
      record('success')
      return
    }
    if (['language', 'interpret', 'interpret_v2'].includes(operation) && req.method === 'POST') {
      res.setHeader('Cache-Control', 'no-store')
      const structured = operation === 'interpret_v2'
      stage = 'language_context'
      const context = structured ? await readOwnedLanguageContext(sql, userId) : body.context
      stage = 'provider'
      const data = await getGeminiReply({ sql, userId, text: body.text, context, classify: operation !== 'language', structured })
      record(data.mode === 'fallback' ? 'fallback' : 'success', { reason: data.reason })
      res.status(200).json({ data })
      return
    }
    validateAssistantOperationRequest(operation, body, req.method)
    stage = 'database'
    const data = await runAssistantDatabaseOperation({
      sql,
      userId,
      operation,
      body,
    })

    res.status(200).json({ data })
    record('success')
  } catch (error) {
    record('error', { statusCode: error?.statusCode })
    sendAssistantError(res, error)
  }
}
