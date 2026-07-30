import React, { useState, useRef } from 'react';
import type { TranscriptDocumentModel } from '../../lib/transcript';
import { termHeading } from '../../lib/transcript';
import { formatDateLong } from '../../lib/term';

type Props = {
  model: TranscriptDocumentModel;
  schoolName?: string;
  principalSignature?: string;
};

const SAIS_DEFAULTS = {
  name: 'St. Adelaide International Schools',
  address: 'P. O. Box DS 75, Dansoman – Accra',
  website: 'www.saintadelaideschools.org',
  email: 'info@saintadelaideschools.org, st.adelaideschools@gmail.com',
  tel: '020 798 8167 / 027 064 0112 / 024 597 0186',
};

function SignaturePad() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    if ('touches' in e && e.touches.length > 0) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      };
    } else if ('clientX' in e) {
      return {
        x: (e as React.MouseEvent<HTMLCanvasElement>).clientX - rect.left,
        y: (e as React.MouseEvent<HTMLCanvasElement>).clientY - rect.top,
      };
    }
    return { x: 0, y: 0 };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    setIsDrawing(true);
    const { x, y } = getCoordinates(e);
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(x, y);
      }
    }
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || !canvasRef.current) return;
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  return (
    <div className="relative inline-flex items-center gap-2">
      <div className="border-b border-black bg-slate-50/50 hover:bg-slate-100/50 transition-colors inline-block">
        <canvas
          ref={canvasRef}
          width={200}
          height={48}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          className="cursor-crosshair touch-none block"
        />
      </div>
      <button
        type="button"
        onClick={clearCanvas}
        className="print:hidden text-[10px] px-2 py-0.5 rounded bg-red-100 hover:bg-red-200 text-red-800 font-semibold border border-red-200 transition-colors select-none"
        title="Clear Signature"
      >
        Clear
      </button>
    </div>
  );
}

function getGradeComment(grade: string, totalScore: number): string {
  const g = (grade || '').trim().toUpperCase();
  if (g === 'A*') return 'EXCELLENT';
  if (g === 'A') return 'VERY GOOD';
  if (g === 'B') return 'GOOD';
  if (g === 'C') return 'SATISFACTORY';
  if (g === 'D') return 'PASS';
  if (g === 'E') return 'BELOW AVERAGE';
  if (g === 'U') return 'UNGRADED';

  if (totalScore >= 90) return 'EXCELLENT';
  if (totalScore >= 80) return 'VERY GOOD';
  if (totalScore >= 70) return 'GOOD';
  if (totalScore >= 60) return 'SATISFACTORY';
  if (totalScore >= 50) return 'PASS';
  if (totalScore >= 40) return 'BELOW AVERAGE';
  return 'UNGRADED';
}

export default function TranscriptDocument({ model, schoolName, principalSignature }: Props) {
  const { student, blocks, cumulativeAverage, cumulativeGrade } = model;
  const name = schoolName || SAIS_DEFAULTS.name;

  const [issuerName, setIssuerName] = useState('PRINCE ANDREW DUNYOH');
  const [issuerTitle, setIssuerTitle] = useState('Principal');
  const [studyStartDate, setStudyStartDate] = useState('2021-12-01');
  const [studyEndDate, setStudyEndDate] = useState('2024-05-31');
  const [issueDate, setIssueDate] = useState(() => new Date().toISOString().split('T')[0]);

  return (
    <article id="transcript-pdf-root" className="transcript-doc bg-sais-white text-sais-black w-full max-w-[210mm] min-h-[297mm] px-6 py-6 print:px-0 print:py-0 space-y-4">
      <header className="border-b-2 border-sais-red pb-2">
        <div className="flex items-start gap-8">
          <img
            src="/sais-logo.png"
            alt="St. Adelaide International Schools"
            className="h-24 w-auto object-contain flex-shrink-0"
          />
          <div className="min-w-0 flex-1 pt-1">
            <h1 className="text-xl sm:text-2xl font-bold font-display text-sais-black leading-tight">
              {name}
            </h1>
            <div className="mt-1.5 text-[12px] sm:text-sm text-sais-black leading-snug space-y-0.5">
              <p>{SAIS_DEFAULTS.address}</p>
              <p>
                website:{' '}
                <span className="text-sais-red underline">{SAIS_DEFAULTS.website}</span>
              </p>
              <p>
                email: <span className="text-sais-red">{SAIS_DEFAULTS.email}</span>
              </p>
              <p>Tel: {SAIS_DEFAULTS.tel}</p>
            </div>
          </div>
        </div>
        <h2 className="mt-2 text-center text-lg font-semibold font-display text-sais-brown tracking-wide">
          Official Student Transcript
        </h2>
      </header>

      <section className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4 border border-sais-brown/30 rounded-lg p-3 bg-sais-brown/5">
        <p>
          <span className="block text-[12px] uppercase tracking-wide text-sais-muted">Name</span>
          <span className="font-semibold text-sais-black">{student.name}</span>
        </p>
        <p>
          <span className="block text-[12px] uppercase tracking-wide text-sais-muted">Student Key</span>
          <span className="font-mono font-semibold text-sais-black">{student.studentKey}</span>
        </p>
        <p>
          <span className="block text-[12px] uppercase tracking-wide text-sais-muted">Year joined</span>
          <span className="font-semibold text-sais-black">{student.yearJoined}</span>
        </p>
        <p>
          <span className="block text-[12px] uppercase tracking-wide text-sais-muted">Status</span>
          <span className="font-semibold capitalize text-sais-black">{student.status}</span>
        </p>
        <p className="col-span-2 sm:col-span-4 border-t border-sais-brown/20 pt-2 mt-1">
          <span className="inline-block text-[12px] uppercase tracking-wide text-sais-muted mr-3">Cumulative CGPA:</span>
          <span className="font-semibold text-lg text-sais-black">
            {cumulativeAverage > 0 ? `${cumulativeAverage} (${cumulativeGrade})` : '—'}
          </span>
        </p>
      </section>

      {blocks.length === 0 ? (
        <p className="text-sm text-sais-muted">No enrolled terms on record.</p>
      ) : (
        <div className="space-y-3">
          {blocks.map((block) => (
            <section
              key={block.termKey + block.className}
              className="term-block avoid-break border border-sais-brown/30 rounded-lg overflow-hidden print:border-sais-brown/50 print:break-inside-avoid"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-1.5 bg-sais-brown/10 border-b border-sais-brown/20">
                <h3 className="text-sm font-semibold text-sais-black">
                  {termHeading(block.academicYear, block.termCode)}
                </h3>
                <p className="text-[12px] text-sais-muted">
                  {block.className} · {block.programme} · Roll {block.rollNumber}
                </p>
              </div>

              <div className="p-2">
                {block.kind === 'missing' ? (
                  <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                    Report not finalized for this enrolled term.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-[12px] mb-2">
                      <p>
                        <span className="text-sais-muted">Average:</span>{' '}
                        <span className="font-semibold text-sais-black">
                          {block.averageScore ?? '—'} ({block.aveGrade ?? '—'})
                        </span>
                      </p>
                      <p>
                        <span className="text-sais-muted">Rank:</span>{' '}
                        <span className="font-semibold text-sais-black">
                          {block.rank ?? '—'}
                        </span>
                      </p>
                      <p>
                        <span className="text-sais-muted">Teacher:</span>{' '}
                        <span className="font-semibold text-sais-black">
                          {block.teacherName || '—'}
                        </span>
                      </p>
                    </div>
                    <table className="w-full text-[12px] border-collapse border border-sais-brown/30">
                      <thead>
                        <tr className="text-left bg-sais-black text-sais-white">
                          <th className="py-1 px-2 font-semibold">Subject</th>
                          <th className="py-1 px-2 w-20 font-semibold text-center">Score</th>
                          <th className="py-1 px-2 w-16 font-semibold text-center">Grade</th>
                          <th className="py-1 px-2 w-36 font-semibold text-left">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {block.subjectLines
                          .filter((line) => line.code !== 'MUSIC' && line.code !== 'PROJ')
                          .map((line) => (
                            <tr
                              key={line.code}
                              className="border-b border-sais-brown/20 last:border-b-0"
                            >
                              <td className="py-1 px-2 border-r border-sais-brown/15">
                                {line.name}
                              </td>
                              <td className="py-1 px-2 font-mono border-r border-sais-brown/15 text-center">
                                {line.totalScore}
                              </td>
                              <td className="py-1 px-2 font-semibold border-r border-sais-brown/15 text-center">
                                {line.grade}
                              </td>
                              <td className="py-1 px-2 font-medium text-[12px] text-sais-black">
                                {getGradeComment(line.grade, line.totalScore)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* KEYS TO GRADING TABLE */}
      <section className="avoid-break print:break-inside-avoid">
        <table className="w-full text-[12px] border-collapse border border-black text-center font-sans">
          <thead>
            <tr className="bg-gray-100 border-b border-black">
              <th colSpan={7} className="py-1 px-2 font-bold uppercase tracking-wider">
                KEYS TO GRADING
              </th>
            </tr>
          </thead>
          <tbody>
            <tr className="font-semibold">
              <td className="border border-black py-1 px-1">
                A*-90-100<br />(EXCELLENT)
              </td>
              <td className="border border-black py-1 px-1">
                A - 80-89<br />(VERY GOOD)
              </td>
              <td className="border border-black py-1 px-1">
                B - 70-79<br />(GOOD )
              </td>
              <td className="border border-black py-1 px-1">
                C – 60-69<br />(SATISFACTORY)
              </td>
              <td className="border border-black py-1 px-1">
                D- 50-59<br />(PASS)
              </td>
              <td className="border border-black py-1 px-1">
                E – 40 - 49<br />(BELOW AVERAGE)
              </td>
              <td className="border border-black py-1 px-1">
                U – 0-39<br />(UNGRADED)
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* CERTIFICATION & ISSUER SIGNATURE BOX */}
      <section className="avoid-break border border-black p-4 text-[12px] font-sans space-y-3 print:break-inside-avoid">
        <p className="leading-relaxed text-[12px] text-black">
          I do hereby certify that this is the official transcript and record of{' '}
          <strong className="underline text-black font-bold px-1 text-base">{student.name}</strong>, for the
          academic studies from{' '}
          <span className="font-bold underline px-1 print:inline hidden">{formatDateLong(studyStartDate)}</span>
          <input
            type="date"
            value={studyStartDate}
            onChange={(e) => setStudyStartDate(e.target.value)}
            className="border-b border-dotted border-gray-600 font-medium px-1 py-0.5 text-sm sm:text-base focus:outline-none focus:border-black print:hidden cursor-pointer"
            style={{ width: '150px' }}
          />{' '}
          to{' '}
          <span className="font-bold underline px-1 print:inline hidden">{formatDateLong(studyEndDate)}</span>
          <input
            type="date"
            value={studyEndDate}
            onChange={(e) => setStudyEndDate(e.target.value)}
            className="border-b border-dotted border-gray-600 font-medium px-1 py-0.5 text-sm sm:text-base focus:outline-none focus:border-black print:hidden cursor-pointer"
            style={{ width: '150px' }}
          />
          . Any erasure and/or alteration of any part of this transcript renders it valueless.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end pt-2 text-[12px]">
          <div className="space-y-2">
            <div>
              <span className="font-semibold text-black">Name: </span>
              <input
                type="text"
                value={issuerName}
                onChange={(e) => setIssuerName(e.target.value)}
                className="font-bold uppercase border-b border-dotted border-gray-600 px-1 py-0.5 text-sm sm:text-base focus:outline-none focus:border-black print:border-none print:p-0"
                style={{ width: '190px' }}
              />
            </div>
            <div>
              <span className="font-semibold text-black">Date: </span>
              <span className="font-bold border-b border-gray-600 px-1 text-sm sm:text-base print:inline hidden">{formatDateLong(issueDate)}</span>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="border-b border-dotted border-gray-600 px-1 py-0.5 text-sm sm:text-base focus:outline-none focus:border-black print:hidden cursor-pointer"
                style={{ width: '150px' }}
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-semibold text-black self-center">Signature: </span>
            {principalSignature ? (
              <div className="border-b border-black inline-block px-2 py-0.5">
                <img
                  src={principalSignature}
                  alt="Principal Signature & Stamp"
                  className="h-12 w-auto max-w-[200px] object-contain block"
                />
              </div>
            ) : (
              <SignaturePad />
            )}
          </div>

          <div className="sm:text-right">
            <span className="font-semibold text-black">Title: </span>
            <input
              type="text"
              value={issuerTitle}
              onChange={(e) => setIssuerTitle(e.target.value)}
              className="border-b border-dotted border-gray-600 px-1 py-0.5 text-sm sm:text-base focus:outline-none focus:border-black print:border-none print:p-0"
              style={{ width: '130px' }}
            />
          </div>
        </div>
      </section>
    </article>
  );
}
