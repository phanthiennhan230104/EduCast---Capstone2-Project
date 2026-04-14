import { useEffect, useRef, useState } from "react";
import { Bot, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import AssistantPopup from "./AssistantPopup";
import styles from "../../style/assistant/AssistantWidget.module.css";

const STORAGE_KEY = "assistant-widget-position";
const BUBBLE_SIZE = 64;
const GAP = 20;

function getDefaultPosition() {
  return {
    x: window.innerWidth - BUBBLE_SIZE - GAP,
    y: window.innerHeight - BUBBLE_SIZE - 120,
  };
}

export default function AssistantWidget() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [mounted, setMounted] = useState(false);

  const dragRef = useRef({
    dragging: false,
    moved: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  });

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setPosition(JSON.parse(saved));
      } catch {
        setPosition(getDefaultPosition());
      }
    } else {
      setPosition(getDefaultPosition());
    }
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
  }, [position, mounted]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => clampPosition(prev.x, prev.y));
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const clampPosition = (x, y) => {
    const maxX = window.innerWidth - BUBBLE_SIZE - 8;
    const maxY = window.innerHeight - BUBBLE_SIZE - 8;

    return {
      x: Math.max(8, Math.min(x, maxX)),
      y: Math.max(8, Math.min(y, maxY)),
    };
  };

  const handlePointerDown = (e) => {
    e.preventDefault();

    dragRef.current = {
      dragging: true,
      moved: false,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: position.x,
      originY: position.y,
    };

    if (e.currentTarget.setPointerCapture) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    document.body.style.userSelect = "none";
  };

  const handlePointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    if (dragRef.current.pointerId !== e.pointerId) return;

    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      dragRef.current.moved = true;
    }

    const nextX = dragRef.current.originX + dx;
    const nextY = dragRef.current.originY + dy;

    setPosition(clampPosition(nextX, nextY));
  };

  const handlePointerUp = (e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;

    const wasDragged = dragRef.current.moved;

    dragRef.current.dragging = false;
    dragRef.current.pointerId = null;

    if (e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }

    document.body.style.userSelect = "";

    if (!wasDragged) {
      setIsOpen((prev) => !prev);
    }
  };

  const handlePointerCancel = (e) => {
    if (dragRef.current.pointerId !== e.pointerId) return;

    dragRef.current.dragging = false;
    dragRef.current.pointerId = null;
    document.body.style.userSelect = "";
  };

  const hideOnAdmin = location.pathname.startsWith("/admin");
  if (!mounted || hideOnAdmin) return null;

  return (
    <>
      <button
        type="button"
        className={`${styles.bubble} ${isOpen ? styles.bubbleActive : ""}`}
        style={{ left: position.x, top: position.y }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        aria-label="Mở AI Assistant"
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