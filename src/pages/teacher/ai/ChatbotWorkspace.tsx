import { useState } from 'react';
import { useActiveClass, useDatabase } from '../../../context/DatabaseContext';
import { buildChatPrompt } from '../../../lib/ai/prompts';
import { generateWithGemini } from '../../../lib/ai/geminiClient';
import { firstName } from '../../../lib/gender';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatbotWorkspace() {
  const { activeClass, classStudents } = useActiveClass();
  const { students } = useDatabase();
  const [studentId, setStudentId] = useState('');
  const [tone, setTone] = useState<'warm' | 'strict' | 'general'>('warm');
  const [selectedText, setSelectedText] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);
  const [option, setOption] = useState('');
  const student = classStudents.find((s) => s.id === (studentId || classStudents[0]?.id));

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const send = async () => {
    if (!input.trim()) return;
    const nextMessages: Msg[] = [...messages, { role: 'user', content: input.trim() }];
    setMessages(nextMessages);
    setInput('');
    setBusy(true);
    try {
      const prompt = buildChatPrompt({
        message: input.trim(),
        tone,
        studentName: student
          ? firstName(student.name, activeClass.settings.nameFormat)
          : undefined,
        gender: student?.gender,
        selectedText,
        history: nextMessages.slice(-8),
      });
      const res = await generateWithGemini(prompt, false);
      const text = res.text || '';
      setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
      const match = text.match(/OPTION_START\s*([\s\S]*?)\s*OPTION_END/i);
      if (match) setOption(match[1].trim());
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e instanceof Error ? e.message : 'Error' },
      ]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AI Chatbot Workspace</h1>
        <p className="text-sm text-slate-500">Creative partner for comment drafting</p>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="bg-slate-950 text-slate-100 rounded-xl p-4 space-y-3 border border-slate-800">
          <label className="block text-xs text-slate-400">
            Student
            <select
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
              value={student?.id || ''}
              onChange={(e) => setStudentId(e.target.value)}
            >
              {classStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Tone
            <select
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm"
              value={tone}
              onChange={(e) => setTone(e.target.value as typeof tone)}
            >
              <option value="warm">Warm</option>
              <option value="strict">Strict</option>
              <option value="general">General</option>
            </select>
          </label>
          <label className="block text-xs text-slate-400">
            Selected text / draft
            <textarea
              className="mt-1 w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-sm min-h-[100px]"
              value={selectedText}
              onChange={(e) => setSelectedText(e.target.value)}
            />
          </label>
          {option && (
            <div className="space-y-2">
              <p className="text-xs text-sais-brown-light">Suggested option</p>
              <p className="text-xs bg-slate-900 border border-slate-700 rounded-lg p-2">{option}</p>
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded bg-sais-red py-1.5 text-xs"
                  onClick={() => setSelectedText(option)}
                >
                  Insert
                </button>
                <button
                  className="flex-1 rounded border border-slate-600 py-1.5 text-xs"
                  onClick={() =>
                    setSelectedText((prev) => (prev ? `${prev} ${option}` : option))
                  }
                >
                  Append
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl flex flex-col min-h-[480px]">
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'ml-auto bg-sais-red text-white'
                    : 'bg-slate-100 text-slate-800'
                }`}
              >
                {m.content}
              </div>
            ))}
            {!messages.length && (
              <p className="text-sm text-slate-400">Ask for rewrites, alternatives, or tone changes.</p>
            )}
          </div>
          <div className="border-t border-slate-200 p-3 flex gap-2">
            <input
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Message HecTech AI…"
              disabled={busy}
            />
            <button
              onClick={send}
              disabled={busy}
              className="rounded-lg bg-slate-900 text-white px-4 py-2 text-sm disabled:opacity-50"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
