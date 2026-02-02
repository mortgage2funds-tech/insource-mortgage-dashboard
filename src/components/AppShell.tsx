'use client';
import { createClient } from '@/lib/supabase';
import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';

type AppShellProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

function getInitials(name?: string, email?: string) {
  const base = (name?.trim() || email?.split('@')[0] || 'U').trim();
  const parts = base.split(/[.\s_-]+/).filter(Boolean);
  const a = parts[0]?.[0] ?? 'U';
  const b = parts[1]?.[0] ?? '';
  return (a + b).toUpperCase();
}

function UserChip() {
  const supabase = React.useMemo(() => createClient(), []);
  const [email, setEmail] = React.useState('');
  const [name, setName] = React.useState('');

  React.useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data?.user;

      if (!mounted) return;

      const e = user?.email ?? '';
      const n =
        (user?.user_metadata as any)?.full_name ||
        (user?.user_metadata as any)?.name ||
        '';

      setEmail(e);
      setName(n);
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      const user = session?.user;
      const e = user?.email ?? '';
      const n =
        (user?.user_metadata as any)?.full_name ||
        (user?.user_metadata as any)?.name ||
        '';

      setEmail(e);
      setName(n);
    });

    return () => {
      mounted = false;
      sub?.subscription?.unsubscribe();
    };
  }, [supabase]);

  if (!email && !name) return null;

  return (
    <div className="flex items-center gap-3 rounded-full border bg-white px-3 py-1">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold text-gray-700">
        {getInitials(name, email)}
      </div>
      <div className="leading-tight">
        <div className="text-sm font-medium text-gray-900">{name || 'Signed in'}</div>
        <div className="text-xs text-gray-600">{email}</div>
      </div>
    </div>
  );
}


export default function AppShell({ title, subtitle, children }: AppShellProps) {
  const pathname = usePathname();

  const nav = [
    { label: 'Dashboard', href: '/' },
    { label: 'Analytics', href: '/analytics' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-7xl">
        <div className="flex min-h-screen">
          {/* Sidebar */}
          <aside className="hidden w-64 shrink-0 border-r bg-white lg:block">
            <div className="p-5">
             <div className="relative h-20 w-20  overflow-hidden rounded-xl bg-white">
  <Image
    src="/insource-logo.png"
    alt="Insource"
    fill
    className="object-contain"
    priority
  />
</div>

              <div className="mt-1 text-xs text-gray-500">Operations Dashboard</div>
            </div>
           <nav className="px-3 pb-6">
  <div className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
    Navigation
  </div>

  <div className="space-y-1">
    {nav.map((item) => {
      const active = pathname === item.href;

      return (
        <Link
          key={item.href}
          href={item.href}
          aria-current={active ? 'page' : undefined}
          className={[
            'group relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition',
            'focus:outline-none focus:ring-2 focus:ring-blue-600/30',
            active
              ? 'bg-blue-600 text-white shadow-sm'
              : 'text-gray-700 hover:bg-gray-100',
          ].join(' ')}
        >
          {/* Active indicator */}
          <span
            className={[
              'h-2 w-2 rounded-full transition',
              active ? 'bg-white' : 'bg-gray-300 group-hover:bg-gray-400',
            ].join(' ')}
            aria-hidden="true"
          />

          <span className="font-medium">{item.label}</span>

          {/* Subtle chevron on hover */}
          <span
            className={[
              'ml-auto text-xs transition',
              active ? 'text-white/80' : 'text-gray-400 group-hover:text-gray-500',
            ].join(' ')}
            aria-hidden="true"
          >
            →
          </span>
        </Link>
      );
    })}
  </div>
</nav>

        </aside>

          {/* Main */}
          <div className="flex-1">
            <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur">
              <div className="mx-auto max-w-7xl px-4 py-4 lg:px-6">
              <div className="flex items-start justify-between gap-4">
  <div>
    <div className="text-lg font-semibold text-gray-900">{title}</div>
    {subtitle ? <div className="text-sm text-gray-600">{subtitle}</div> : null}
  </div>

  <UserChip />
</div>

              </div>
            </header>

            <main className="mx-auto max-w-7xl px-4 py-5 lg:px-6">
              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

