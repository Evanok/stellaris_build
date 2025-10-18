import React from 'react';

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-dark border-top border-secondary mt-5 py-3">
      <div className="container">
        <div className="text-center">
          <p className="text-muted small mb-0">
            &copy; {currentYear} Stellaris Build Archive - Not affiliated with Paradox Interactive
          </p>
        </div>
      </div>
    </footer>
  );
};
