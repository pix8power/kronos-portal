import { Link } from 'react-router-dom';

function Section({ title, children }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base font-bold text-gray-900">{title}</h2>
      <div className="text-sm text-gray-700 leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function Terms() {
  return (
    <div className="min-h-screen bg-white px-6 py-16">
      <div className="max-w-3xl mx-auto">
        <div className="mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500">Effective Date: April 24, 2026 &nbsp;·&nbsp; Last Updated: April 24, 2026</p>
          <p className="text-sm text-gray-600 mt-3">Please read these Terms of Service carefully before using KronosPortal. By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>
        </div>

        <div className="space-y-10">

          <Section title="1. Agreement to Terms">
            <p>These Terms of Service ("Terms") constitute a legally binding agreement between you ("User," "you," or "your") and KronosPortal ("Company," "we," "us," or "our") governing your access to and use of the KronosPortal platform, website, and related services (collectively, the "Service"). By creating an account, logging in, or using the Service in any way, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.</p>
          </Section>

          <Section title="2. Description of Service">
            <p>KronosPortal is a staff scheduling and workforce communication platform designed for medical and healthcare teams. The Service includes shift scheduling, team messaging, time correction requests, announcements, and related tools. The Service is intended for internal organizational use by authorized employees and administrators only.</p>
          </Section>

          <Section title="3. Accounts and Access">
            <p>Accounts are created by your organization's administrator. You are responsible for:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Maintaining the confidentiality of your login credentials</li>
              <li>All activity that occurs under your account</li>
              <li>Notifying your administrator immediately of any unauthorized access or breach</li>
              <li>Ensuring your account information is accurate and up to date</li>
            </ul>
            <p>You may not share your account credentials with any other person. KronosPortal is not liable for any loss or damage arising from unauthorized use of your account.</p>
          </Section>

          <Section title="4. User Conduct Rules">
            <p>You agree to use the Service only for lawful, professional purposes. You expressly agree NOT to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Harass, threaten, bully, defame, or intimidate any other user</li>
              <li>Share, transmit, or post content that is obscene, offensive, discriminatory, or unlawful</li>
              <li>Impersonate another person or misrepresent your identity or affiliation</li>
              <li>Share your login credentials or allow unauthorized individuals to access your account</li>
              <li>Attempt to access, tamper with, or disrupt any server, network, or database connected to the Service</li>
              <li>Upload or transmit viruses, malware, or any other malicious code</li>
              <li>Use the Service to send spam, unsolicited messages, or promotional content</li>
              <li>Scrape, crawl, copy, or reverse engineer any part of the Service</li>
              <li>Use the Service in any way that violates applicable federal, state, or local laws</li>
              <li>Use the Service to store or transmit patient health information (PHI) without express written authorization</li>
            </ul>
            <p>Violation of these conduct rules may result in immediate suspension or termination of your account without notice.</p>
          </Section>

          <Section title="5. Data and Privacy">
            <p>KronosPortal collects and stores staff information including names, email addresses, work schedules, messages, and related workforce data. We do not collect, store, or process any protected patient health information (PHI). Your data is used solely to provide the Service and is never sold to third parties.</p>
            <p>By using the Service, you consent to the collection and use of your data as described in our <Link to="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>, which is incorporated into these Terms by reference.</p>
          </Section>

          <Section title="6. Subscription and Payment">
            <p>Access to KronosPortal is provided on a subscription basis at $2.50 per user per month, or as otherwise agreed in writing. By subscribing, you agree that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Subscriptions are billed monthly and renew automatically</li>
              <li>You are responsible for all fees associated with your organization's account</li>
              <li>Failure to pay may result in suspension or termination of access with or without notice</li>
              <li>All fees are non-refundable unless otherwise required by applicable law</li>
              <li>We reserve the right to change pricing with 30 days' written notice</li>
            </ul>
          </Section>

          <Section title="7. Intellectual Property">
            <p>KronosPortal, including all software, design, content, trademarks, and functionality, is the exclusive property of KronosPortal and is protected by United States and international intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to use the Service solely for your organization's internal purposes.</p>
            <p>You may not copy, modify, distribute, sell, sublicense, or create derivative works of any part of the Service without our express prior written consent.</p>
          </Section>

          <Section title="8. Disclaimers">
            <p>THE SERVICE IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.</p>
            <p>KronosPortal does not warrant that:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The Service will be uninterrupted, timely, secure, or error-free</li>
              <li>Results obtained from use of the Service will be accurate or reliable</li>
              <li>Any errors in the Service will be corrected</li>
            </ul>
            <p>Your use of the Service is entirely at your own risk. No advice or information, whether oral or written, obtained from KronosPortal shall create any warranty not expressly stated in these Terms.</p>
          </Section>

          <Section title="9. Limitation of Liability">
            <p>TO THE FULLEST EXTENT PERMITTED BY APPLICABLE LAW, KRONOSPORTAL AND ITS OWNERS, EMPLOYEES, AGENTS, AND AFFILIATES SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Loss of profits, revenue, data, or business opportunities</li>
              <li>Unauthorized access to or alteration of your data</li>
              <li>Interruption or cessation of the Service</li>
              <li>Bugs, viruses, or harmful components transmitted through the Service</li>
              <li>Errors or inaccuracies in any content or scheduling data</li>
            </ul>
            <p>IN NO EVENT SHALL KRONOSPORTAL'S TOTAL CUMULATIVE LIABILITY TO YOU EXCEED THE GREATER OF (A) THE TOTAL AMOUNT YOU PAID TO KRONOSPORTAL IN THE THREE (3) MONTHS IMMEDIATELY PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).</p>
          </Section>

          <Section title="10. Indemnification">
            <p>You agree to defend, indemnify, and hold harmless KronosPortal and its owners, officers, employees, and agents from and against any claims, liabilities, damages, losses, and expenses, including reasonable legal fees, arising out of or related to: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law or regulation; or (d) your violation of any rights of any third party.</p>
          </Section>

          <Section title="11. Termination Rights">
            <p>Either party may terminate access to the Service at any time:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>By you:</strong> You may stop using the Service at any time. Contact your administrator to deactivate your account.</li>
              <li><strong>By us:</strong> We reserve the right to suspend or permanently terminate your access immediately and without notice if you violate these Terms, engage in conduct harmful to other users or the platform, fail to pay applicable fees, or for any other reason at our sole discretion.</li>
            </ul>
            <p>Upon termination, your right to access and use the Service ceases immediately. We may retain your data for a period as required by law or our data retention policies. Sections 7, 8, 9, 10, 11, and 12 survive termination.</p>
          </Section>

          <Section title="12. Dispute Resolution">
            <p><strong>Informal Resolution:</strong> Before filing any formal claim, you agree to first contact us at pix8power@gmail.com and attempt to resolve the dispute informally. We will attempt to resolve disputes within 30 days of receiving written notice.</p>
            <p><strong>Binding Arbitration:</strong> If informal resolution fails, any dispute, claim, or controversy arising out of or relating to these Terms or the Service shall be resolved by binding arbitration administered under the rules of the American Arbitration Association (AAA), rather than in court, except that either party may bring claims in small claims court if they qualify.</p>
            <p><strong>Class Action Waiver:</strong> YOU AND KRONOSPORTAL AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY CLASS OR REPRESENTATIVE ACTION.</p>
            <p><strong>Governing Law:</strong> These Terms are governed by the laws of the State of California, United States, without regard to conflict of law principles. Any claims not subject to arbitration shall be brought exclusively in the state or federal courts located in California.</p>
          </Section>

          <Section title="13. Changes to Terms">
            <p>We reserve the right to update or modify these Terms at any time. We will notify users of material changes via in-app notification or email at least 14 days before changes take effect. Your continued use of the Service after the effective date of any changes constitutes your acceptance of the revised Terms. If you do not agree to the revised Terms, you must stop using the Service.</p>
          </Section>

          <Section title="14. Miscellaneous">
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Entire Agreement:</strong> These Terms, together with the Privacy Policy, constitute the entire agreement between you and KronosPortal regarding the Service.</li>
              <li><strong>Severability:</strong> If any provision of these Terms is found to be unenforceable, the remaining provisions will remain in full force and effect.</li>
              <li><strong>Waiver:</strong> Our failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision.</li>
              <li><strong>Assignment:</strong> You may not assign or transfer your rights under these Terms without our prior written consent. We may assign our rights without restriction.</li>
            </ul>
          </Section>

          <Section title="15. Contact">
            <p>If you have questions, concerns, or complaints about these Terms, please contact us at:</p>
            <p><a href="mailto:pix8power@gmail.com" className="text-blue-600 hover:underline">pix8power@gmail.com</a></p>
            <p>KronosPortal &nbsp;·&nbsp; California, United States</p>
          </Section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
          <span>© {new Date().getFullYear()} KronosPortal. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy" className="hover:text-gray-600 underline">Privacy Policy</Link>
            <a href="mailto:pix8power@gmail.com" className="hover:text-gray-600 underline">Contact</a>
          </div>
        </div>
      </div>
    </div>
  );
}
