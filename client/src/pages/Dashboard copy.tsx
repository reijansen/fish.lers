// src/pages/Dashboard.tsx
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="p-6 space-y-3">
      <h1 className="text-xl font-semibold">hi, {user?.displayName ?? user?.email}</h1>
      <button className="px-3 py-2 rounded bg-gray-900 text-white" onClick={() => signOut(auth)}>
        sign out
      </button>
    </div>
  );
}
