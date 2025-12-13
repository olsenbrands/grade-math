import Link from 'next/link';
import Image from 'next/image';

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="iGradeMath" width={32} height={32} className="rounded" />
            <span className="text-xl font-bold">iGradeMath</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-gray-600 hover:text-gray-900">
              Sign In
            </Link>
            <Link href="/signup" className="bg-gray-900 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800">
              Try Free
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-12 max-w-3xl">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8">Last updated: December 12, 2025</p>

        <div className="prose prose-gray max-w-none">
          {/* Introduction */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Introduction</h2>
            <p className="text-gray-700 leading-relaxed">
              iGradeMath is built for teachers and takes privacy seriously. We understand that you trust us
              with sensitive information — your assignments, your students&apos; work, and your classroom data.
              This policy explains what we collect, how we use it, and how we protect it.
            </p>
          </section>

          {/* Information We Collect */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We collect only what&apos;s necessary to provide our grading service:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mb-4">
              <li><strong>Account information:</strong> Your name, email address, and school (optional)</li>
              <li><strong>Uploaded content:</strong> Answer keys and student assignments you submit for grading</li>
              <li><strong>Usage data:</strong> Basic information like papers graded, grading accuracy, and flagged items</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>What we do NOT collect:</strong>
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>We do not sell your data to anyone</li>
              <li>We do not collect sensitive personal data beyond what you upload</li>
              <li>We do not build profiles on individual students</li>
              <li>We do not track you across other websites</li>
            </ul>
          </section>

          {/* How We Use Information */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Information</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your data is used only to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Grade assignments you submit</li>
              <li>Improve grading accuracy and reliability</li>
              <li>Provide customer support when you need help</li>
              <li>Maintain and improve the service</li>
              <li>Send important account notifications</li>
            </ul>
          </section>

          {/* Student Data & FERPA */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Student Data & FERPA Awareness</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We designed iGradeMath with classroom privacy in mind:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>You retain full ownership</strong> of all uploaded content — answer keys, student work, and grading results</li>
              <li><strong>Student work is never sold</strong> or used for advertising purposes</li>
              <li><strong>Uploaded assignments are not used</strong> to train public AI models</li>
              <li><strong>Designed for FERPA-aligned workflows</strong> — we support your compliance efforts</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              Teachers control their data. You can delete assignments, student information, and your account at any time.
            </p>
          </section>

          {/* Data Storage & Security */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Storage & Security</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We take reasonable measures to protect your information:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Industry-standard security practices are used throughout our systems</li>
              <li>Data is encrypted in transit using HTTPS</li>
              <li>Data at rest is encrypted where appropriate</li>
              <li>Access to data is limited to authorized systems and personnel</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Third-Party Services</h2>
            <p className="text-gray-700 leading-relaxed">
              We use trusted third-party infrastructure and AI providers strictly to operate the service.
              These providers process data on our behalf and are not permitted to use your data for their
              own purposes. We choose partners who maintain strong privacy and security standards.
            </p>
          </section>

          {/* Data Retention */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Retention</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We keep your data only as long as needed:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>You may delete assignments and student data at any time</li>
              <li>When you delete your account, your data is removed from our active systems</li>
              <li>Some data may be retained in backups for a limited time or as required by law</li>
            </ul>
          </section>

          {/* Contact */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions about this privacy policy or how we handle your data, please contact us at:{' '}
              <a href="mailto:support@igrademath.com" className="text-green-600 hover:text-green-700 underline">
                support@igrademath.com
              </a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo-icon.png" alt="iGradeMath" width={24} height={24} className="rounded" />
              <span className="font-semibold">iGradeMath</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
              <Link href="/privacy" className="hover:text-gray-700 font-medium text-gray-900">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-700">Terms</Link>
              <a href="mailto:support@igrademath.com" className="hover:text-gray-700">Support</a>
            </div>
            <p className="text-sm text-gray-500">
              &copy; {new Date().getFullYear()} iGradeMath
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
