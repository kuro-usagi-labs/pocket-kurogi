const AFFIRMATIVE_PATTERN =
  /^(?:ya|iya|yup|yes|betul|benar|oke|ok|sip|siap|setuju|simpan|ingat)(?:\s+(?:ya|deh|dong))?[.!]?$/iu
const NEGATIVE_PATTERN =
  /^(?:tidak|nggak|ngga|gak|ga|enggak|jangan|batal|cancel|gausah|gakusah|nggausah)(?:\s+(?:usah|deh|ya))?[.!]?$/iu

export function classifyMemoryProposalReply(text = '') {
  const normalized = String(text || '').trim()
  if (AFFIRMATIVE_PATTERN.test(normalized)) return 'confirm'
  if (NEGATIVE_PATTERN.test(normalized)) return 'cancel'
  return null
}

export function getPendingMemoryProposal(messages = [], now = new Date()) {
  const latestBotMessage = [...messages]
    .reverse()
    .find((message) => message?.sender === 'bot')
  const proposal = latestBotMessage?.metadata?.assistantMemoryProposal

  if (
    !proposal ||
    proposal.status !== 'proposed' ||
    !Array.isArray(proposal.memories) ||
    proposal.memories.length === 0
  ) {
    return null
  }

  const expiresAt = new Date(proposal.expiresAt).getTime()
  if (!Number.isFinite(expiresAt) || expiresAt <= new Date(now).getTime()) {
    return null
  }

  return proposal
}

export function buildMemoryProposalResponse(proposal) {
  const labels = (proposal?.displayItems || [])
    .map(formatMemoryDisplayItem)
    .filter(Boolean)

  return {
    text: labels.length === 1
      ? `Aku memahami preferensimu sebagai **${labels[0]}**. Mau kusimpan untuk percakapan berikutnya?`
      : `Aku menangkap beberapa preferensi: ${labels.map((label) => `**${label}**`).join(', ')}. Mau kusimpan untuk percakapan berikutnya?`,
    intentStatus: 'needs_confirmation',
    metadata: {
      assistantMemoryProposal: proposal,
      confirmationMode: 'binary',
      confirmationHint:
        'Balas “iya” untuk menyimpan atau “batal” untuk mengabaikan.',
    },
  }
}

export function buildMemoryProposalResolutionResponse(proposal, decision) {
  const labels = (proposal?.displayItems || [])
    .map(formatMemoryDisplayItem)
    .filter(Boolean)
  const subject = labels.length > 0
    ? labels.map((label) => `**${label}**`).join(', ')
    : 'preferensi itu'

  return {
    text: decision === 'confirm'
      ? `Siap, ${subject} sudah kusimpan.`
      : `Oke, ${subject} tidak kusimpan.`,
    metadata: {
      assistantMemoryProposalResolved: proposal?.id || null,
      assistantMemoryProposalDecision: decision,
    },
  }
}

function formatMemoryDisplayItem(item) {
  const value = String(item?.displayValue ?? item?.value ?? '').trim()
  if (!value) return null

  if (item.key === 'preferred_wallet') {
    return `dompet default ${value}`
  }
  if (item.key === 'preferred_communication_style') {
    return value === 'concise'
      ? 'gaya jawaban ringkas'
      : 'gaya jawaban lebih detail'
  }
  if (item.key === 'salary_date') {
    return `tanggal gajian ${value}`
  }
  if (item.key === 'common_merchant_category') {
    return `kategori default ${value}`
  }
  return value
}
