import { useState, useEffect } from 'react';
import { messagesAPI, usersAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import ConversationList from '../components/messaging/ConversationList';
import ChatWindow from '../components/messaging/ChatWindow';
import { MessageCircle } from 'lucide-react';

export default function Messages() {
  const { user } = useAuth();
  const { getSocket } = useSocket();
  const [conversations, setConversations] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [mobileShowChat, setMobileShowChat] = useState(false);

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
    };

    socket.on('messageNotification', onNotification);
    socket.on('newMessage', ({ conversationId, message }) => {
      onNotification({ conversationId, message });
    });

    return () => {
      socket.off('messageNotification', onNotification);
      socket.off('newMessage');
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
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
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
