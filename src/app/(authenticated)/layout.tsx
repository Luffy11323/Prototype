import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NavigationShell from '@/components/NavigationShell';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  console.log('LAYOUT AUTH CHECK:', {
    hasUser: !!user,
    userEmail: user?.email,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'DEFINED' : 'UNDEFINED',
  });

  if (!user) {
    redirect('/login');
  }

  // Fetch business info
  const businessId = user.user_metadata?.business_id;
  let businessName = 'Wholesale Tracker';

  if (businessId) {
    const { data: business } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', businessId)
      .single();

    if (business) {
      businessName = business.name;
    }
  }

  return <NavigationShell businessName={businessName}>{children}</NavigationShell>;
}
