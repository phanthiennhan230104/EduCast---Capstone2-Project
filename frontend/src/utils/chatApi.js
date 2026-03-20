import { apiRequest } from "./api";
import { getToken } from "./auth";

const API_BASE = "http://127.0.0.1:8000";
const WS_BASE = "ws://127.0.0.1:8000";

export async function searchChatUsers(query = "") {
  return apiRequest(`/chat/users/search/?q=${encodeURIComponent(query)}`);
}

export async function startDirectChat(targetUserId) {
  return apiRequest("/chat/start/", {
    method: "POST",
    body: JSON.stringify({
      target_user_id: targetUserId,
    }),
  });
}

export async function fetchConversations() {
  return apiRequest("/chat/conversations/");
}

export async function fetchMessages(roomId) {
  return apiRequest(`/chat/messages/${roomId}/`);
}

export async function markRoomRead(roomId) {
  return apiRequest(`/chat/rooms/${roomId}/read/`, {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function uploadChatAttachment(file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_BASE}/api/chat/attachments/upload/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.detail || data?.file?.[0] || "Upload file thất bại");
  }

  return data;
}

export function createChatSocket(roomId) {
  const token = getToken();
  return new WebSocket(`${WS_BASE}/ws/chat/${roomId}/?token=${token}`);
}