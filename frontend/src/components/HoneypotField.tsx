import React from 'react';

// Anti-bot trap: a "Website" field humans never see, so they leave it empty,
// while basic bots fill in every input they find. The backend silently drops
// any request where it is set. Positioned off-screen rather than display:none,
// which some bots skip.
export const HoneypotField: React.FC<{ id: string; value: string; onChange: (value: string) => void }> = ({ id, value, onChange }) => (
  <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}>
    <label htmlFor={id}>Website</label>
    <input id={id} type="text" tabIndex={-1} autoComplete="off" value={value} onChange={(e) => onChange(e.target.value)} />
  </div>
);

export default HoneypotField;
