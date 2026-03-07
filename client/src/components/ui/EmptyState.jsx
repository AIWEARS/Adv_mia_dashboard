import React from 'react';
import { BarChart3 } from 'lucide-react';

function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
        <BarChart3 className="w-8 h-8 text-slate-300" />
      </div>
      <p className="text-slate-400 text-sm max-w-sm">{message}</p>
    </div>
  );
}

export default EmptyState;
