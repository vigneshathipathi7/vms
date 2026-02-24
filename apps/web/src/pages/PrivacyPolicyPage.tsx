import React from 'react';

/**
 * Privacy Policy Page
 * ===================
 * 
 * Required legal page for production deployment.
 * Explains data handling practices.
 */
export function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Privacy Policy</h1>
        
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: February 2026
        </p>

        <div className="prose prose-blue max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Introduction
            </h2>
            <p className="text-gray-700 mb-4">
              This Privacy Policy describes how the Voter Management System ("VMS", "we", "us", "our") 
              collects, uses, and protects information when you use our platform. We are committed 
              to protecting your privacy and handling your data responsibly.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Information We Collect
            </h2>
            
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              2.1 Account Information
            </h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Full name</li>
              <li>Email address</li>
              <li>Phone number</li>
              <li>Password (stored securely using industry-standard hashing)</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-2">
              2.2 Voter Management Data
            </h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Voter names and contact information</li>
              <li>Geographic ward/zone assignments</li>
              <li>Voting status records</li>
            </ul>

            <h3 className="text-lg font-medium text-gray-800 mb-2">
              2.3 Usage Data
            </h3>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Login timestamps and session information</li>
              <li>IP addresses (for security)</li>
              <li>Browser type and device information</li>
              <li>Actions performed within the system (audit logs)</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>To provide and maintain the voter management service</li>
              <li>To authenticate users and protect accounts</li>
              <li>To generate reports and analytics for your campaign</li>
              <li>To detect and prevent security incidents</li>
              <li>To comply with legal obligations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. Data Storage and Security
            </h2>
            <p className="text-gray-700 mb-4">
              We implement industry-standard security measures to protect your data:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>All data is encrypted in transit (HTTPS/TLS)</li>
              <li>Passwords are hashed using Argon2 algorithm</li>
              <li>Database access is restricted and logged</li>
              <li>Regular security audits are performed</li>
              <li>Multi-factor authentication is available</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Multi-Tenant Data Isolation
            </h2>
            <p className="text-gray-700 mb-4">
              VMS is a multi-tenant platform. Your data is strictly isolated from other users:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Each candidate/organization has a separate data partition</li>
              <li>Cross-tenant data access is technically impossible</li>
              <li>All queries are automatically filtered by tenant ID</li>
              <li>Regular isolation testing is performed</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Data Retention
            </h2>
            <p className="text-gray-700 mb-4">
              We retain your data according to the following policies:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Active account data: Retained while account is active</li>
              <li>Audit logs: 6 months (for compliance)</li>
              <li>Deleted voters: Soft-deleted for 90 days, then permanently removed</li>
              <li>Session data: Automatically cleaned after expiration</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Your Rights
            </h2>
            <p className="text-gray-700 mb-4">
              You have the right to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Access your personal data</li>
              <li>Export your data (via CSV export features)</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your account and data</li>
              <li>Withdraw consent for data processing</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Third-Party Services
            </h2>
            <p className="text-gray-700 mb-4">
              We may use third-party services for:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Error monitoring and logging</li>
              <li>CAPTCHA verification</li>
              <li>Email notifications (if enabled)</li>
            </ul>
            <p className="text-gray-700">
              These services have their own privacy policies and we ensure they meet 
              appropriate data protection standards.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Contact Us
            </h2>
            <p className="text-gray-700 mb-4">
              For privacy-related inquiries, please contact:
            </p>
            <p className="text-gray-700">
              Email: privacy@example.com<br />
              Address: [Your Business Address]
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. Changes to This Policy
            </h2>
            <p className="text-gray-700">
              We may update this Privacy Policy from time to time. We will notify you of 
              any changes by posting the new Privacy Policy on this page and updating the 
              "Last Updated" date.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default PrivacyPolicyPage;
