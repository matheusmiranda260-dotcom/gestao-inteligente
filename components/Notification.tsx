
import React, { useEffect } from 'react';
import { CheckCircleIcon, XCircleIcon } from './icons';

interface NotificationProps {
  message: string;
  type: 'success' | 'error';
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onClose]);

  const isSuccess = type === 'success';
  const bgColor = isSuccess ? 'bg-emerald-600' : 'bg-red-600';
  const Icon = isSuccess ? CheckCircleIcon : XCircleIcon;

  return (
    <div className={`fixed top-5 right-5 p-4 rounded-lg shadow-lg text-white ${bgColor} flex items-center z-50`}>
      <Icon className="h-6 w-6 mr-3" />
      <span>{message}</span>
    </div>
  );
};

export default Notification;