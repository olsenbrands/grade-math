import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user needs onboarding
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        // Check if profile is complete
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, school_name')
          .eq('id', user.id)
          .single();

        // If profile doesn't exist or is incomplete, redirect to onboarding
        if (!profile || !profile.full_name || !profile.school_name) {
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host');
      const isLocalEnv = process.env.NODE_ENV === 'development';

      if (isLocalEnv) {
        return NextResponse.redirect(`${origin}${next}`);
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`);
      } else {
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`);
}
