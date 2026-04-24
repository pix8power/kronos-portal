import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Clock, Zap, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: MessageCircle,
    title: 'Real-Time Messaging',
    description: 'Staff and managers communicate instantly — no separate app, no group texts. Everything in one place.',
  },
  {
    icon: Clock,
    title: 'Time Correction Workflow',
    description: 'Staff submit time corrections directly in the app. Managers review and approve in one click.',
  },
  {
    icon: Zap,
    title: 'Simple and Fast',
    description: 'Up and running in minutes. Clean, intuitive design your team will actually use — no training required.',
  },
];

const included = [
  'Staff scheduling & shift management',
  'Real-time team messaging',
  'Time correction requests & approvals',
  'Announcements & notifications',
  'Time-off requests',
  'Master schedule view',
  'Mobile-friendly — installs as an app',
  'Push notifications',
];

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', teamSize: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setSent(true);
    } catch {
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  if (sent) return (
    <div className="text-center py-8">
      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
        <CheckCircle className="h-6 w-6 text-green-600" />
      </div>
      <p className="font-semibold text-gray-900">Thanks! We'll be in touch within 24 hours.</p>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input
          type="text" placeholder="Your name" required
          value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="email" placeholder="Work email" required
          value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      <input
        type="text" placeholder="Team size (e.g. 15 staff)"
        value={form.teamSize} onChange={(e) => setForm({ ...form, teamSize: e.target.value })}
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <textarea
        placeholder="Tell us about your team or any questions..."
        rows={3}
        value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
        className="w-full border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
      <button
        type="submit" disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50"
      >
        {loading ? 'Sending...' : 'Request a Demo'}
      </button>
    </form>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-xl text-blue-600">
            <img src="/icon-192.png" alt="Kronos" className="h-8 w-8 rounded-full" />
            KronosPortal
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors">
              Log in
            </Link>
            <a
              href="mailto:pix8power@gmail.com?subject=KronosPortal Demo Request"
              className="text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Request a Demo
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-b from-blue-50 to-white px-6 py-24 text-center">
        <div className="max-w-3xl mx-auto">
          <span className="inline-block bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
            Built for Medical Teams
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight mb-6">
            Staff Scheduling Made <span className="text-blue-600">Simple</span>
          </h1>
          <p className="text-lg text-gray-500 mb-8 max-w-xl mx-auto">
            KronosPortal gives medical teams everything they need to manage schedules, communicate, and handle time corrections — all in one app.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:pix8power@gmail.com?subject=KronosPortal Demo Request"
              className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Request a Demo
            </a>
            <Link
              to="/login"
              className="border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold px-8 py-3 rounded-xl transition-colors text-sm"
            >
              Log in to your account
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-6 py-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 mb-12">Why teams choose KronosPortal</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="bg-gray-50 rounded-2xl p-6 border border-gray-100">
                <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's included */}
      <section className="bg-blue-600 px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-white mb-10">Everything included, no add-ons</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {included.map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-blue-200 flex-shrink-0" />
                <span className="text-white text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="px-6 py-20">
        <div className="max-w-md mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Simple pricing</h2>
          <p className="text-gray-500 mb-8 text-sm">No contracts. No hidden fees. Cancel anytime.</p>
          <div className="bg-white border-2 border-blue-600 rounded-2xl p-8 shadow-lg">
            <p className="text-sm font-semibold text-blue-600 uppercase tracking-wider mb-2">Per User</p>
            <div className="flex items-end justify-center gap-1 mb-1">
              <span className="text-5xl font-extrabold text-gray-900">$2.50</span>
              <span className="text-gray-500 mb-2">/user/month</span>
            </div>
            <p className="text-xs text-gray-400 mb-6">A 15-person team = $37.50/month</p>
            <a
              href="mailto:pix8power@gmail.com?subject=KronosPortal Demo Request"
              className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              Get Started
            </a>
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="bg-gray-50 px-6 py-20 border-t border-gray-100">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-2">Ready to simplify your scheduling?</h2>
          <p className="text-gray-500 text-sm text-center mb-8">Request a demo and we'll get your team set up within 24 hours.</p>
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
            <ContactForm />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 px-6 py-6 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} KronosPortal. All rights reserved.
        <span className="mx-2">·</span>
        <Link to="/terms" className="hover:text-gray-600 underline">Terms of Service</Link>
        <span className="mx-2">·</span>
        <Link to="/privacy" className="hover:text-gray-600 underline">Privacy Policy</Link>
        <span className="mx-2">·</span>
        <a href="mailto:pix8power@gmail.com" className="hover:text-gray-600 underline">Contact</a>
      </footer>
    </div>
  );
}
