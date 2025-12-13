import Link from 'next/link';
import Image from 'next/image';

export default function TermsOfServicePage() {
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
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 mb-8">Last updated: December 12, 2025</p>

        <div className="prose prose-gray max-w-none">
          {/* Acceptance */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptance of Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              By accessing or using iGradeMath, you agree to be bound by these Terms of Service.
              If you do not agree to these terms, please do not use the service. These terms apply
              to all users, including teachers, administrators, and any other visitors.
            </p>
          </section>

          {/* Description of Service */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Description of Service</h2>
            <p className="text-gray-700 leading-relaxed">
              iGradeMath provides AI-assisted grading tools for math assignments. Teachers upload
              answer keys and student work, and our system grades the submissions, flagging items
              that may need human review. The service is designed to save teachers time while
              maintaining accuracy in grading.
            </p>
          </section>

          {/* Ownership of Content */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ownership of Content</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your content remains yours:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>You retain full ownership of all uploaded content, including answer keys, student assignments, and grading results</li>
              <li>iGradeMath does not claim any ownership rights over your materials</li>
              <li>You grant us only the limited rights needed to provide the grading service</li>
            </ul>
          </section>

          {/* AI Grading Disclaimer */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">AI-Assisted Grading Disclaimer</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Please understand the following about our AI grading:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li><strong>AI grading is advisory, not authoritative.</strong> Our system provides suggested grades and flags potential issues, but it is not a replacement for teacher judgment.</li>
              <li><strong>Teachers are responsible for final grading decisions.</strong> We recommend reviewing flagged items and spot-checking results.</li>
              <li><strong>We do not guarantee error-free grading.</strong> While we strive for accuracy, AI systems can make mistakes, especially with unclear handwriting or unusual problem formats.</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              By using iGradeMath, you acknowledge that final grading responsibility rests with you as the teacher.
            </p>
          </section>

          {/* Acceptable Use */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Acceptable Use</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              When using iGradeMath, you agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>Upload unlawful, harmful, or abusive content</li>
              <li>Attempt to reverse engineer, decompile, or extract source code from the platform</li>
              <li>Use the service in ways that violate student privacy laws or school policies</li>
              <li>Share your account credentials or allow unauthorized access</li>
              <li>Use automated tools to scrape or access the service beyond normal use</li>
              <li>Interfere with or disrupt the service or servers</li>
            </ul>
          </section>

          {/* Subscription & Billing */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Subscription & Billing</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Our subscription terms:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>iGradeMath operates on a monthly subscription model</li>
              <li>Paper limits reset at the beginning of each billing cycle</li>
              <li>Purchased overage packs (additional papers) do not expire while your subscription is active</li>
              <li>Subscription fees are charged in advance and are non-refundable except where required by law</li>
              <li>You may cancel your subscription at any time; access continues until the end of the billing period</li>
            </ul>
          </section>

          {/* Service Availability */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Service Availability</h2>
            <p className="text-gray-700 leading-relaxed">
              We work hard to keep iGradeMath available, but we cannot guarantee uninterrupted access.
              The service may be temporarily unavailable for maintenance, updates, or due to circumstances
              beyond our control. We may also modify or discontinue features as the service evolves.
              We&apos;ll try to provide notice of significant changes when possible.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Limitation of Liability</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To the extent permitted by law:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>iGradeMath is not liable for grading errors or any academic decisions based on our service</li>
              <li>We are not responsible for any indirect, incidental, or consequential damages</li>
              <li>Our total liability is limited to the amount you paid for the service in the 12 months preceding any claim</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mt-4">
              This limitation applies to the fullest extent permitted by applicable law.
            </p>
          </section>

          {/* Termination */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Termination</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Regarding account termination:
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2">
              <li>You may cancel your account at any time through your account settings or by contacting support</li>
              <li>We may suspend or terminate accounts that violate these terms or engage in abusive behavior</li>
              <li>Upon termination, your right to use the service ends, but you may request your data before deletion</li>
            </ul>
          </section>

          {/* Changes to Terms */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Changes to Terms</h2>
            <p className="text-gray-700 leading-relaxed">
              We may update these terms from time to time. When we make significant changes, we&apos;ll
              notify you by email or through the service. Your continued use of iGradeMath after
              changes take effect constitutes acceptance of the updated terms. If you don&apos;t agree
              to the new terms, please discontinue use of the service.
            </p>
          </section>

          {/* Contact */}
          <section className="mb-10">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have questions about these terms, please contact us at:{' '}
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
              <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-700 font-medium text-gray-900">Terms</Link>
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
