import React from 'react';
import { UsersIcon } from '@heroicons/react/24/outline';

interface CollaborateButtonProps {
  onClick?: () => void;
}

const CollaborateButton: React.FC<CollaborateButtonProps> = ({ onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-green-700"
    title="Collaborate"
  >
    <UsersIcon className="h-4 w-4" />
    Collaborate
  </button>
);

export default CollaborateButton;
