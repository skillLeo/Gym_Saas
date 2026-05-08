'use client';

import { useUser } from '@/contexts/UserContext';

export function RoleSwitcher() {
  const { role, setRole } = useUser();
  return (
    <div className="fixed bottom-24 left-4 z-50 md:bottom-6">
      <div className="bg-gray-900 dark:bg-black text-white rounded-xl px-3 py-2 text-xs flex items-center gap-2 shadow-xl border border-white/10">
        <span className="text-gray-400">DEV:</span>
        <button
          onClick={() => setRole('member')}
          className={`px-2 py-0.5 rounded-lg font-medium transition-all ${role === 'member' ? 'bg-[#F87404] text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Member
        </button>
        <button
          onClick={() => setRole('admin')}
          className={`px-2 py-0.5 rounded-lg font-medium transition-all ${role === 'admin' ? 'bg-[#004AAD] text-white' : 'text-gray-400 hover:text-white'}`}
        >
          Admin
        </button>
      </div>
    </div>
  );
}
