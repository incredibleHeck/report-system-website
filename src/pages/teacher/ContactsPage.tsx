import { useState } from 'react';
import { useActiveClass, useDatabase } from '../../context/DatabaseContext';
import { normalizeGhanaPhone } from '../../lib/phone';

export default function ContactsPage() {
  const { activeClass, classStudents } = useActiveClass();
  const { contacts, upsertContact } = useDatabase();
  const [query, setQuery] = useState('');

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  if (classStudents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white border border-slate-200 rounded-xl">
        <h2 className="text-xl font-semibold text-slate-800">No Students Enrolled</h2>
        <p className="text-slate-500 mt-2">There are currently no students enrolled in this class.</p>
      </div>
    );
  }

  const rows = classStudents.map((st) => {
    const contact =
      contacts.find(
        (c) =>
          (c.studentId === st.id || c.studentKey === st.studentKey) &&
          c.classId === activeClass.id
      ) || {
        id: '',
        studentId: st.id,
        classId: activeClass.id,
        phone: '',
        email: '',
        pdfId: '',
        midtermPdfId: '',
        whatsappStatus: '',
        emailStatus: '',
      };
    return { st, contact };
  });

  const filteredRows = rows.filter(({ st, contact }) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      st.name.toLowerCase().includes(q) ||
      (contact.phone && contact.phone.includes(q)) ||
      (contact.email && contact.email.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Contact List</h1>
          <p className="text-sm text-slate-500 mt-1">
            Use Ghana numbers with country code (233…). Leading 0 is auto-normalized.
          </p>
        </div>
        <div className="w-full sm:w-auto">
          <input
            className="w-full sm:w-64 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sais-red"
            placeholder="Search student or contact..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2 text-center">WhatsApp</th>
              <th className="px-3 py-2 text-center">Email Status</th>
              <th className="px-3 py-2 text-center">PDF</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                  No contacts found matching "{query}"
                </td>
              </tr>
            ) : (
              filteredRows.map(({ st, contact }) => {
                const phoneCheck = contact.phone ? normalizeGhanaPhone(contact.phone) : null;
                const isEmailInvalid = contact.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email);

                return (
                  <tr key={st.id} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium whitespace-nowrap">{st.name}</td>
                    <td className="px-3 py-2">
                      <input
                        className={`w-40 rounded border px-2 py-1 ${
                          phoneCheck && !phoneCheck.ok ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                        }`}
                        value={contact.phone}
                        onChange={(e) =>
                          upsertContact({
                            ...contact,
                            phone: e.target.value,
                          })
                        }
                        onBlur={(e) => {
                          const n = normalizeGhanaPhone(e.target.value);
                          if (n.ok) {
                            upsertContact({ ...contact, phone: n.e164, whatsappStatus: '' });
                          } else if (e.target.value) {
                            upsertContact({
                              ...contact,
                              phone: e.target.value,
                              whatsappStatus: 'INVALID FORMAT',
                            });
                          }
                        }}
                        placeholder="23324XXXXXXX"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={`w-56 rounded border px-2 py-1 ${
                          isEmailInvalid ? 'border-rose-400 bg-rose-50' : 'border-slate-300'
                        }`}
                        value={contact.email}
                        onChange={(e) =>
                          upsertContact({
                            ...contact,
                            email: e.target.value,
                          })
                        }
                        placeholder="parent@email.com"
                      />
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {phoneCheck?.ok ? (
                        <a
                          href={`https://wa.me/${phoneCheck.e164.replace('+', '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium"
                        >
                          Chat
                        </a>
                      ) : (
                        <span className="text-slate-400">{contact.whatsappStatus || '—'}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs">
                      {contact.emailStatus ? (
                        <span className="text-slate-600">{contact.emailStatus}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center text-xs text-slate-500">
                      {contact.pdfId ? 'EOT' : ''}
                      {contact.midtermPdfId ? ' MT' : ''}
                      {!contact.pdfId && !contact.midtermPdfId ? '—' : ''}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

