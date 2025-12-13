'use client';

import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, Upload, FileCheck, Clock, CheckCircle, Shield, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="iGradeMath" width={36} height={36} className="rounded" />
            <span className="text-xl font-bold">iGradeMath</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/pricing" className="text-sm text-gray-600 hover:text-gray-900 hidden sm:block">
              Pricing
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Try Free</Button>
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className="py-16 md:py-24 bg-gradient-to-b from-green-50/50 to-white">
          <div className="container mx-auto px-4 text-center max-w-4xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 mb-6">
              Grade Math Assignments in Minutes — Not Your Evenings
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Upload an answer key and student work. iGradeMath grades the entire class and flags only what needs your attention.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="text-lg px-8 py-6 h-auto">
                  Try It Free — Grade 10 Papers
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <p className="text-sm text-gray-500">
                No credit card required &bull; FERPA-aware &bull; You own your data
              </p>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-gray-600 text-center mb-12 max-w-2xl mx-auto">
              Three simple steps. Upload, grade, review. That&apos;s it.
            </p>

            <div className="grid md:grid-cols-3 gap-8 md:gap-12">
              {/* Step 1 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Upload className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-sm font-medium text-green-600 mb-2">Step 1</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Upload the Answer Key
                </h3>
                <p className="text-gray-600">
                  PDF, photo, or scanned worksheet.
                </p>
              </div>

              {/* Step 2 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-sm font-medium text-green-600 mb-2">Step 2</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Upload Student Work
                </h3>
                <p className="text-gray-600">
                  PDFs or photos — one student or the whole class.
                </p>
              </div>

              {/* Step 3 */}
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <FileCheck className="h-8 w-8 text-green-600" />
                </div>
                <div className="text-sm font-medium text-green-600 mb-2">Step 3</div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  Click Grade
                </h3>
                <p className="text-gray-600">
                  Get scores instantly. Review only flagged answers.
                </p>
              </div>
            </div>

            {/* Visual flow indicator */}
            <div className="mt-12 text-center">
              <div className="inline-flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-4 py-2 rounded-full">
                <span>Upload</span>
                <ArrowRight className="h-4 w-4" />
                <span>Grade</span>
                <ArrowRight className="h-4 w-4" />
                <span>Review</span>
                <ArrowRight className="h-4 w-4" />
                <span className="font-medium text-green-600">Done</span>
              </div>
            </div>
          </div>
        </section>

        {/* Why Teachers Use iGradeMath */}
        <section className="py-16 md:py-20 bg-gray-50">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-12">
              Why Teachers Use iGradeMath
            </h2>

            <div className="grid sm:grid-cols-2 gap-6">
              <div className="flex items-start gap-4 bg-white p-6 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Save hours every week</h3>
                  <p className="text-gray-600 text-sm">Stop spending evenings with a red pen. Grade an entire class in minutes.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white p-6 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Grade consistently and fairly</h3>
                  <p className="text-gray-600 text-sm">Same standards applied to every paper, every time.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white p-6 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <FileCheck className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Catch mistakes automatically</h3>
                  <p className="text-gray-600 text-sm">Focus only on flagged answers that need your attention.</p>
                </div>
              </div>

              <div className="flex items-start gap-4 bg-white p-6 rounded-xl">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                  <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-1">Get your evenings back</h3>
                  <p className="text-gray-600 text-sm">Spend time on what matters — not grading.</p>
                </div>
              </div>
            </div>

            <p className="text-center text-gray-500 mt-8">
              Used by teachers to grade entire classes in under 10 minutes.
            </p>
          </div>
        </section>

        {/* Trust & Privacy */}
        <section className="py-16 md:py-20 bg-white">
          <div className="container mx-auto px-4 max-w-4xl">
            <div className="flex items-center justify-center gap-3 mb-4">
              <Shield className="h-8 w-8 text-green-600" />
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
                Built for Classrooms
              </h2>
            </div>
            <p className="text-lg text-gray-600 text-center mb-10 max-w-2xl mx-auto">
              Your data stays yours. We built iGradeMath with teacher and student privacy in mind.
            </p>

            <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-gray-700">You own your assignments and student work</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-gray-700">Student data is never sold or used for ads</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-gray-700">Not used to train public AI models</span>
              </div>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                <span className="text-gray-700">Designed for FERPA-aligned workflows</span>
              </div>
            </div>

            <div className="flex justify-center gap-6 mt-8 text-sm">
              <Link href="/privacy" className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-gray-500 hover:text-gray-700 underline underline-offset-2">
                Terms of Service
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing Preview */}
        <section className="py-16 md:py-20 bg-gray-50">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Simple, Teacher-Friendly Pricing
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Start free. Upgrade when you&apos;re ready.
            </p>

            <div className="bg-white rounded-2xl shadow-sm border p-8 max-w-md mx-auto">
              <div className="text-sm font-medium text-green-600 mb-2">Most Popular</div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Classroom Teacher</h3>
              <div className="flex items-baseline justify-center gap-1 mb-4">
                <span className="text-4xl font-bold text-gray-900">$19</span>
                <span className="text-gray-500">/month</span>
              </div>

              <ul className="text-left space-y-3 mb-6">
                <li className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  Grade up to 300 papers per month
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  Plans as low as $0.04 per paper
                </li>
                <li className="flex items-center gap-2 text-gray-700">
                  <CheckCircle className="h-5 w-5 text-green-600 shrink-0" />
                  Add more anytime — no shutdowns
                </li>
              </ul>

              <Link href="/pricing">
                <Button variant="outline" className="w-full">
                  See full pricing
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 md:py-24 bg-green-600">
          <div className="container mx-auto px-4 text-center max-w-3xl">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
              Ready to stop grading by hand?
            </h2>
            <p className="text-xl text-green-100 mb-8">
              Join teachers who are saving hours every week with iGradeMath.
            </p>
            <div className="flex flex-col items-center gap-4">
              <Link href="/signup">
                <Button size="lg" variant="secondary" className="text-lg px-8 py-6 h-auto">
                  Grade 10 Papers Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <p className="text-sm text-green-100">
                No credit card required
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t bg-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo-icon.png" alt="iGradeMath" width={24} height={24} className="rounded" />
              <span className="font-semibold">iGradeMath</span>
            </div>
            <div className="flex gap-6 text-sm text-gray-500">
              <Link href="/pricing" className="hover:text-gray-700">Pricing</Link>
              <Link href="/privacy" className="hover:text-gray-700">Privacy</Link>
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
