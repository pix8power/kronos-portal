import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  User, FileText, Award, Calendar, Upload, Trash2, Download,
  Link2, Plus, X, AlertTriangle, Camera, Loader2, Heart, Eye,
  Image, File,
} from 'lucide-react';
import { profileAPI, webAuthnAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useWebAuthn } from '../hooks/useWebAuthn';

const WARN_DAYS = 60;

function daysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000);
}

function ExpiryBadge({ dateStr }) {
  const days = daysUntil(dateStr);
  if (days === null || !dateStr) return null;
  if (days < 0)  return <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">EXPIRED</span>;
  if (days <= 7)  return <span className="text-[10px] font-bold text-white bg-red-500 px-2 py-0.5 rounded-full">{days}d left</span>;
  if (days <= 14) return <span className="text-[10px] font-bold text-white bg-orange-500 px-2 py-0.5 rounded-full">{days}d left</span>;
  if (days <= WARN_DAYS) return <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">{days}d left</span>;
  return <span className="text-[10px] text-gray-400">{dateStr}</span>;
}

// OCR: extract license/cert number and expiry from image file
async function ocrImage(file) {
  try {
    const { createWorker } = await import('tesseract.js');
    const worker = await createWorker('eng', 1, {
      workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
      langPath: 'https://tessdata.projectnaptha.com/4.0.0',
      corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
      logger: () => {},
    });
    const { data: { text } } = await worker.recognize(file);
    await worker.terminate();
    return parseCredentialText(text);
  } catch (err) {
    console.warn('OCR failed:', err);
    return { licenseNumber: '', expiry: '' };
  }
}

function parseCredentialText(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const full = text.toUpperCase();

  // Expiry date — look for EXP/EXPIRES followed by a date, or standalone date patterns
  let expiry = '';
  const datePatterns = [
    /(?:EXP(?:IRES?|IRATION)?|VALID\s+THRU?|THRU?|RENEW\s+BY)[:\s]+(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4})/,
    /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2})\b/,
    /((?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[A-Z]*\.?\s+\d{1,2},?\s+\d{4})/i,
  ];
  for (const pat of datePatterns) {
    const m = text.match(pat);
    if (m) {
      // Try to parse and normalize to YYYY-MM-DD
      const raw = m[1];
      const parts = raw.split(/[\/\-\s,]+/).map((p) => p.trim());
      if (parts.length >= 3) {
        const monthMap = { jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
        let mo, dy, yr;
        if (isNaN(Number(parts[0]))) {
          mo = monthMap[parts[0].slice(0,3).toLowerCase()] || 1;
          dy = Number(parts[1]);
          yr = Number(parts[2]);
        } else {
          mo = Number(parts[0]);
          dy = Number(parts[1]);
          yr = Number(parts[2]);
        }
        if (yr < 100) yr += 2000;
        if (mo && dy && yr > 2000) {
          expiry = `${yr}-${String(mo).padStart(2,'0')}-${String(dy).padStart(2,'0')}`;
          break;
        }
      }
      if (!expiry) { expiry = raw; break; }
    }
  }

  // License/cert number — alphanumeric strings near keywords or standalone
  let licenseNumber = '';
  const numPatterns = [
    /(?:LIC(?:ENSE)?\.?\s*#?|NO\.?|NUMBER|CERT\.?\s*#?)[:\s]+([A-Z0-9][A-Z0-9\-]{3,14})/i,
    /\b([A-Z]{1,3}[\-]?\d{5,10})\b/,
    /\b(\d{7,10})\b/,
  ];
  for (const pat of numPatterns) {
    const m = text.match(pat);
    if (m) { licenseNumber = m[1].trim(); break; }
  }

  return { licenseNumber, expiry };
}

export default function Profile() {
  const { id } = useParams();
  const { user: me } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({});
  const [certForm, setCertForm] = useState({ name: '', number: '', expiry: '' });
  const [showCertForm, setShowCertForm] = useState(false);
  const [icalUrl, setIcalUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrTarget, setOcrTarget] = useState(null); // 'license' | 'bls' | 'cert'
  const [viewingDoc, setViewingDoc] = useState(null); // { name, filename }
  const fileRef = useRef();
  const cameraRef = useRef();
  const licCamRef = useRef();

  const isOwn = !id || id === me?._id;
  const canEdit = isOwn;

  useEffect(() => {
    (async () => {
      try {
        const res = id ? await profileAPI.getById(id) : await profileAPI.get();
        setProfile(res.data);
        setForm({
          bio: res.data.bio || '',
          hireDate: res.data.hireDate || '',
          seniorityDate: res.data.seniorityDate || '',
          licenseNumber: res.data.licenseNumber || '',
          licenseExpiry: res.data.licenseExpiry || '',
          blsCprExpiry: res.data.blsCprExpiry || '',
          phone: res.data.phone || '',
        });
      } catch (err) { console.error(err); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const handleSave = async (extra = {}) => {
    setSaving(true);
    try {
      const res = await profileAPI.update({ ...form, ...extra });
      setProfile(res.data);
      setForm((f) => ({
        ...f,
        licenseNumber: res.data.licenseNumber || '',
        licenseExpiry: res.data.licenseExpiry || '',
        blsCprExpiry: res.data.blsCprExpiry || '',
        phone: res.data.phone || '',
        bio: res.data.bio || '',
        hireDate: res.data.hireDate || '',
      }));
    } catch (err) { console.error(err); }
    finally { setSaving(false); }
  };

  const handleAddCert = async () => {
    if (!certForm.name) return;
    const certs = [...(profile.certifications || []), certForm];
    const res = await profileAPI.update({ certifications: certs });
    setProfile(res.data);
    setCertForm({ name: '', number: '', expiry: '' });
    setShowCertForm(false);
  };

  const handleRemoveCert = async (i) => {
    const certs = profile.certifications.filter((_, idx) => idx !== i);
    const res = await profileAPI.update({ certifications: certs });
    setProfile(res.data);
  };

  // OCR handler — called after a photo/file is selected
  const handleOcrFile = async (e, target) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setOcrLoading(true);
    setOcrTarget(target);
    try {
      const { licenseNumber, expiry } = await ocrImage(file);
      if (target === 'license') {
        const updated = { ...form, ...(licenseNumber ? { licenseNumber } : {}), ...(expiry ? { licenseExpiry: expiry } : {}) };
        setForm(updated);
      } else if (target === 'bls') {
        if (expiry) setForm((f) => ({ ...f, blsCprExpiry: expiry }));
      } else if (target === 'cert') {
        setCertForm((f) => ({
          ...f,
          ...(licenseNumber ? { number: licenseNumber } : {}),
          ...(expiry ? { expiry } : {}),
        }));
      }
    } finally {
      setOcrLoading(false);
      setOcrTarget(null);
      e.target.value = '';
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('name', file.name);
    try {
      const res = await profileAPI.uploadDocument(fd);
      setProfile(res.data);
    } catch (err) { console.error(err); }
    e.target.value = '';
  };

  const handleDeleteDoc = async (filename) => {
    if (!confirm('Delete this document?')) return;
    await profileAPI.deleteDocument(filename);
    setProfile((p) => ({ ...p, documents: p.documents.filter((d) => d.filename !== filename) }));
  };

  const handleGetIcal = async () => {
    const res = await profileAPI.getIcalToken();
    const base = window.location.origin.includes('localhost') ? window.location.origin : window.location.origin;
    setIcalUrl(`${base}/api/ical/${res.data.token}`);
  };

  const copyIcal = () => {
    navigator.clipboard.writeText(icalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="p-6 text-center text-gray-400 dark:text-gray-500">Loading...</div>;
  if (!profile) return <div className="p-6 text-center text-gray-400">Profile not found.</div>;

  const licDays = daysUntil(form.licenseExpiry || profile.licenseExpiry);
  const blsDays = daysUntil(form.blsCprExpiry || profile.blsCprExpiry);
  const expiringItems = [
    ...(licDays !== null && licDays <= WARN_DAYS ? [{ label: 'License', days: licDays }] : []),
    ...(blsDays !== null && blsDays <= WARN_DAYS ? [{ label: 'BLS/CPR', days: blsDays }] : []),
    ...(profile.certifications || []).filter((c) => { const d = daysUntil(c.expiry); return d !== null && d <= WARN_DAYS; }).map((c) => ({ label: c.name, days: daysUntil(c.expiry) })),
  ];

  const OcrButton = ({ inputRef, target, label = 'Scan Photo' }) => (
    <>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => handleOcrFile(e, target)} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={ocrLoading}
        className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 dark:border-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50"
      >
        {ocrLoading && ocrTarget === target ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
        {ocrLoading && ocrTarget === target ? 'Scanning...' : label}
      </button>
    </>
  );

  const licCamRef2 = { current: null };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">

      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 flex items-center gap-4">
        <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold flex-shrink-0" style={{ backgroundColor: profile.color || '#3B82F6' }}>
          {profile.name?.split(' ').map((n) => n[0]).join('').slice(0, 2)}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{profile.position}{profile.department ? ` · ${profile.department}` : ''}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">{profile.role?.replace('_', ' ')}</p>
        </div>
        {expiringItems.length > 0 && (
          <div className="flex flex-col gap-1 items-end">
            {expiringItems.map((item, i) => (
              <div key={i} className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${item.days < 0 ? 'bg-red-100 text-red-700' : item.days <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700'}`}>
                <AlertTriangle className="h-3 w-3" />
                {item.label} {item.days < 0 ? 'expired' : `${item.days}d`}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Basic Info */}
      {canEdit && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><User className="h-4 w-4" /> Basic Info</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="555-123-4567" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Hire Date</label>
              <input type="date" value={form.hireDate} onChange={(e) => setForm({ ...form, hireDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Seniority Date</label>
              <input type="date" value={form.seniorityDate} onChange={(e) => setForm({ ...form, seniorityDate: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
          <button onClick={() => handleSave()} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* License & BLS/CPR */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Award className="h-4 w-4" /> License &amp; BLS/CPR</h2>

        {canEdit ? (
          <>
            {/* License */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Nursing License</p>
                <LicenseCamButton onFile={(e) => handleOcrFile(e, 'license')} loading={ocrLoading && ocrTarget === 'license'} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block">License Number</label>
                  <input value={form.licenseNumber} onChange={(e) => setForm({ ...form, licenseNumber: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="RN-12345" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex items-center gap-2">
                    Expiry <ExpiryBadge dateStr={form.licenseExpiry} />
                  </label>
                  <input type="date" value={form.licenseExpiry} onChange={(e) => setForm({ ...form, licenseExpiry: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-gray-700 pt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                  <Heart className="h-3.5 w-3.5 text-red-500" /> BLS/CPR
                </p>
                <BlsCamButton onFile={(e) => handleOcrFile(e, 'bls')} loading={ocrLoading && ocrTarget === 'bls'} />
              </div>
              <div className="max-w-xs">
                <label className="text-xs text-gray-500 dark:text-gray-400 mb-1 block flex items-center gap-2">
                  Expiry <ExpiryBadge dateStr={form.blsCprExpiry} />
                </label>
                <input type="date" value={form.blsCprExpiry} onChange={(e) => setForm({ ...form, blsCprExpiry: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <button onClick={() => handleSave()} disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </>
        ) : (
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            {profile.licenseNumber && <p>License: <strong>{profile.licenseNumber}</strong> <ExpiryBadge dateStr={profile.licenseExpiry} /></p>}
            {profile.blsCprExpiry && <p className="flex items-center gap-2"><Heart className="h-3.5 w-3.5 text-red-500" /> BLS/CPR: <ExpiryBadge dateStr={profile.blsCprExpiry} /></p>}
          </div>
        )}
      </div>

      {/* Other Certifications */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Award className="h-4 w-4" /> Other Certifications</h2>

        {(profile.certifications || []).map((cert, i) => (
          <div key={i} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{cert.name}</p>
              {cert.number && <p className="text-xs text-gray-400"># {cert.number}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <ExpiryBadge dateStr={cert.expiry} />
              {canEdit && <button onClick={() => handleRemoveCert(i)} className="text-gray-300 hover:text-red-500 transition-colors"><X className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        ))}

        {canEdit && (
          showCertForm ? (
            <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">New Certification</p>
                <CertCamButton onFile={(e) => handleOcrFile(e, 'cert')} loading={ocrLoading && ocrTarget === 'cert'} />
              </div>
              <input value={certForm.name} onChange={(e) => setCertForm({ ...certForm, name: e.target.value })}
                placeholder="Certification name *" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="grid grid-cols-2 gap-2">
                <input value={certForm.number} onChange={(e) => setCertForm({ ...certForm, number: e.target.value })}
                  placeholder="Cert number" className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                <input type="date" value={certForm.expiry} onChange={(e) => setCertForm({ ...certForm, expiry: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddCert} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium">Add</button>
                <button onClick={() => { setShowCertForm(false); setCertForm({ name: '', number: '', expiry: '' }); }} className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600 rounded-lg">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowCertForm(true)} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium">
              <Plus className="h-4 w-4" /> Add Certification
            </button>
          )
        )}
      </div>

      {/* Documents / CEU */}
      {canEdit && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><FileText className="h-4 w-4" /> Documents / CEU</h2>

          {(profile.documents || []).length === 0 && (
            <p className="text-sm text-gray-400 dark:text-gray-500">No documents uploaded yet.</p>
          )}

          {(profile.documents || []).map((doc) => {
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i.test(doc.filename);
            const isPdf   = /\.pdf$/i.test(doc.filename);
            return (
              <div key={doc.filename} className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2">
                <div className="flex-shrink-0 text-gray-400">
                  {isImage ? <Image className="h-4 w-4 text-blue-400" /> : <File className="h-4 w-4" />}
                </div>
                <span className="text-sm text-gray-800 dark:text-gray-200 truncate flex-1">{doc.name}</span>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {(isImage || isPdf) && (
                    <button
                      onClick={() => setViewingDoc(doc)}
                      className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                      title="View"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                  )}
                  <a
                    href={`/api/profile/documents/${doc.filename}`}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Download"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    onClick={() => handleDeleteDoc(doc.filename)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          <input ref={fileRef} type="file" className="hidden" onChange={handleUpload} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleUpload} />

          <div className="flex gap-2 flex-wrap">
            <button onClick={() => fileRef.current.click()}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Upload className="h-4 w-4" /> Upload File
            </button>
            <button onClick={() => cameraRef.current.click()}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Camera className="h-4 w-4" /> Take Photo
            </button>
          </div>
        </div>
      )}

      {/* Document viewer modal */}
      {viewingDoc && (
        <DocViewer doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

      {/* Passkeys */}
      {isOwn && <PasskeySection />}

      {/* Calendar Sync */}
      {isOwn && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-5 space-y-3">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2"><Calendar className="h-4 w-4" /> Calendar Sync</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Subscribe to your schedule in Google Calendar, Apple Calendar, or Outlook.</p>
          {!icalUrl ? (
            <button onClick={handleGetIcal} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 dark:border-blue-700 rounded-lg px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
              <Link2 className="h-4 w-4" /> Generate iCal Link
            </button>
          ) : (
            <div className="flex gap-2">
              <input readOnly value={icalUrl} className="flex-1 min-w-0 px-3 py-2 text-xs border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg" />
              <button onClick={copyIcal} className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PasskeySection() {
  const { isSupported, registerPasskey } = useWebAuthn();
  const [credentials, setCredentials] = useState([]);
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState('');
  const [regSuccess, setRegSuccess] = useState('');

  const load = () => {
    webAuthnAPI.getCredentials().then((r) => setCredentials(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const handleRegister = async () => {
    setRegistering(true);
    setRegError('');
    setRegSuccess('');
    try {
      await registerPasskey();
      setRegSuccess('Passkey registered! You can now use biometrics to confirm time corrections.');
      load();
    } catch (err) {
      if (err?.name === 'NotAllowedError') {
        setRegError('Registration was cancelled.');
      } else if (err?.response?.data?.message) {
        setRegError(err.response.data.message);
      } else {
        setRegError('Registration failed. Please try again.');
      }
    } finally {
      setRegistering(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Remove this passkey?')) return;
    await webAuthnAPI.deleteCredential(id);
    load();
  };

  if (!isSupported) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-3">
      <h2 className="font-semibold text-gray-800 flex items-center gap-2">
        <span className="text-lg">🔑</span> Passkeys &amp; Biometrics
      </h2>
      <p className="text-sm text-gray-500">Use Face ID, fingerprint, or a device PIN to confirm time correction submissions — no password needed.</p>

      {credentials.length === 0 ? (
        <p className="text-sm text-gray-400">No passkeys registered yet.</p>
      ) : (
        <ul className="space-y-2">
          {credentials.map((c) => (
            <li key={c._id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
              <div>
                <p className="text-sm font-medium text-gray-800">
                  {c.deviceType === 'multiDevice' ? 'Synced passkey' : 'Device passkey'}
                </p>
                <p className="text-xs text-gray-400">Added {new Date(c.createdAt).toLocaleDateString()}</p>
              </div>
              <button onClick={() => handleDelete(c._id)} className="text-xs text-red-500 hover:underline">Remove</button>
            </li>
          ))}
        </ul>
      )}

      {regError && <p className="text-red-500 text-xs">{regError}</p>}
      {regSuccess && <p className="text-green-600 text-xs">{regSuccess}</p>}

      <button
        onClick={handleRegister}
        disabled={registering}
        className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium border border-blue-200 rounded-lg px-3 py-2 hover:bg-blue-50 transition-colors disabled:opacity-50"
      >
        {registering ? 'Registering...' : '+ Add Passkey'}
      </button>
    </div>
  );
}

// Inline camera scan buttons to avoid ref collision
function LicenseCamButton({ onFile, loading }) {
  const ref = useRef();
  return <>
    <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    <button type="button" onClick={() => ref.current?.click()} disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 dark:border-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      {loading ? 'Scanning...' : 'Scan License'}
    </button>
  </>;
}

function BlsCamButton({ onFile, loading }) {
  const ref = useRef();
  return <>
    <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    <button type="button" onClick={() => ref.current?.click()} disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 dark:border-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      {loading ? 'Scanning...' : 'Scan Card'}
    </button>
  </>;
}

function CertCamButton({ onFile, loading }) {
  const ref = useRef();
  return <>
    <input ref={ref} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
    <button type="button" onClick={() => ref.current?.click()} disabled={loading}
      className="flex items-center gap-1.5 text-xs font-medium text-blue-600 border border-blue-200 dark:border-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors disabled:opacity-50">
      {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
      {loading ? 'Scanning...' : 'Scan Cert'}
    </button>
  </>;
}

function DocViewer({ doc, onClose }) {
  const isImage = /\.(jpg|jpeg|png|gif|webp|bmp|heic)$/i.test(doc.filename);
  const isPdf   = /\.pdf$/i.test(doc.filename);
  const src = `/api/profile/documents/${doc.filename}`;

  // Close on backdrop click
  const handleBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 z-50 flex flex-col items-center justify-center p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex-shrink-0">
          <p className="font-semibold text-gray-800 dark:text-gray-200 truncate text-sm">{doc.name}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <a
              href={src}
              download={doc.name}
              className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-medium border border-blue-200 dark:border-blue-700 px-2.5 py-1.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
            >
              <Download className="h-3.5 w-3.5" /> Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-gray-50 dark:bg-gray-800 p-2">
          {isImage && (
            <img
              src={src}
              alt={doc.name}
              className="max-w-full max-h-full object-contain rounded-lg shadow"
            />
          )}
          {isPdf && (
            <iframe
              src={src}
              title={doc.name}
              className="w-full h-full min-h-[60vh] rounded-lg"
              style={{ border: 'none' }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
