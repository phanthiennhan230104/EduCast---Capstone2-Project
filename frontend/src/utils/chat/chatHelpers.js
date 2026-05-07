export function getMessagePreview(message) {
  if (!message) return "Chưa có tin nhắn";
  if (message.message_type === "image") return "Đã gửi một hình ảnh";
  if (message.message_type === "audio") return "Đã gửi một audio";
  if (message.message_type === "file") {
    return message.original_filename || "Đã gửi một file";
  }
  
  // If content is a JSON string from a shared post/podcast, try to parse and show a friendly preview
  const content = message.content;
  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{")) {
      try {
        const obj = JSON.parse(trimmed);
        // Known shared payloads include type: 'podcast' or similar and have a title/caption
        if (obj && typeof obj === "object") {
          const title = obj.title || obj.name || obj.caption || obj.post_title;
          if (title) return title;
          // fallback to a generic shared label
          if (obj.type === "podcast") return "Đã chia sẻ một podcast";
          if (obj.post_id || obj.type) return "Đã chia sẻ một bài viết";
        }
      } catch (e) {
        // Not JSON, fall through
      }
    }
  }

  return content || "Tin nhắn";
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