import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500">Effective Date: April 24, 2026 &nbsp;·&nbsp; Last Updated: April 24, 2026</p>
          <p className="text-sm text-gray-600 mt-3">KronosPortal is committed to protecting your privacy. This Privacy Policy explains how we collect, use, store, and protect your information when you use our Service.</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Information We Collect">
            <p><strong>Information you provide:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Name and email address</li>
              <li>Job title, position, and department</li>
              <li>Phone number (optional)</li>
              <li>Profile photo (optional)</li>
              <li>Messages sent through the platform</li>
              <li>Time correction requests and schedule data</li>
              <li>License numbers and certifications (optional)</li>
            </ul>
            <p><strong>Information collected automatically:</strong></p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Login timestamps and session data</li>
              <li>Device type and browser information</li>
              <li>IP address</li>
              <li>Push notification tokens (if enabled)</li>
            </ul>
            <p><strong>What we do NOT collect:</strong> We do not collect, store, or process any protected patient health information (PHI), medical records, or any data covered under HIPAA.</p>
          </Section>

          <Section title="2. How We Use Your Information">
            <p>We use your information to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Provide and operate the KronosPortal Service</li>
              <li>Authenticate your identity and maintain account security</li>
              <li>Display your schedule, shifts, and team information</li>
              <li>Deliver messages and notifications to you</li>
              <li>Process time correction requests and approvals</li>
              <li>Send password reset and account emails</li>
              <li>Improve and maintain the Service</li>
              <li>Respond to support requests</li>
            </ul>
            <p>We do not use your information for advertising, profiling, or selling to third parties.</p>
          </Section>

          <Section title="3. How We Share Your Information">
            <p>We do not sell, rent, or trade your personal information. We may share your information only in these limited circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Within your organization:</strong> Your name, role, schedule, and profile are visible to other users in your organization as necessary to operate the Service.</li>
              <li><strong>Service providers:</strong> We use third-party providers to host the Service (Railway), store data (MongoDB Atlas), and send emails (Gmail SMTP). These providers process your data only as necessary to provide their services and are bound by confidentiality obligations.</li>
              <li><strong>Legal requirements:</strong> We may disclose your information if required by law, court order, or to protect the rights, property, or safety of KronosPortal, our users, or the public.</li>
            </ul>
          </Section>

          <Section title="4. Data Storage and Security">
            <p>Your data is stored securely on MongoDB Atlas servers. We implement the following security measures:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Passwords are hashed using bcrypt and are never stored in plain text</li>
              <li>Messages are encrypted at rest using AES-256-GCM encryption</li>
              <li>All data is transmitted over HTTPS/TLS</li>
              <li>Authentication is managed via JSON Web Tokens (JWT)</li>
              <li>Account lockout after repeated failed login attempts</li>
            </ul>
            <p>While we take reasonable steps to protect your data, no method of transmission over the internet is 100% secure. We cannot guarantee absolute security.</p>
          </Section>

          <Section title="5. Data Retention">
            <p>We retain your personal information for as long as your account is active or as needed to provide the Service. If your account is terminated:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Your data may be retained for up to 90 days before deletion</li>
              <li>Some data may be retained longer if required by law</li>
              <li>You may request deletion of your data by contacting us</li>
            </ul>
          </Section>

          <Section title="6. Your Rights (California Residents)">
            <p>As a California resident, under the California Consumer Privacy Act (CCPA), you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Know</strong> what personal information we collect and how it is used</li>
              <li><strong>Access</strong> your personal information</li>
              <li><strong>Delete</strong> your personal information, subject to certain exceptions</li>
              <li><strong>Opt out</strong> of the sale of personal information (we do not sell personal information)</li>
              <li><strong>Non-discrimination</strong> for exercising your privacy rights</li>
            </ul>
            <p>To exercise these rights, contact us at <a href="mailto:pix8power@gmail.com" className="text-blue-600 hover:underline">pix8power@gmail.com</a>. We will respond within 45 days.</p>
          </Section>

          <Section title="7. Cookies and Local Storage">
            <p>KronosPortal uses browser local storage (not cookies) to store your authentication token and preferences. This data stays on your device and is not transmitted to third parties. You can clear this data at any time by logging out or clearing your browser storage.</p>
          </Section>

          <Section title="8. Push Notifications">
            <p>If you enable push notifications, we store a push subscription token on our servers to deliver notifications to your device. You can disable push notifications at any time through your browser or device settings. Disabling notifications will not affect your ability to use the Service.</p>
          </Section>

          <Section title="9. Children's Privacy">
            <p>The Service is intended for use by adults in a professional workplace setting. We do not knowingly collect personal information from individuals under the age of 18. If you believe a minor has provided us with personal information, contact us immediately and we will delete it.</p>
          </Section>

          <Section title="10. Third-Party Services">
            <p>Our Service uses the following third-party providers, each with their own privacy policies:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Railway</strong> — application hosting</li>
              <li><strong>MongoDB Atlas</strong> — database storage</li>
              <li><strong>Gmail (Google)</strong> — email delivery</li>
            </ul>
            <p>We are not responsible for the privacy practices of these third parties.</p>
          </Section>

          <Section title="11. Changes to This Policy">
            <p>We may update this Privacy Policy from time to time. We will notify users of significant changes via in-app notification or email. Your continued use of the Service after changes take effect constitutes your acceptance of the updated policy.</p>
          </Section>

          <Section title="12. Contact Us">
            <p>If you have questions, requests, or concerns about this Privacy Policy or how we handle your data, contact us at:</p>
            <p><a href="mailto:pix8power@gmail.com" className="text-blue-600 hover:underline">pix8power@gmail.com</a></p>
            <p>KronosPortal &nbsp;·&nbsp; California, United States</p>
          </Section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} KronosPortal. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/terms" className="hover:text-gray-600 underline">Terms of Service</Link>
            <a href="mailto:pix8power@gmail.com" className="hover:text-gray-600 underline">Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}
