import Image from 'next/image';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="mb-8 flex items-center gap-4">
        <Image
          src="/logo-icon.png"
          alt="iGradeMath"
          width={80}
          height={80}
          className="rounded-xl"
        />
        <span className="text-4xl font-bold text-gray-900 dark:text-white">iGradeMath</span>
      </div>
      <div className="w-full max-w-md">
        {children}
      </div>
    </div>
  );
}
