import { useAuth } from '../../context/AuthContext';
import TranscriptsPage from '../shared/TranscriptsPage';

export default function MyTranscriptPage() {
  const { currentUser } = useAuth();
  const key = currentUser?.studentKey;

  if (!key) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
        <h1 className="text-xl font-bold">Transcript unavailable</h1>
        <p className="text-sm text-slate-500 mt-2">
          Your session has no student key. Load demo data and sign in as a student again.
        </p>
      </div>
    );
  }

  return <TranscriptsPage sessionStudentKey={key} />;
}
