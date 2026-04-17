import { useState, useEffect, useRef } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Search, Plus, Users, MessageCircle, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { usersAPI } from '../../services/api';

const formatTime = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'MMM d');
};

function UserAvatar({ u, size = 7, onlineUsers }) {
  const initials = u.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase();
  const isOnline = onlineUsers?.has(u._id) || u.isOnline;
  return (
    <div className="relative flex-shrink-0">
      {u.avatar ? (
        <img
          src={u.avatar}
          alt={u.name}
          className={`w-${size} h-${size} rounded-full object-cover border border-gray-200`}
        />
      ) : (
        <div
          className={`w-${size} h-${size} rounded-full flex items-center justify-center text-white text-xs font-bold`}
          style={{ backgroundColor: u.color || '#6B7280' }}
        >
          {initials}
        </div>
      )}
      {isOnline && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
      )}
    </div>
  );
}

function UserSearchPanel({ title, onSelect, selectedIds = [], multiSelect = false, onClose }) {
  const { user } = useAuth();
  const { onlineUsers } = useSocket();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await usersAPI.search(query);
        setResults(res.data.filter((u) => u._id !== user?._id));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, user]);

  return (
    <div className="border-b border-gray-100 bg-blue-50">
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <p className="text-xs font-semibold text-gray-500 uppercase">{title}</p>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, position, or department…"
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      <div className="max-h-48 overflow-y-auto px-2 pb-2">
        {loading && (
          <p className="text-xs text-gray-400 text-center py-2">Searching…</p>
        )}
        {!loading && query && results.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-2">No users found</p>
        )}
        {!loading && !query && (
          <p className="text-xs text-gray-400 text-center py-2">Type a name to search all staff</p>
        )}
        {results.map((u) => {
          const isSelected = selectedIds.includes(u._id);
          return (
            <button
              key={u._id}
              onClick={() => onSelect(u)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-blue-100 transition-colors ${
                isSelected ? 'bg-blue-100' : ''
              }`}
            >
              <UserAvatar u={u} size={7} onlineUsers={onlineUsers} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {[u.position, u.department].filter(Boolean).join(' · ') || u.role}
                </p>
              </div>
              {multiSelect && (
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {isSelected && (
                    <svg viewBox="0 0 12 12" fill="none" className="w-full h-full">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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
  const [panel, setPanel] = useState(null); // 'direct' | 'group' | null
  const [groupName, setGroupName] = useState('');
  const [groupMembers, setGroupMembers] = useState([]); // array of user objects

  const filtered = conversations.filter((c) => {
    const other = c.participants?.find((p) => p._id !== user?._id);
    const name = c.isGroup ? c.name : other?.name || '';
    return name.toLowerCase().includes(search.toLowerCase());
  });

  const handleGroupCreate = () => {
    if (!groupName.trim() || groupMembers.length === 0) return;
    onNewGroup(groupName, groupMembers.map((u) => u._id));
    setPanel(null);
    setGroupName('');
    setGroupMembers([]);
  };

  const toggleGroupMember = (u) => {
    setGroupMembers((prev) =>
      prev.find((m) => m._id === u._id)
        ? prev.filter((m) => m._id !== u._id)
        : [...prev, u]
    );
  };

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-lg text-gray-900">Messages</h2>
          <div className="flex gap-1">
            <button
              onClick={() => setPanel(panel === 'direct' ? null : 'direct')}
              className={`p-2 rounded-lg transition-colors ${panel === 'direct' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'}`}
              title="New message"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
            <button
              onClick={() => setPanel(panel === 'group' ? null : 'group')}
              className={`p-2 rounded-lg transition-colors ${panel === 'group' ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-500 hover:text-blue-600'}`}
              title="New group"
            >
              <Users className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Search conversations */}
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
      {panel === 'direct' && (
        <UserSearchPanel
          title="New Message"
          onSelect={(u) => { onNewDirect(u._id); setPanel(null); }}
          onClose={() => setPanel(null)}
        />
      )}

      {/* New group panel */}
      {panel === 'group' && (
        <div className="border-b border-gray-100 bg-green-50">
          <div className="flex items-center justify-between px-3 pt-3 pb-1">
            <p className="text-xs font-semibold text-gray-500 uppercase">New Group</p>
            <button onClick={() => { setPanel(null); setGroupName(''); setGroupMembers([]); }} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="px-3 pb-3 space-y-2">
            <input
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Group name…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            {/* Selected members chips */}
            {groupMembers.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {groupMembers.map((m) => (
                  <span key={m._id} className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs px-2 py-0.5 rounded-full">
                    {m.name.split(' ')[0]}
                    <button onClick={() => toggleGroupMember(m)} className="hover:text-blue-600">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Inline user search for group */}
            <GroupMemberSearch
              selectedIds={groupMembers.map((m) => m._id)}
              onToggle={toggleGroupMember}
              currentUserId={user?._id}
            />

            <button
              onClick={handleGroupCreate}
              disabled={!groupName.trim() || groupMembers.length === 0}
              className="w-full bg-blue-600 text-white text-sm py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
            >
              Create Group ({groupMembers.length} member{groupMembers.length !== 1 ? 's' : ''})
            </button>
          </div>
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
                  {!conv.isGroup && other?.avatar ? (
                    <img
                      src={other.avatar}
                      alt={name}
                      className="w-11 h-11 rounded-full object-cover border border-gray-200"
                    />
                  ) : (
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: conv.isGroup ? '#6B7280' : other?.color || '#6B7280' }}
                    >
                      {conv.isGroup ? <Users className="h-5 w-5" /> : initials}
                    </div>
                  )}
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

// Separate component for the group member search to keep state isolated
function GroupMemberSearch({ selectedIds, onToggle, currentUserId }) {
  const { onlineUsers } = useSocket();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await usersAPI.search(query);
        setResults(res.data.filter((u) => u._id !== currentUserId));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, currentUserId]);

  return (
    <div>
      <div className="relative mb-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search staff to add…"
          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>
      {(results.length > 0 || loading || query) && (
        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg bg-white">
          {loading && <p className="text-xs text-gray-400 text-center py-2">Searching…</p>}
          {!loading && query && results.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">No users found</p>
          )}
          {results.map((u) => {
            const isSelected = selectedIds.includes(u._id);
            return (
              <button
                key={u._id}
                type="button"
                onClick={() => onToggle(u)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                  style={{ backgroundColor: u.color || '#6B7280' }}
                >
                  {u.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 truncate">{u.name}</p>
                  <p className="text-xs text-gray-400 truncate">{u.department || u.position || ''}</p>
                </div>
                <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                  {isSelected && (
                    <svg viewBox="0 0 12 12" fill="none" className="w-full h-full">
                      <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
