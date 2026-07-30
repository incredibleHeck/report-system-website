import React, { useState } from 'react';
import { Building2, Upload, FileCheck, CheckCircle2, Shield, Image } from 'lucide-react';
import { useDatabase } from '../../context/DatabaseContext';

import { compressImage } from '../../lib/imageCompressor';

export default function SchoolBrandingSettings() {
  const { schools, registerSchool, updateSchool, updateSystemSettings, systemSettings, currentUser } = useDatabase();

  const school = schools[0];

  const [schoolName, setSchoolName] = useState(school?.name || 'St. Adelaide International Schools');
  const [motto, setMotto] = useState(school?.motto || 'Excellence, Character & Wisdom');
  const [address, setAddress] = useState(school?.address || 'P. O. Box DS 75, Dansoman – Accra');
  const [website, setWebsite] = useState(school?.website || 'www.saintadelaideschools.org');
  const [email, setEmail] = useState(school?.email || 'info@saintadelaideschools.org');
  const [tel, setTel] = useState(school?.tel || '020 798 8167 / 027 064 0112 / 024 597 0186');

  const [logoUrl, setLogoUrl] = useState<string>(
    school?.logoUrl || systemSettings?.logoUrl || '/sais-logo.png'
  );
  const [principalSignature, setPrincipalSignature] = useState<string>(
    school?.principalSignature || systemSettings?.principalSignature || ''
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        const compressed = await compressImage(dataUrl, 512, 0.85);
        setLogoUrl(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const dataUrl = evt.target?.result as string;
      if (dataUrl) {
        const compressed = await compressImage(dataUrl, 512, 0.85);
        setPrincipalSignature(compressed);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();

    const patchData = {
      name: schoolName.trim(),
      motto: motto.trim(),
      address: address.trim(),
      website: website.trim(),
      email: email.trim(),
      tel: tel.trim(),
      logoUrl,
      principalSignature,
    };

    if (school) {
      updateSchool(school.id, patchData);
    } else {
      registerSchool({
        ...patchData,
        headteacherId: currentUser?.id || 'headteacher-id',
      });
    }

    updateSystemSettings({
      logoUrl,
      principalSignature,
      schoolMetadata: patchData,
    });

    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-sais-black font-display flex items-center gap-2">
            <Building2 className="w-5 h-5 text-sais-red" />
            School Branding, Metadata & Transcript Signature Settings
          </h2>
          <p className="text-xs text-sais-muted mt-1">
            Configure institutional profile, logo, and upload Principal Digital Signature for official transcripts
          </p>
        </div>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          Institutional metadata and Principal Digital Signature updated successfully!
        </div>
      )}

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Section 1: School Metadata */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display border-b pb-2">
              1. Institution Profile Details
            </h3>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Official School Name *
              </label>
              <input
                type="text"
                required
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                School Motto / Tagline
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={motto}
                onChange={(e) => setMotto(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Postal & Campus Address
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Website URL
                </label>
                <input
                  type="text"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Official Email
                </label>
                <input
                  type="email"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Telephone Contacts
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-sais-black focus-visible:ring-2 focus-visible:ring-sais-red focus-visible:outline-none"
                value={tel}
                onChange={(e) => setTel(e.target.value)}
              />
            </div>
          </div>

          {/* Section 2: Logo & Principal Digital Signature Dropzones */}
          <div className="space-y-6">
            {/* School Logo */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display border-b pb-2">
                2. Official School Logo
              </h3>
              <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <img
                  src={logoUrl || '/sais-logo.png'}
                  alt="School Logo"
                  className="w-16 h-16 object-contain bg-white rounded-full p-1 border shadow-xs"
                />
                <div className="space-y-1">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sais-black text-white text-xs font-semibold hover:bg-black cursor-pointer shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    Upload Logo PNG/SVG
                    <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </label>
                  <p className="text-[11px] text-slate-500">Recommended transparent PNG 512x512px</p>
                </div>
              </div>
            </div>

            {/* Principal Digital Signature & Stamp Upload */}
            <div className="space-y-2">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider font-display flex items-center gap-1.5">
                  <FileCheck className="w-4 h-4 text-sais-red" />
                  3. Principal Digital Signature & Stamp
                </h3>
                <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  Hydrates Transcripts STRICTLY
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <p className="text-xs text-slate-600">
                  Upload an official digital signature image (`PNG`/`SVG` with transparent background). This signature will hydrate <strong>STRICTLY into official Academic Transcripts (`TranscriptDocument.tsx`)</strong>. Report cards remain signed by Form Teachers.
                </p>

                <div className="flex items-center gap-4 pt-1">
                  {principalSignature ? (
                    <div className="border border-slate-300 rounded-lg bg-white p-2 flex items-center justify-center min-w-[160px] min-h-[60px]">
                      <img
                        src={principalSignature}
                        alt="Principal Signature Preview"
                        className="h-12 w-auto max-w-[180px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-slate-300 rounded-lg p-3 text-center min-w-[160px] min-h-[60px] flex flex-col items-center justify-center bg-white text-slate-400">
                      <Image className="w-5 h-5 mb-1 text-slate-400" />
                      <span className="text-[11px] font-medium">No signature uploaded</span>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-sais-red text-white text-xs font-semibold hover:bg-sais-red-dark cursor-pointer shadow-xs">
                      <Upload className="w-3.5 h-3.5" />
                      {principalSignature ? 'Change Signature' : 'Upload Signature Image'}
                      <input type="file" accept="image/*" className="hidden" onChange={handleSignatureUpload} />
                    </label>
                    {principalSignature && (
                      <button
                        type="button"
                        onClick={() => setPrincipalSignature('')}
                        className="block text-xs text-rose-600 hover:underline font-medium"
                      >
                        Remove signature
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-slate-100">
          <button
            type="submit"
            className="rounded-xl bg-sais-red text-white px-6 py-2.5 text-sm font-semibold hover:bg-sais-red-dark active:scale-[0.98] transition-all shadow-xs"
          >
            Save Institutional Branding & Settings
          </button>
        </div>
      </form>
    </div>
  );
}
