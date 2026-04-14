import { useState } from "react";
import { Bot, SendHorizonal } from "lucide-react";
import styles from "../../style/assistant/AssistantWidget.module.css";

export default function AssistantPopup({ anchorPosition, onClose }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      text: "Xin chào, mình là EduCast Assistant. Mình có thể giúp bạn tìm nội dung học, tóm tắt chủ đề hoặc gợi ý lộ trình học.",
    },
  ]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      text: input,
    };

    const botMessage = {
      id: Date.now() + 1,
      role: "assistant",
      text: "Phase 1 đang là UI demo. Ở bước sau mình sẽ nối API chatbot.",
    };

    setMessages((prev) => [...prev, userMessage, botMessage]);
    setInput("");
  };

  const popupStyle = getPopupPosition(anchorPosition);

  return (
    <div className={styles.popup} style={popupStyle}>
      <div className={styles.popupHeader}>
        <div className={styles.popupTitle}>
          <div className={styles.popupIcon}>
            <Bot size={18} />
          </div>
          <div>
            <strong>EduCast Assistant</strong>
            <p>AI Learning Assistant</p>
          </div>
        </div>

        <button type="button" className={styles.closeBtn} onClick={onClose}>
          ×
        </button>
      </div>

      <div className={styles.popupBody}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.message} ${
              msg.role === "user" ? styles.userMessage : styles.assistantMessage
            }`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className={styles.popupFooter}>
        <input
          type="text"
          placeholder="Nhập câu hỏi..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button type="button" onClick={handleSend}>
          <SendHorizonal size={16} />
        </button>
      </div>
    </div>
  );
}

function getPopupPosition(anchorPosition) {
  const popupWidth = 380;
  const popupHeight = 520;
  const spacing = 14;

  let left = anchorPosition.x - popupWidth + 64;
  let top = anchorPosition.y - popupHeight - spacing;

  if (left < 12) left = 12;
  if (top < 12) top = 12;

  const maxLeft = window.innerWidth - popupWidth - 12;
  const maxTop = window.innerHeight - popupHeight - 12;

  return {
    left: Math.min(left, maxLeft),
    top: Math.min(top, maxTop),
  };
}