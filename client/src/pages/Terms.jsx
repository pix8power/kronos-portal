export default function Terms() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective Date: April 24, 2026 &nbsp;·&nbsp; Last Updated: April 24, 2026</p>
        </div>

        <div className="prose prose-gray max-w-none space-y-8 text-sm text-gray-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">1. Agreement to Terms</h2>
            <p>By accessing or using KronosPortal ("the Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service. These Terms apply to all users, including administrators, managers, and staff members.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">2. Description of Service</h2>
            <p>KronosPortal is a staff scheduling and communication platform designed for medical and healthcare teams. The Service includes shift scheduling, team messaging, time correction requests, announcements, and related workforce management tools.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">3. Accounts</h2>
            <p>Accounts are created by your organization's administrator. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify your administrator immediately if you suspect unauthorized access to your account. KronosPortal is not liable for any loss resulting from unauthorized account use.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">4. Acceptable Use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li>Use the Service for any unlawful purpose</li>
              <li>Harass, threaten, or harm other users</li>
              <li>Share your login credentials with others</li>
              <li>Attempt to access accounts or data that do not belong to you</li>
              <li>Upload malicious files, viruses, or harmful code</li>
              <li>Use the Service to transmit spam or unsolicited messages</li>
              <li>Reverse engineer, copy, or resell any part of the Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">5. Data and Privacy</h2>
            <p>KronosPortal collects and stores staff information including names, email addresses, work schedules, and internal messages. We do not collect, store, or process any patient health information (PHI). Your data is used solely to provide the Service and is not sold to third parties. For full details, see our <a href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">6. Subscription and Payment</h2>
            <p>Access to KronosPortal is provided on a subscription basis at $2.50 per user per month, or as otherwise agreed in writing. Subscriptions are billed monthly. Failure to pay may result in suspension or termination of access. All fees are non-refundable unless otherwise required by law.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">7. Intellectual Property</h2>
            <p>KronosPortal and all its content, features, and functionality are owned by KronosPortal and are protected by applicable intellectual property laws. You may not copy, modify, distribute, or create derivative works without our express written permission.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">8. Termination</h2>
            <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without notice, for violation of these Terms or for any other reason at our discretion. Upon termination, your right to use the Service ceases immediately.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">9. Disclaimers</h2>
            <p>The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. KronosPortal does not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components. Your use of the Service is at your sole risk.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">10. Limitation of Liability</h2>
            <p>To the fullest extent permitted by law, KronosPortal shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of or inability to use the Service, even if we have been advised of the possibility of such damages. Our total liability to you shall not exceed the amount you paid us in the three months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">11. Governing Law</h2>
            <p>These Terms are governed by the laws of the State of California, United States, without regard to its conflict of law provisions. Any disputes arising under these Terms shall be resolved in the courts located in California.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">12. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify users of significant changes via the app or email. Your continued use of the Service after changes take effect constitutes your acceptance of the updated Terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 mb-2">13. Contact</h2>
            <p>If you have questions about these Terms, contact us at <a href="mailto:pix8power@gmail.com" className="text-blue-600 hover:underline">pix8power@gmail.com</a>.</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-xs text-gray-400 text-center">
          © {new Date().getFullYear()} KronosPortal. All rights reserved.
        </div>
      </div>
    </div>
  );
}
