import React from 'react';

/**
 * Terms of Service Page
 * =====================
 * 
 * Required legal page for production deployment.
 * Defines usage terms and legal disclaimers.
 */
export function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Terms of Service</h1>
        
        <p className="text-sm text-gray-500 mb-8">
          Last Updated: February 2026
        </p>

        <div className="prose prose-blue max-w-none">
          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-700 mb-4">
              By accessing or using the Voter Management System ("VMS", "Service"), you agree 
              to be bound by these Terms of Service. If you do not agree to these terms, 
              do not use the Service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              2. Description of Service
            </h2>
            <p className="text-gray-700 mb-4">
              VMS is a voter management platform designed to help political candidates and 
              organizations manage voter outreach and track engagement. The Service provides:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Voter database management</li>
              <li>Geographic zone organization</li>
              <li>Team collaboration tools</li>
              <li>Reporting and analytics</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              3. Legal Disclaimer
            </h2>
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <p className="text-yellow-800 font-medium">
                IMPORTANT LEGAL NOTICE
              </p>
            </div>
            <p className="text-gray-700 mb-4">
              <strong>This system does NOT store official electoral roll data.</strong> VMS is 
              a campaign management tool and is not affiliated with any government election 
              commission or official electoral body.
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>
                <strong>Location data</strong> is sourced from publicly available government 
                datasets and is provided "as-is" for reference purposes only.
              </li>
              <li>
                <strong>Voter information</strong> stored in this system is entered by users 
                and is not verified against official records.
              </li>
              <li>
                Users are solely responsible for the accuracy and legality of data they enter.
              </li>
              <li>
                This platform should not be used for any unlawful purpose.
              </li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              4. User Responsibilities
            </h2>
            <p className="text-gray-700 mb-4">
              As a user of VMS, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Provide accurate registration information</li>
              <li>Maintain the security of your account credentials</li>
              <li>Not share your account with unauthorized persons</li>
              <li>Use the Service in compliance with all applicable laws</li>
              <li>Respect the privacy of individuals whose data you manage</li>
              <li>Not attempt to access other users' data or accounts</li>
              <li>Report any security vulnerabilities responsibly</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              5. Data Handling
            </h2>
            <p className="text-gray-700 mb-4">
              We implement strict role-based access control:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Admin users have full access to their organization's data</li>
              <li>Sub-users are restricted to assigned wards/zones only</li>
              <li>No cross-tenant data access is permitted</li>
              <li>All data access is logged for audit purposes</li>
            </ul>
            <p className="text-gray-700">
              For full details on data handling, please refer to our{' '}
              <a href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </a>.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              6. Prohibited Uses
            </h2>
            <p className="text-gray-700 mb-4">
              You may not use VMS to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Store or transmit any illegal content</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with the Service's operation</li>
              <li>Attempt to gain unauthorized access to any systems</li>
              <li>Scrape or harvest data from the platform</li>
              <li>Use automated scripts without authorization</li>
              <li>Violate election laws or regulations</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              7. Account Suspension and Termination
            </h2>
            <p className="text-gray-700 mb-4">
              We reserve the right to suspend or terminate accounts that:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-4">
              <li>Violate these Terms of Service</li>
              <li>Engage in suspicious or malicious activity</li>
              <li>Fail to maintain accurate account information</li>
              <li>Create security risks for other users</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              8. Limitation of Liability
            </h2>
            <p className="text-gray-700 mb-4">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. WE SHALL NOT 
              BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE 
              DAMAGES ARISING OUT OF YOUR USE OF THE SERVICE.
            </p>
            <p className="text-gray-700 mb-4">
              In no event shall our total liability exceed the amount paid by you for 
              the Service in the twelve (12) months preceding the claim.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              9. Indemnification
            </h2>
            <p className="text-gray-700 mb-4">
              You agree to indemnify and hold harmless VMS, its affiliates, and their 
              respective officers, directors, employees, and agents from any claims, 
              damages, losses, or expenses arising from your use of the Service or 
              violation of these terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              10. Changes to Terms
            </h2>
            <p className="text-gray-700 mb-4">
              We may modify these Terms at any time. Material changes will be communicated 
              via email or prominent notice on the platform. Continued use of the Service 
              after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              11. Governing Law
            </h2>
            <p className="text-gray-700 mb-4">
              These Terms shall be governed by and construed in accordance with the laws 
              of [Jurisdiction], without regard to its conflict of law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              12. Contact Information
            </h2>
            <p className="text-gray-700">
              For questions about these Terms, please contact us at:<br />
              Email: legal@example.com<br />
              Address: [Your Business Address]
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

export default TermsOfServicePage;
