import { useState } from 'react';
import {
  HelpCircle, ChevronDown, ChevronUp, Calendar, MessageCircle,
  Clock, Bell, Smartphone, User, Lock, Megaphone, Mail,
} from 'lucide-react';

const sections = [
  {
    icon: Calendar,
    title: 'Viewing Your Schedule',
    items: [
      { q: 'How do I see my shifts?', a: 'Go to Schedule in the navigation. Your shifts are shown on the calendar. Tap or click any shift to see details.' },
      { q: 'How do I request time off?', a: 'Open Schedule and click "Request Time Off". Fill in the dates and reason, then submit. Your manager will review it.' },
      { q: 'Can I see my schedule on my phone?', a: 'Yes. Install the app on your home screen (see the "Installing the App" section below) and your schedule is always available.' },
    ],
  },
  {
    icon: Clock,
    title: 'Time Corrections',
    items: [
      { q: 'How do I submit a time correction?', a: 'Go to Schedule → Time Corrections tab. Click "New Request", enter the date and correct times, add a reason, and submit.' },
      { q: 'How do I know if my correction was approved?', a: 'You will receive a notification and an in-app message when your correction is reviewed. Check your Dashboard for updates.' },
      { q: 'Can I cancel a request?', a: 'Yes — if it is still pending, open the request and click Delete.' },
    ],
  },
  {
    icon: MessageCircle,
    title: 'Messaging',
    items: [
      { q: 'How do I send a message?', a: 'Go to Messages and click the pencil icon to start a new conversation. Search for the person by name and type your message.' },
      { q: 'How do I know I have new messages?', a: 'A red badge appears on the Messages link in the navigation bar when you have unread messages.' },
      { q: 'Can I send images?', a: 'Yes — click the image icon in the message box to attach a photo.' },
    ],
  },
  {
    icon: Megaphone,
    title: 'Announcements',
    items: [
      { q: 'Where do I see announcements?', a: 'Go to Announcements in the navigation. All department and company-wide announcements are listed there.' },
      { q: 'Who can post announcements?', a: 'Only managers and admins can post announcements.' },
    ],
  },
  {
    icon: Bell,
    title: 'Notifications',
    items: [
      { q: 'How do I turn on push notifications?', a: 'When prompted, allow notifications in your browser or phone. You can also enable them from your Profile page.' },
      { q: 'Why am I not getting notifications?', a: 'Make sure you allowed notifications when prompted. On iPhone, go to Settings → Safari → your site → Allow Notifications.' },
    ],
  },
  {
    icon: Smartphone,
    title: 'Installing the App',
    items: [
      { q: 'How do I install the app on my iPhone?', a: 'Open the app in Safari. Tap the Share button (box with arrow) at the bottom, then tap "Add to Home Screen" and confirm.' },
      { q: 'How do I install on Android?', a: 'Open the app in Chrome. Tap the three-dot menu in the top right and select "Add to Home Screen" or tap the install banner that appears.' },
      { q: 'Does it work offline?', a: 'Basic features are available offline. You will need an internet connection to view live schedule updates and send messages.' },
    ],
  },
  {
    icon: User,
    title: 'Profile & Account',
    items: [
      { q: 'How do I update my profile?', a: 'Click your name or avatar in the top right corner to open your profile. You can update your photo and contact info.' },
      { q: 'How do I change my password?', a: 'Go to your Profile and click "Change Password". Enter your current password, then your new one.' },
    ],
  },
  {
    icon: Lock,
    title: 'Login Issues',
    items: [
      { q: 'I forgot my password.', a: 'On the login page, click "Forgot Password". Enter your email and you will receive a reset link.' },
      { q: 'My account is locked or I cannot log in.', a: 'Contact your manager or admin to reset your account.' },
    ],
  },
  {
    icon: Mail,
    title: 'Still Need Help?',
    items: [
      { q: 'Who do I contact for technical issues?', a: 'Send a message to your manager or admin directly through the Messages section of the app.' },
      { q: 'Who do I contact for schedule issues?', a: 'Message your charge nurse or manager through the app.' },
    ],
  },
];

function Section({ section }) {
  const [openIndex, setOpenIndex] = useState(null);
  const Icon = section.icon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h2 className="font-semibold text-gray-900 dark:text-white">{section.title}</h2>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {section.items.map((item, i) => (
          <div key={i}>
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span className="text-sm font-medium text-gray-800 dark:text-gray-200 pr-4">{item.q}</span>
              {openIndex === i
                ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />}
            </button>
            {openIndex === i && (
              <div className="px-5 pb-4 text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Help() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-xl">
          <HelpCircle className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">Help & FAQ</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Answers to common questions</p>
        </div>
      </div>
      <div className="space-y-4">
        {sections.map((s, i) => <Section key={i} section={s} />)}
      </div>
    </div>
  );
}
