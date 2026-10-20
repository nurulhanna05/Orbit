"use client"

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { Bell, Menu, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useAnomaly } from '@/components/providers/anomaly-provider';
import { Button } from '@/components/ui/button';
import { ModeToggle } from '@/components/layout/mode-toggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { PrivacyStatusBadge } from '@/components/anomaly/privacy-shield';
import { SimulateMenu } from '@/components/anomaly/simulate-menu';
import NavLinks from './nav-links';
import { OrbitLogo } from './orbit-logo';
import { DETECTION_CLASSES } from '@/lib/anomaly/taxonomy';
import { SeverityIcon } from '@/components/anomaly/status';

export function Brand() {
  const { settings } = useAnomaly();
  return (
    <div className="flex items-center gap-3">
      <OrbitLogo className="h-10" />
      <p className="border-l pl-3 text-xs leading-tight text-muted-foreground">{settings.township}</p>
    </div>
  );
}

export default function Header() {
  const { user, logout } = useAuth();
  const { alerts, markAlertRead, markAllAlertsRead } = useAnomaly();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const unread = alerts.filter(a => !a.read && a.status !== 'resolved');

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b bg-card">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <div className="md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] overflow-y-auto">
              <SheetHeader className="mb-4">
                <SheetTitle>
                  <Brand />
                </SheetTitle>
              </SheetHeader>
              <NavLinks onNavigate={() => setIsMobileMenuOpen(false)} />
            </SheetContent>
          </Sheet>
        </div>

        <div className="hidden sm:block">
          <Brand />
        </div>

        <div className="flex-1 flex items-center justify-end gap-2 md:gap-3">
          <div className="hidden lg:block">
            <PrivacyStatusBadge />
          </div>
          <div className="lg:hidden">
            <PrivacyStatusBadge compact />
          </div>
          <div className="hidden md:block">
            <SimulateMenu />
          </div>
          <div className="md:hidden">
            <SimulateMenu size="icon" />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="relative"
                aria-label={unread.length > 0 ? `Notifications, ${unread.length} unread` : 'Notifications'}
              >
                <Bell className="h-5 w-5" aria-hidden />
                {unread.length > 0 && (
                  <Badge
                    aria-hidden
                    className="absolute -right-1.5 -top-1.5 min-w-5 justify-center px-1"
                  >
                    {unread.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <h2 className="text-sm font-semibold">Unread alerts</h2>
                {unread.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={markAllAlertsRead}>
                    Mark all read
                  </Button>
                )}
              </div>
              <div className="max-h-[320px] overflow-y-auto">
                {unread.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">No unread alerts</p>
                ) : (
                  unread.slice(0, 6).map(alert => (
                    <button
                      key={alert.id}
                      className="flex w-full items-start gap-3 border-b p-3 text-left last:border-0 hover:bg-accent"
                      onClick={() => {
                        markAlertRead(alert.id);
                        router.push(`/dashboard/alerts?focus=${alert.id}`);
                      }}
                    >
                      <SeverityIcon severity={alert.severity} className="mt-0.5" />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">
                          {DETECTION_CLASSES[alert.detectionClass].label} · {alert.cameraName}
                        </span>
                        <span className="block text-xs text-muted-foreground line-clamp-2">{alert.message}</span>
                        <span className="block text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
              <div className="p-2 border-t text-center">
                <Button variant="link" size="sm" className="w-full" asChild>
                  <Link href="/dashboard/alerts">Open alert centre</Link>
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          <ModeToggle />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="secondary" className="relative h-10 w-10 rounded-full p-0 max-md:min-w-11" aria-label="Account menu">
                <Avatar className="h-10 w-10 max-md:h-11 max-md:w-11">
                  <AvatarFallback className="text-xs font-semibold">OPS</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <p className="text-sm font-medium leading-none">{user?.name}</p>
                <p className="text-xs leading-none text-muted-foreground mt-1">@{user?.username}</p>
                <Badge variant="outline" className="w-fit mt-2">
                  Township operator
                </Badge>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push('/dashboard/settings')}>
                <SettingsIcon className="h-4 w-4 mr-2" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
