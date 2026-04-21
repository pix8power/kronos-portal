import { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import api from '../services/api';

const SocketContext = createContext(null);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const socketRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [onlineUsers, setOnlineUsers] = useState(new Set());
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setSocket(null);
      return;
    }

    const token = localStorage.getItem('token');
    const socketUrl = import.meta.env.VITE_SOCKET_URL || '/';
    const s = io(socketUrl, { auth: { token }, transports: ['websocket', 'polling'] });
    socketRef.current = s;

    s.on('connect', () => {
      setSocket(s);
      // Sync badge with actual DB unread count on every (re)connect
      api.get('/messages/unread-count')
        .then(({ data }) => setUnreadMessages(data.count || 0))
        .catch(() => {});
    });

    s.on('userOnline', ({ userId }) => {
      setOnlineUsers((prev) => new Set([...prev, userId]));
    });

    s.on('userOffline', ({ userId }) => {
      setOnlineUsers((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    });

    s.on('messageNotification', () => {
      setUnreadMessages((n) => n + 1);
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, [user]);

  const getSocket = useCallback(() => socketRef.current, []);
  const incrementUnreadMessages = useCallback(() => setUnreadMessages((n) => n + 1), []);
  const clearUnreadMessages = useCallback(() => setUnreadMessages(0), []);

  return (
    <SocketContext.Provider value={{ socket, getSocket, onlineUsers, unreadMessages, incrementUnreadMessages, clearUnreadMessages }}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
};
