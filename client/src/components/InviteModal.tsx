import React, { useState } from 'react';
import { Copy, Check, X, ShieldCheck, Link } from 'lucide-react';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  inviteSecret: string;
}

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  roomId,
  inviteSecret,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  if (!isOpen) return null;

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
    roomId
  )}&invite=${encodeURIComponent(inviteSecret)}`;

  const copyToClipboard = async (text: string, isLink: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isLink) {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      } else {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      }
    } catch {
      alert('Copied: ' + text);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Link size={20} color="var(--accent-primary)" />
            <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Invite to Watch Party
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '18px', lineHeight: 1.5 }}>
          Send this private one-click link to your guest so they can join immediately.
        </p>

        {/* Full One-Click Link */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--accent-primary)', marginBottom: '6px', fontWeight: 500 }}>
            Private Invitation Link:
          </label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="form-input"
              style={{ fontSize: '0.85rem' }}
            />
            <button
              className="btn-primary"
              onClick={() => copyToClipboard(inviteUrl, true)}
              style={{ padding: '0 18px', flexShrink: 0 }}
            >
              {copiedLink ? <Check size={18} /> : <Copy size={18} />}
              <span>{copiedLink ? 'Copied!' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Room Code breakdown */}
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Room ID</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-primary)' }}>{roomId}</div>
          </div>
          <button
            className="btn-secondary"
            onClick={() => copyToClipboard(roomId, false)}
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
          >
            {copiedCode ? <Check size={14} /> : <Copy size={14} />}
            <span>{copiedCode ? 'Copied' : 'Copy ID'}</span>
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
          <ShieldCheck size={16} color="var(--accent-primary)" />
          <span>Only 2 people can enter. Strangers cannot join.</span>
        </div>
      </div>
    </div>
  );
};
