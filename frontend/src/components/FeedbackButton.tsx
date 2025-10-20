import React, { useState } from 'react';
import { FeedbackModal } from './FeedbackModal';

export const FeedbackButton: React.FC = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn btn-primary"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '24px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          zIndex: 1000,
          border: 'none'
        }}
        title="Send Feedback or Report a Bug"
      >
        <i className="bi bi-chat-dots"></i>
      </button>

      <FeedbackModal
        show={showModal}
        onHide={() => setShowModal(false)}
      />
    </>
  );
};
