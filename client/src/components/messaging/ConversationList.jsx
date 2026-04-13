import { useState } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, Plus, Users, MessageCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

export default function ConversationList({
  conversations,
  selected,
  onSelect,
  allUsers,
  onNewDirect,
  onNewGroup,
}) {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);

  const filtered = conversations.filter((c) => {
    const other = c.participants?.find((p) => p._id !== user?._id);
    const name = c.isGroup ? c.name : other?.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const otherUsers = allUsers.filter((u) => u._id !== user?._id);

  const handleGroupCreate = () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    onNewGroup(groupName, groupMembers);
    setShowGroupForm(false);
    setGroupName('');
    setGroupMembers([]);
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg text-gray-900">Messages</h2>
          <div className="flex gap-1">
            <button
              onClick={() => { setShowNewChat(!showNewChat); setShowGroupForm(false); }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
              title="New message"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setShowGroupForm(!showGroupForm); setShowNewChat(false); }}
              className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-blue-600"
              title="New group"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* New direct message panel */}
      {showNewChat && (
        <div className="border-b border-gray-100 p-2 bg-blue-50 max-h-48 overflow-y-auto">
          <p className="text-xs font-semibold text-gray-500 uppercase px-2 mb-1">Start New Chat</p>
          {otherUsers.map((u) => (
            <button
              key={u._id}
              onClick={() => { onNewDirect(u._id); setShowNewChat(false); }}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-blue-100 rounded-lg text-left"
            >
              <div className="relative">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: u.color }}
                >
                  {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                {(onlineUsers.has(u._id) || u.isOnline) && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border border-white" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">{u.name}</p>
                <p className="text-xs text-gray-500">{u.position || u.role}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* New group panel */}
      {showGroupForm && (
        <div className="border-b border-gray-100 p-3 bg-green-50">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-2">New Group</p>
          <input
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            placeholder="Group name..."
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="max-h-32 overflow-y-auto space-y-1 mb-2">
            {otherUsers.map((u) => (
              <label key={u._id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupMembers.includes(u._id)}
                  onChange={(e) =>
                    setGroupMembers(
                      e.target.checked
                        ? [...groupMembers, u._id]
                        : groupMembers.filter((id) => id !== u._id)
                    )
                  }
                  className="rounded"
                />
                <span className="text-sm text-gray-900">{u.name}</span>
              </label>
            ))}
          </div>
          <button
            onClick={handleGroupCreate}
            className="w-full bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700"
          >
            Create Group
          </button>
        </div>
      )}

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <MessageCircle className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">No conversations</p>
          </div>
        ) : (
          filtered.map((conv) => {
            const other = conv.participants?.find((p) => p._id !== user?._id);
            const name = conv.isGroup ? conv.name : other?.name || 'Unknown';
            const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
            const isOnline = !conv.isGroup && (onlineUsers.has(other?._id) || other?.isOnline);
            const isSelected = selected?._id === conv._id;

            return (
              <button
                key={conv._id}
                onClick={() => onSelect(conv)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 border-b border-gray-50 ${
                  isSelected ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div
                    className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: conv.isGroup ? '#6B7280' : other?.color || '#6B7280' }}
                  >
                    {conv.isGroup ? <Users className="h-5 w-5" /> : initials}
                  </div>
                  {isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="font-semibold text-sm text-gray-900 truncate">{name}</p>
                    <p className="text-xs text-gray-400 ml-2 flex-shrink-0">
                      {formatTime(conv.updatedAt)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {conv.lastMessage
                      ? `${conv.lastMessage.sender?.name?.split(' ')[0] || ''}: ${conv.lastMessage.content}`
                      : 'Start a conversation'}
                  </p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
