import { useState, useEffect } from 'react';
import { messagesAPI, usersAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import ConversationList from '../components/messaging/ConversationList';
import ChatWindow from '../components/messaging/ChatWindow';
import { MessageCircle } from 'lucide-react';
import { ConversationSkeleton } from '../components/Skeleton';

export default function Messages() {
  const { user } = useAuth();
  const { getSocket, clearUnreadMessages } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [unreadCounts, setUnreadCounts] = useState({});

  // Clear badge and mark all as read in DB when Messages page opens
  useEffect(() => {
    clearUnreadMessages();
    messagesAPI.markAllRead().catch(() => {});
  }, [clearUnreadMessages]);

  useEffect(() => {
    Promise.all([messagesAPI.getConversations(), usersAPI.getAll()])
      .then(([convRes, usersRes]) => {
        setConversations(convRes.data);
        setAllUsers(usersRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  // Listen for new message notifications to update conversation list
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNotification = ({ conversationId, message }) => {
      setConversations((prev) =>
        prev.map((c) =>
          c._id === conversationId
            ? { ...c, lastMessage: message, updatedAt: message.createdAt }
            : c
        ).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
      );
      setSelected((current) => {
        if (current?._id !== conversationId) {
          setUnreadCounts((prev) => ({ ...prev, [conversationId]: (prev[conversationId] || 0) + 1 }));
        }
        return current;
      });
    };

    const onNewMessage = ({ conversationId, message }) => onNotification({ conversationId, message });

    socket.on('messageNotification', onNotification);
    socket.on('newMessage', onNewMessage);

    return () => {
      socket.off('messageNotification', onNotification);
      socket.off('newMessage', onNewMessage);
    };
  }, [getSocket]);

  const handleNewDirect = async (userId) => {
    try {
      const res = await messagesAPI.createDirect(userId);
      const conv = res.data;
      setConversations((prev) => {
        const exists = prev.find((c) => c._id === conv._id);
        if (exists) return prev;
        return [conv, ...prev];
      });
      setSelected(conv);
      setMobileShowChat(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleNewGroup = async (name, participants) => {
    try {
      const res = await messagesAPI.createGroup({ name, participants });
      setConversations((prev) => [res.data, ...prev]);
      setSelected(res.data);
      setMobileShowChat(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelect = (conv) => {
    setSelected(conv);
    setMobileShowChat(true);
    setUnreadCounts((prev) => ({ ...prev, [conv._id]: 0 }));
  };

  const handlePin = async (conv) => {
    try {
      const res = await messagesAPI.pinConversation(conv._id);
      setConversations((prev) => prev.map((c) => {
        if (c._id !== conv._id) return c;
        const userId = conv.participants?.find(() => true)?._id; // just need to toggle
        const alreadyPinned = res.data.pinned;
        return { ...c, pinnedBy: alreadyPinned ? [...(c.pinnedBy || []), 'me'] : [] };
      }).sort((a, b) => {
        if (a.pinnedBy?.length && !b.pinnedBy?.length) return -1;
        if (!a.pinnedBy?.length && b.pinnedBy?.length) return 1;
        return 0;
      }));
      // Refresh to get accurate pinnedBy from server
      const fresh = await messagesAPI.getConversations();
      setConversations(fresh.data);
    } catch { /* ignore */ }
  };

  const handleDelete = async (conv) => {
    if (!confirm('Remove this conversation?')) return;
    try {
      await messagesAPI.deleteConversation(conv._id);
      setConversations((prev) => prev.filter((c) => c._id !== conv._id));
      if (selected?._id === conv._id) { setSelected(null); setMobileShowChat(false); }
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
        <div className="w-full md:w-80 lg:w-96 flex-col flex-shrink-0 border-r border-gray-100">
          <div className="p-4 border-b border-gray-100">
            <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
          </div>
          <div className="divide-y divide-gray-50">
            {[1,2,3,4,5].map((i) => <ConversationSkeleton key={i} />)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex overflow-hidden">
      {/* Sidebar - conversation list */}
      <div
        className={`${
          mobileShowChat ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 flex-col flex-shrink-0`}
      >
        <ConversationList
          conversations={conversations}
          selected={selected}
          onSelect={handleSelect}
          allUsers={allUsers}
          onNewDirect={handleNewDirect}
          onNewGroup={handleNewGroup}
          unreadCounts={unreadCounts}
          onPin={handlePin}
          onDelete={handleDelete}
        />
      </div>

      {/* Chat area */}
      <div className={`flex-1 ${mobileShowChat ? 'flex' : 'hidden md:flex'} flex-col`}>
        {selected ? (
          <ChatWindow
            conversation={selected}
            onBack={() => setMobileShowChat(false)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
            <MessageCircle className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-gray-500">Select a conversation</h3>
            <p className="text-sm mt-1">Choose from your existing conversations or start a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}
