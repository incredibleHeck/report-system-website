import { useActiveClass, useDatabase } from '../../context/DatabaseContext';
import { normalizeGhanaPhone } from '../../lib/phone';

export default function ContactsPage() {
  const { activeClass, classStudents } = useActiveClass();
  const { contacts, upsertContact } = useDatabase();

  if (!activeClass) return <p className="text-slate-500">No active class.</p>;

  const rows = classStudents.map((st) => {
      const contact =
        contacts.find((c) => c.studentId === st.id && c.classId === activeClass.id) || {
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Contact List</h1>
        <p className="text-sm text-slate-500">
          Use Ghana numbers with country code (233…). Leading 0 is auto-normalized.
        </p>
      </div>

      <div className="overflow-x-auto bg-white border border-slate-200 rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 text-left">Student</th>
              <th className="px-3 py-2 text-left">Phone</th>
              <th className="px-3 py-2 text-left">Email</th>
              <th className="px-3 py-2">WhatsApp</th>
              <th className="px-3 py-2">Email Status</th>
              <th className="px-3 py-2">PDF</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ st, contact }) => {
              const phoneCheck = contact.phone ? normalizeGhanaPhone(contact.phone) : null;
              return (
                <tr key={st.id} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-medium whitespace-nowrap">{st.name}</td>
                  <td className="px-3 py-2">
                    <input
                      className={`w-40 rounded border px-2 py-1 ${
                        phoneCheck && !phoneCheck.ok ? 'border-rose-400' : 'border-slate-300'
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
                          upsertContact({ ...contact, phone: n.e164 });
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
                      className="w-56 rounded border border-slate-300 px-2 py-1"
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
                  <td className="px-3 py-2 text-center text-xs">{contact.whatsappStatus || '—'}</td>
                  <td className="px-3 py-2 text-center text-xs">{contact.emailStatus || '—'}</td>
                  <td className="px-3 py-2 text-center text-xs">
                    {contact.pdfId ? 'EOT' : ''}
                    {contact.midtermPdfId ? ' MT' : ''}
                    {!contact.pdfId && !contact.midtermPdfId ? '—' : ''}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
