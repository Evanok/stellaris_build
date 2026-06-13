import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../AuthContext';

interface ChatMessage {
  id: number;
  content: string;
  author_name: string;
  is_guest: number;
  created_at: string;
  avatar: string | null;
}

const GUEST_NAME_KEY = 'chat_guest_name';
const POLL_INTERVAL_MS = 8000;

const ChatPanel: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.is_admin === 1;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [guestName, setGuestName] = useState(() => localStorage.getItem(GUEST_NAME_KEY) || '');
  const [showNamePrompt, setShowNamePrompt] = useState(false);
  const [tempName, setTempName] = useState('');
  const [nameError, setNameError] = useState('');
  const [postError, setPostError] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/chat');
      if (!res.ok) return;
      const data: ChatMessage[] = await res.json();
      setMessages(() => {
        // Only scroll to bottom if already near the bottom
        const list = listRef.current;
        const wasAtBottom = list
          ? list.scrollHeight - list.scrollTop - list.clientHeight < 80
          : true;
        if (wasAtBottom) {
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
        }
        return data;
      });
    } catch {
      // silent — polling will retry
    }
  };

  useEffect(() => {
    fetchMessages();
    const id = setInterval(fetchMessages, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  // Scroll to bottom on first load
  useEffect(() => {
    if (messages.length > 0) {
      bottomRef.current?.scrollIntoView();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    if (!user && !guestName) {
      setTempName('');
      setNameError('');
      setShowNamePrompt(true);
      return;
    }

    setIsPosting(true);
    setPostError('');

    try {
      const body: Record<string, string> = { content: trimmed };
      if (!user) body.guest_name = guestName;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setPostError(data.error || 'Failed to send message');
        return;
      }

      setInput('');
      await fetchMessages();
    } catch {
      setPostError('Network error, please try again');
    } finally {
      setIsPosting(false);
    }
  };

  const handleNameSubmit = () => {
    const name = tempName.trim();
    if (name.length < 2 || name.length > 20) {
      setNameError('Name must be 2–20 characters');
      return;
    }
    if (!/^[a-zA-Z0-9 _-]+$/.test(name)) {
      setNameError('Alphanumeric, spaces, _ and - only');
      return;
    }
    localStorage.setItem(GUEST_NAME_KEY, name);
    setGuestName(name);
    setShowNamePrompt(false);
  };

  const handleDelete = async () => {
    if (deleteTarget === null) return;
    try {
      await fetch(`/api/chat/${deleteTarget}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await fetchMessages();
    } catch {
      setDeleteTarget(null);
    }
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const displayName = user ? (user.display_name || user.username) : guestName;

  return (
    <div className="card bg-dark border-secondary h-100 d-flex flex-column" style={{ minHeight: '500px' }}>
      <div className="card-header border-secondary d-flex align-items-center justify-content-between py-2">
        <span className="fw-bold text-white">
          <i className="bi bi-chat-dots me-2 text-info"></i>Community Chat
        </span>
        {!user && guestName && (
          <small className="text-muted">
            As: <span className="text-info">{guestName}</span>
            <button
              className="btn btn-link btn-sm text-muted p-0 ms-1"
              title="Change name"
              onClick={() => { setTempName(guestName); setNameError(''); setShowNamePrompt(true); }}
            >
              <i className="bi bi-pencil" style={{ fontSize: '0.7rem' }}></i>
            </button>
          </small>
        )}
      </div>

      {/* Message list */}
      <div
        ref={listRef}
        className="flex-grow-1 overflow-auto p-2"
        style={{ maxHeight: '420px' }}
      >
        {messages.length === 0 ? (
          <p className="text-muted text-center mt-4 small">No messages yet — be the first!</p>
        ) : (
          messages.map(msg => (
            <div
              key={msg.id}
              className="mb-2 d-flex align-items-start gap-2"
            >
              {msg.avatar ? (
                <img
                  src={msg.avatar}
                  alt=""
                  style={{ width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, marginTop: '2px' }}
                />
              ) : (
                <div
                  style={{
                    width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0, marginTop: '2px',
                    background: msg.is_guest ? '#6c757d' : '#0dcaf0',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.65rem', fontWeight: 'bold', color: '#000'
                  }}
                >
                  {msg.author_name[0].toUpperCase()}
                </div>
              )}
              <div className="flex-grow-1" style={{ minWidth: 0 }}>
                <div className="d-flex align-items-baseline gap-2 flex-wrap">
                  <span className="fw-semibold" style={{ fontSize: '0.8rem', color: msg.is_guest ? '#adb5bd' : '#0dcaf0' }}>
                    {msg.author_name}
                    {msg.is_guest ? <span className="text-muted ms-1" style={{ fontSize: '0.7rem' }}>(guest)</span> : null}
                  </span>
                  <span className="text-muted" style={{ fontSize: '0.7rem' }}>{formatTime(msg.created_at)}</span>
                  {isAdmin && (
                    <button
                      className="btn btn-link p-0 text-danger ms-auto"
                      style={{ fontSize: '0.75rem', lineHeight: 1 }}
                      title="Delete message"
                      onClick={() => setDeleteTarget(msg.id)}
                    >
                      <i className="bi bi-x-circle"></i>
                    </button>
                  )}
                </div>
                <p className="mb-0 text-light" style={{ fontSize: '0.85rem', wordBreak: 'break-word' }}>
                  {msg.content}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div className="card-footer border-secondary p-2">
        {postError && (
          <div className="alert alert-danger py-1 px-2 mb-2 small">{postError}</div>
        )}
        <div className="input-group input-group-sm">
          <input
            type="text"
            className="form-control bg-secondary text-white border-secondary"
            placeholder={user ? `Message as ${displayName}…` : (guestName ? `Message as ${guestName}…` : 'Set a name to chat…')}
            value={input}
            maxLength={300}
            onChange={e => { setInput(e.target.value); setPostError(''); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={isPosting}
          />
          <button
            className="btn btn-info"
            onClick={handleSend}
            disabled={isPosting || !input.trim()}
          >
            <i className="bi bi-send"></i>
          </button>
        </div>
        <div className="d-flex justify-content-between mt-1">
          <small className="text-muted">{input.length}/300</small>
          {!user && !guestName && (
            <button
              className="btn btn-link btn-sm text-info p-0"
              style={{ fontSize: '0.75rem' }}
              onClick={() => { setTempName(''); setNameError(''); setShowNamePrompt(true); }}
            >
              Set guest name
            </button>
          )}
        </div>
      </div>

      {/* Guest name prompt modal */}
      {showNamePrompt && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setShowNamePrompt(false); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-header border-secondary py-2">
                <h6 className="modal-title text-white">Choose a display name</h6>
                <button className="btn-close btn-close-white" onClick={() => setShowNamePrompt(false)} />
              </div>
              <div className="modal-body">
                <input
                  type="text"
                  className="form-control bg-secondary text-white border-secondary"
                  placeholder="Your name (2–20 chars)"
                  value={tempName}
                  maxLength={20}
                  autoFocus
                  onChange={e => { setTempName(e.target.value); setNameError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleNameSubmit(); }}
                />
                {nameError && <small className="text-danger">{nameError}</small>}
                <small className="text-muted d-block mt-1">Letters, numbers, spaces, _ and -</small>
              </div>
              <div className="modal-footer border-secondary py-2">
                <button className="btn btn-secondary btn-sm" onClick={() => setShowNamePrompt(false)}>Cancel</button>
                <button className="btn btn-info btn-sm" onClick={handleNameSubmit}>Confirm</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget !== null && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null); }}
        >
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content bg-dark border-secondary">
              <div className="modal-body text-center py-4">
                <i className="bi bi-exclamation-triangle text-warning fs-3 d-block mb-2"></i>
                <p className="text-white mb-3">Delete this message?</p>
                <button className="btn btn-danger btn-sm me-2" onClick={handleDelete}>Delete</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setDeleteTarget(null)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatPanel;
