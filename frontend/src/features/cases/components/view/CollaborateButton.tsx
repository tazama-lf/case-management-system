import React from 'react';

interface CollaborateButtonProps {
  onClick?: () => void;
}

const CollaborateButton: React.FC<CollaborateButtonProps> = ({ onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-green-700"
      title="Collaborate"
    >
      <span className="text-base">👥</span>
      Collaborate
    </button>
  );
};

export default CollaborateButton;
