import axios from 'axios'

import { API_BASE_URL } from './api'
import { getToken } from './auth'

export async function sendAssistantMessage({
  message,
  history = [],
  context = {},
}) {
  const token = getToken()

  const response = await axios.post(
    `${API_BASE_URL}/ai-services/assistant/chat/`,
    {
      message,
      history,
      context,
    },
    {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      withCredentials: true,
    },
  )

  return response.data
}