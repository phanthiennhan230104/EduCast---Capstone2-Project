import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import styles from '../../style/common/ConfirmModal.module.css';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText, 
  cancelText,
  avatarUrl,
  type = 'danger' // 'danger' | 'warning' | 'info'
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className={styles.overlay} onClick={onClose}>
        <motion.div 
          className={styles.modal}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          onClick={e => e.stopPropagation()}
        >
          <div className={styles.content}>
            {avatarUrl && (
              <div className={styles.avatarWrapper}>
                <img src={avatarUrl} alt="User" className={styles.avatar} />
              </div>
            )}
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.message}>{message}</p>
          </div>
          
          <div className={styles.footer}>
            <button 
              className={`${styles.confirmBtn} ${styles[type]}`} 
              onClick={() => {
                onConfirm();
                onClose();
              }}
            >
              {confirmText || 'Xác nhận'}
            </button>
            <button className={styles.cancelBtn} onClick={onClose}>
              {cancelText || 'Hủy'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ConfirmModal;
