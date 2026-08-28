'use main-site';
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ClipboardList, PlusCircle, Users, LogOut, ShoppingBag } from 'lucide-react';

interface NavigationShellProps {
  children: React.ReactNode;
  businessName: string;
}

export default function NavigationShell({ children, businessName }: NavigationShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.refresh();
    router.push('/login');
  };

  const navItems = [
    {
      name: 'Orders',
      href: '/dashboard',
      icon: ClipboardList,
    },
    {
      name: 'New Order',
      href: '/orders/new',
      icon: PlusCircle,
    },
    {
      name: 'Customers',
      href: '/customers',
      icon: Users,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-900 bg-slate-950/80 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-indigo-600/10 p-2 text-indigo-400 border border-indigo-500/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <span className="font-semibold text-sm sm:text-base tracking-tight text-white max-w-[180px] sm:max-w-none truncate">
              {businessName}
            </span>
          </div>

          {/* Desktop Logout Button */}
          <div className="flex items-center gap-4">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-all duration-200"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="flex-1 pb-24 md:pb-8 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Mobile / Universal Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-900 bg-slate-950/90 backdrop-blur-xl px-2 py-1.5 pb-safe">
        <div className="max-w-md mx-auto flex justify-around items-center">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex flex-col items-center gap-1 py-1 px-3 rounded-2xl min-w-[72px] transition-all duration-200 ${
                  isActive
                    ? 'text-indigo-400 bg-indigo-600/10'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-900/30'
                }`}
              >
                <Icon className="h-6 w-6 stroke-[2]" />
                <span className="text-[10px] font-medium tracking-wide">{item.name}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
