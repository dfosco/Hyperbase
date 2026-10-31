export default function errorMessage(failure, fallback) {
  if (typeof failure === 'string') return failure
  if (!failure || typeof failure !== 'object') return fallback
  const message = typeof failure.message === 'string' ? failure.message : ''
  const code = typeof failure.code === 'string' ? failure.code : ''
  if (message && code && !message.includes(code)) return `${code}: ${message}`
  return message || code || fallback
}
