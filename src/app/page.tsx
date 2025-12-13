import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LandingPage from '@/components/marketing/LandingPage';

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    // Check if user has completed onboarding
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, school, grade_level')
      .eq('id', user.id)
      .single();

    if (profile && profile.full_name && profile.school) {
      redirect('/assignments');
    } else {
      redirect('/onboarding');
    }
  }

  // Show landing page for logged-out users
  return <LandingPage />;
}
