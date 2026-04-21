import { useState, useEffect, useRef, useCallback } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { Send, Users, ArrowLeft, Check, CheckCheck, Smile, CornerUpLeft, X, Camera, ImageIcon } from 'lucide-react';
import { messagesAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';

const EMOJIS = [
  '😀','😂','😍','🥰','😎','😊','🙏','👍','👎','❤️',
  '🔥','✅','⭐','🎉','👏','💪','😅','🤔','😢','😡',
  '🙌','💯','🤝','👋','😴','🤒','💊','🏥','📋','⏰',
];

function EmojiPicker({ onSelect }) {
  return (
    <div className="absolute bottom-14 left-0 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-50 w-64">
      <div className="grid grid-cols-10 gap-1">
        {EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={() => onSelect(emoji)}
            className="text-xl hover:bg-gray-100 rounded-lg p-0.5 transition-colors leading-none"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// Resize an image File/Blob to max 900px wide, returns JPEG data URL
function resizeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 900;
        const scale = img.width > MAX ? MAX / img.width : 1;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Render text with clickable links
function MessageText({ content, isMine }) {
  const parts = content.split(/(https?:\/\/[^\s]+)/g);
  return (
    <p className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`underline break-all ${isMine ? 'text-blue-100 hover:text-white' : 'text-blue-600 hover:text-blue-800'}`}
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </p>
  );
}

const formatMsgTime = (d) => format(new Date(d), 'HH:mm');
const formatDateDivider = (d) => {
  const date = new Date(d);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMMM d, yyyy');
};

const shouldShowDateDivider = (messages, index) => {
  if (index === 0) return true;
  const prev = new Date(messages[index - 1].createdAt);
  const curr = new Date(messages[index].createdAt);
  return prev.toDateString() !== curr.toDateString();
};

export default function ChatWindow({ conversation, onBack, onClose }) {
  const { user } = useAuth();
  const { getSocket, onlineUsers } = useSocket();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [typing, setTyping] = useState([]);
  const [sending, setSending] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const bottomRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const emojiRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Close emoji picker on outside click
  useEffect(() => {
    const handler = (e) => { if (emojiRef.current && !emojiRef.current.contains(e.target)) setShowEmoji(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const insertEmoji = (emoji) => {
    const el = textareaRef.current;
    if (!el) { setInput((v) => v + emoji); return; }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const newVal = input.slice(0, start) + emoji + input.slice(end);
    setInput(newVal);
    setShowEmoji(false);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  // Handle image paste from clipboard
  const handlePaste = async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItem = items.find((item) => item.type.startsWith('image/'));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    const dataUrl = await resizeImage(file);
    setImagePreview(dataUrl);
  };

  // Handle image file selected from gallery or camera
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await resizeImage(file);
    setImagePreview(dataUrl);
    e.target.value = '';
  };


  const other = !conversation.isGroup
    ? conversation.participants?.find((p) => p._id !== user?._id)
    : null;
  const name = conversation.isGroup ? conversation.name : other?.name || 'Unknown';
  const isOnline = !conversation.isGroup && (onlineUsers.has(other?._id) || other?.isOnline);

  // Load messages
  useEffect(() => {
    setLoading(true);
    setMessages([]);
    messagesAPI
      .getMessages(conversation._id)
      .then((res) => setMessages(res.data))
      .finally(() => setLoading(false));
  }, [conversation._id]);

  // Socket events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.emit('joinConversation', conversation._id);
    socket.emit('markRead', { conversationId: conversation._id });

    const onNewMessage = ({ conversationId, message }) => {
      if (conversationId === conversation._id) {
        setMessages((prev) => {
          // Already have this exact message
          if (prev.find((m) => m._id === message._id)) return prev;
          // Replace our own optimistic temp message with the real one
          const tempIdx = prev.findIndex((m) => m._temp && m.sender?._id === message.sender?._id);
          if (tempIdx !== -1) {
            const next = [...prev];
            next[tempIdx] = message;
            return next;
          }
          return [...prev, message];
        });
        socket.emit('markRead', { conversationId });
      }
    };

    const onTyping = ({ conversationId, userId: uid, userName }) => {
      if (conversationId === conversation._id && uid !== user._id) {
        setTyping((prev) =>
          prev.find((t) => t.userId === uid) ? prev : [...prev, { userId: uid, userName }]
        );
      }
    };

    const onStopTyping = ({ conversationId, userId: uid }) => {
      if (conversationId === conversation._id) {
        setTyping((prev) => prev.filter((t) => t.userId !== uid));
      }
    };

    socket.on('newMessage', onNewMessage);
    socket.on('userTyping', onTyping);
    socket.on('userStopTyping', onStopTyping);

    return () => {
      socket.emit('leaveConversation', conversation._id);
      socket.off('newMessage', onNewMessage);
      socket.off('userTyping', onTyping);
      socket.off('userStopTyping', onStopTyping);
    };
  }, [conversation._id, getSocket, user._id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const handleInputChange = (e) => {
    setInput(e.target.value);
    const socket = getSocket();
    if (!socket) return;

    socket.emit('typing', { conversationId: conversation._id });
    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('stopTyping', { conversationId: conversation._id });
    }, 1500);
  };

  const sendMessage = async (e) => {
    e?.preventDefault();

    // ── Image send ──
    if (imagePreview) {
      const dataUrl = imagePreview;
      setImagePreview(null);
      setSending(true);
      const tempMsg = {
        _id: `temp-${Date.now()}`,
        content: dataUrl,
        type: 'image',
        sender: user,
        createdAt: new Date().toISOString(),
        readBy: [user._id],
        _temp: true,
      };
      setMessages((prev) => [...prev, tempMsg]);
      try {
        const socket = getSocket();
        if (socket?.connected) {
          socket.emit('sendMessage', { conversationId: conversation._id, content: dataUrl, type: 'image' });
        } else {
          const res = await messagesAPI.sendMessage(conversation._id, { content: dataUrl, type: 'image' });
          setMessages((prev) => prev.map((m) => (m._id === tempMsg._id ? res.data : m)));
        }
      } catch {
        setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
        setImagePreview(dataUrl);
      } finally {
        setSending(false);
      }
      return;
    }

    // ── Text send ──
    const content = input.trim();
    if (!content || sending) return;

    setInput('');
    const replyRef = replyingTo;
    setReplyingTo(null);
    setSending(true);

    const tempMsg = {
      _id: `temp-${Date.now()}`,
      content,
      type: 'text',
      sender: user,
      createdAt: new Date().toISOString(),
      readBy: [user._id],
      replyTo: replyRef || null,
      _temp: true,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const socket = getSocket();
      if (socket?.connected) {
        socket.emit('sendMessage', {
          conversationId: conversation._id,
          content,
          replyTo: replyRef?._id || null,
        });
        socket.emit('stopTyping', { conversationId: conversation._id });
      } else {
        const res = await messagesAPI.sendMessage(conversation._id, {
          content,
          replyTo: replyRef?._id || null,
        });
        setMessages((prev) => prev.map((m) => (m._id === tempMsg._id ? res.data : m)));
      }
    } catch {
      setMessages((prev) => prev.filter((m) => m._id !== tempMsg._id));
      setInput(content);
      setReplyingTo(replyRef);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-3">
        {onBack && (
          <button onClick={onBack} className="p-1 hover:bg-gray-100 rounded-lg md:hidden">
            <ArrowLeft className="h-5 w-5 text-gray-500" />
          </button>
        )}
        <div className="relative">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold"
            style={{ backgroundColor: conversation.isGroup ? '#6B7280' : other?.color || '#6B7280' }}
          >
            {conversation.isGroup
              ? <Users className="h-5 w-5" />
              : name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
          </div>
          {isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white" />
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-gray-900">{name}</p>
          <p className="text-xs text-gray-500">
            {conversation.isGroup
              ? `${conversation.participants?.length} members`
              : isOnline
              ? 'Online'
              : other?.lastSeen
              ? `Last seen ${format(new Date(other.lastSeen), 'MMM d, HH:mm')}`
              : 'Offline'}
          </p>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 flex-shrink-0">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 scrollbar-thin">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <p className="text-sm">No messages yet. Say hello!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMine = msg.sender?._id === user._id || msg.sender === user._id;
            const showDivider = shouldShowDateDivider(messages, i);
            const showAvatar =
              !isMine &&
              (i === messages.length - 1 ||
                messages[i + 1]?.sender?._id !== msg.sender?._id);

            return (
              <div key={msg._id}>
                {showDivider && (
                  <div className="flex items-center gap-3 my-4">
                    <div className="flex-1 h-px bg-gray-200" />
                    <span className="text-xs text-gray-400 bg-gray-100 px-3 py-1 rounded-full">
                      {formatDateDivider(msg.createdAt)}
                    </span>
                    <div className="flex-1 h-px bg-gray-200" />
                  </div>
                )}

                <div className={`flex items-end gap-1 mb-1 group ${isMine ? 'flex-row-reverse' : ''}`}>
                  {/* Avatar for group chats */}
                  {!isMine && conversation.isGroup && (
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mb-1"
                      style={{ backgroundColor: msg.sender?.color || '#6B7280', opacity: showAvatar ? 1 : 0 }}
                    >
                      {msg.sender?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </div>
                  )}

                  {/* Reply button — visible on hover (desktop) or always subtle (mobile) */}
                  <button
                    onClick={() => { setReplyingTo(msg); textareaRef.current?.focus(); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full flex-shrink-0 self-center"
                    title="Reply"
                  >
                    <CornerUpLeft className="h-3.5 w-3.5" />
                  </button>

                  <div className={`max-w-[70%] ${isMine ? 'items-end' : 'items-start'} flex flex-col`}>
                    {/* Sender name in groups */}
                    {!isMine && conversation.isGroup && i === 0 ||
                    (!isMine && conversation.isGroup && messages[i - 1]?.sender?._id !== msg.sender?._id) ? (
                      <p className="text-xs text-gray-500 mb-1 px-1">{msg.sender?.name}</p>
                    ) : null}

                    <div
                      className={`rounded-2xl text-sm overflow-hidden ${
                        msg.type === 'image' ? 'p-0' : 'px-3 py-2'
                      } ${
                        isMine
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white text-gray-900 shadow-sm border border-gray-100 rounded-bl-sm'
                      } ${msg._temp ? 'opacity-70' : ''}`}
                    >
                      {/* Quoted reply block */}
                      {msg.replyTo && (
                        <div className={`mb-2 px-2 py-1.5 rounded-lg text-xs border-l-2 ${
                          isMine
                            ? 'bg-blue-500/40 border-white/60 text-blue-100'
                            : 'bg-gray-100 border-blue-400 text-gray-600'
                        }`}>
                          <p className="font-semibold mb-0.5">
                            {msg.replyTo.sender?.name || 'Unknown'}
                          </p>
                          <p className="truncate opacity-80">
                            {msg.replyTo.type === 'image' ? '📷 Photo' : msg.replyTo.content || '…'}
                          </p>
                        </div>
                      )}
                      {msg.type === 'image' ? (
                        <img
                          src={msg.content}
                          alt="Sent image"
                          className="max-w-[260px] max-h-[320px] object-cover rounded-2xl cursor-pointer"
                          onClick={() => window.open(msg.content, '_blank')}
                        />
                      ) : (
                        <MessageText content={msg.content} isMine={isMine} />
                      )}
                    </div>

                    <div className={`flex items-center gap-1 mt-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                      <span className="text-xs text-gray-400">{formatMsgTime(msg.createdAt)}</span>
                      {isMine && !msg._temp && (
                        msg.readBy?.length > 1
                          ? <CheckCheck className="h-3 w-3 text-blue-400" />
                          : <Check className="h-3 w-3 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Typing indicator */}
        {typing.length > 0 && (
          <div className="flex items-end gap-2">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
            <p className="text-xs text-gray-400">
              {typing.map((t) => t.userName.split(' ')[0]).join(', ')} typing...
            </p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Hidden file inputs */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />

      {/* Input */}
      <div className="bg-white border-t border-gray-200">
        {/* Image preview bar */}
        {imagePreview && (
          <div className="flex items-center gap-3 px-3 pt-2 pb-1 bg-gray-50 border-b border-gray-200">
            <img src={imagePreview} alt="Preview" className="w-14 h-14 object-cover rounded-lg border border-gray-200 flex-shrink-0" />
            <div className="flex-1 text-xs text-gray-500">Ready to send</div>
            <button type="button" onClick={() => setImagePreview(null)} className="p-1 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {/* Reply preview bar */}
        {replyingTo && (
          <div className="flex items-center gap-2 px-3 pt-2 pb-1 bg-blue-50 border-b border-blue-100">
            <CornerUpLeft className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-blue-700">{replyingTo.sender?.name || 'Unknown'}</p>
              <p className="text-xs text-blue-600 truncate">{replyingTo.content}</p>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-1 text-blue-400 hover:text-blue-600 rounded-full hover:bg-blue-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
        <form onSubmit={sendMessage} className="flex items-end gap-2 p-3">
          {/* Emoji picker */}
          <div ref={emojiRef} className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => setShowEmoji((v) => !v)}
              className="w-9 h-9 flex items-center justify-center text-gray-400 hover:text-yellow-500 hover:bg-gray-100 rounded-full transition-colors"
            >
              <Smile className="h-5 w-5" />
            </button>
            {showEmoji && <EmojiPicker onSelect={insertEmoji} />}
          </div>

          {/* Gallery picker */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-blue-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Send image"
          >
            <ImageIcon className="h-5 w-5" />
          </button>

          {/* Camera */}
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex-shrink-0 w-9 h-9 flex items-center justify-center text-gray-400 hover:text-green-500 hover:bg-gray-100 rounded-full transition-colors"
            title="Take photo"
          >
            <Camera className="h-5 w-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={imagePreview ? 'Image ready — press send' : 'Type a message...'}
            rows={1}
            className="flex-1 px-4 py-2.5 bg-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none max-h-32 scrollbar-thin"
            style={{ height: 'auto' }}
            onInput={(e) => {
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={(!input.trim() && !imagePreview) || sending}
            className="flex-shrink-0 w-10 h-10 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
