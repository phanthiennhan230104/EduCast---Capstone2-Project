export function getMessagePreview(message) {
  if (!message) return "Chưa có tin nhắn";
  if (message.message_type === "image") return "Đã gửi một hình ảnh";
  if (message.message_type === "audio") return "Đã gửi một audio";
  if (message.message_type === "file") {
    return message.original_filename || "Đã gửi một file";
  }
  return message.content || "Tin nhắn";
}

export function getFileNameFromUrl(url = "") {
  try {
    const cleanUrl = url.split("?")[0];
    const rawName = cleanUrl.substring(cleanUrl.lastIndexOf("/") + 1);
    return decodeURIComponent(rawName || "attachment");
  } catch {
    return "attachment";
  }
}

export function getFileExtension(filename = "") {
  const parts = filename.split(".");
  return parts.length > 1 ? parts.pop().toLowerCase() : "";
}

export function formatFileSize(bytes) {
  if (!bytes || Number.isNaN(Number(bytes))) return "";
  const value = Number(bytes);

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(2)} KB`;
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatAudioTime(seconds) {
  if (!Number.isFinite(seconds)) return "00:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function normalizeMessageOwnership(message, currentUserId) {
  if (!message) return message;

  const senderId = message.sender?.id;
  if (!senderId || !currentUserId) return message;

  return {
    ...message,
    is_mine: String(senderId) === String(currentUserId),
  };
}

export function normalizeConversationOwnership(conversation, currentUserId) {
  if (!conversation) return conversation;

  return {
    ...conversation,
    last_message: normalizeMessageOwnership(
      conversation.last_message,
      currentUserId
    ),
  };
}