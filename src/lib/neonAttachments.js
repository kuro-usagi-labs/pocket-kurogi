import { neon } from './neon'

function pathToId(path) {
  const segments = String(path || '').split('/')
  return segments[segments.length - 1] || null
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Lampiran tidak bisa dibaca.'))
    reader.onloadend = () => {
      const result = String(reader.result || '')
      resolve(result.includes(',') ? result.split(',').pop() : result)
    }
    reader.readAsDataURL(blob)
  })
}

export async function uploadChatAttachment(userId, file) {
  const id = crypto.randomUUID()
  const contentType = file.type || 'image/jpeg'
  const dataBase64 = await blobToBase64(file)
  const path = `${userId}/${id}`

  const { error } = await neon.from('chat_attachments').insert({
    id,
    user_id: userId,
    content_type: contentType,
    data_base64: dataBase64,
  })

  return {
    path: error ? null : path,
    url: error ? null : `data:${contentType};base64,${dataBase64}`,
    error,
  }
}

export async function getChatAttachmentUrls(paths) {
  const ids = [...new Set(paths.map(pathToId).filter(Boolean))]
  if (ids.length === 0) {
    return new Map()
  }

  const { data, error } = await neon
    .from('chat_attachments')
    .select('id, content_type, data_base64')
    .in('id', ids)

  if (error) {
    return new Map()
  }

  const byId = new Map(
    (data || []).map((attachment) => [
      attachment.id,
      `data:${attachment.content_type};base64,${attachment.data_base64}`,
    ]),
  )

  return new Map(
    paths
      .map((path) => [path, byId.get(pathToId(path))])
      .filter(([, url]) => Boolean(url)),
  )
}

export async function removeChatAttachments(paths) {
  const ids = [...new Set(paths.map(pathToId).filter(Boolean))]
  if (ids.length === 0) {
    return { error: null }
  }

  const { error } = await neon.from('chat_attachments').delete().in('id', ids)
  return { error }
}
