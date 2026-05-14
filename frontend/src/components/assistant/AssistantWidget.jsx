import { useEffect, useState } from "react";
import { Bot, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import AssistantPopup from "./AssistantPopup";
import { useTranslation } from "react-i18next";
import styles from "../../style/assistant/AssistantWidget.module.css";


const BUBBLE_SIZE = 64;
const RIGHT_OFFSET = 20;
const PLAYER_HEIGHT = 70;
const PLAYER_GAP = 16;

function getFixedPosition() {
  return {
    x: window.innerWidth - BUBBLE_SIZE - RIGHT_OFFSET,
    y: window.innerHeight - BUBBLE_SIZE - PLAYER_HEIGHT - PLAYER_GAP,
  };
}

export default function AssistantWidget() {
  const location = useLocation();
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPosition(getFixedPosition());
    setMounted(true);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setPosition(getFixedPosition());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);


  const hideOnAdmin = location.pathname.startsWith("/admin");
  if (!mounted || hideOnAdmin) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.bubble} ${isOpen ? styles.bubbleActive : ""}`}
        style={{ left: position.x, top: position.y }}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={t("assistant.openLabel")}
      >
        {isOpen ? <X size={26} /> : <Bot size={26} />}
      </button>

      {isOpen && (
        <AssistantPopup
          anchorPosition={position}
          onClose={() => setIsOpen(false)}
        />
      )}
    </>
  );
}