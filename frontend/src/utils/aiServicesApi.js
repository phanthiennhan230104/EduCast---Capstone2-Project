import { apiRequest } from './api'

export async function sendAssistantMessage({
  message,
  history = [],
  context = {},
}) {
  return apiRequest('/ai-services/assistant/chat/', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history,
      context,
    }),
    credentials: 'include',
  })
}
