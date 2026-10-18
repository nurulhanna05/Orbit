"use client"

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { ScanEye, Bell, Menu, LogOut, Settings as SettingsIcon } from 'lucide-react';
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
import { PrivacyShieldBadge } from '@/components/anomaly/privacy-shield';
import { SimulateMenu } from '@/components/anomaly/simulate-menu';
import NavLinks from './nav-links';
import { DETECTION_CLASSES, SEVERITY_META } from '@/lib/anomaly/taxonomy';

export function Brand({ size = 'md' }: { size?: 'md' | 'lg' }) {
  const { settings } = useAnomaly();
  return (
    <div className="flex items-center gap-2">
      <div className="rounded-md bg-emerald-600 p-1.5 text-white">
        <ScanEye className={size === 'lg' ? 'h-6 w-6' : 'h-5 w-5'} />
      </div>
      <div className="leading-tight">
        <p className="font-semibold tracking-tight">{settings.systemName}</p>
        <p className="text-[11px] text-muted-foreground">{settings.township}</p>
      </div>
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
    <motion.header
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60"
    >
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <div className="md:hidden">
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon">
                <Menu className="h-5 w-5" />
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
            <PrivacyShieldBadge />
          </div>
          <div className="lg:hidden">
            <PrivacyShieldBadge compact />
          </div>
          <div className="hidden md:block">
            <SimulateMenu />
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell className="h-[1.2rem] w-[1.2rem]" />
                {unread.length > 0 && (
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 min-w-5 p-0 px-1 flex items-center justify-center text-[10px]"
                  >
                    {unread.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[380px] p-0" align="end">
              <div className="flex items-center justify-between p-3 border-b">
                <h4 className="font-medium">Operational alerts</h4>
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
                      className="flex w-full items-start gap-3 p-3 text-left border-b last:border-0 hover:bg-muted/50"
                      onClick={() => {
                        markAlertRead(alert.id);
                        router.push(`/dashboard/alerts?focus=${alert.id}`);
                      }}
                    >
                      <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_META[alert.severity].dot}`} />
                      <span className="flex-1">
                        <span className="block text-sm font-medium">
                          {DETECTION_CLASSES[alert.detectionClass].label} · {alert.cameraName}
                        </span>
                        <span className="block text-xs text-muted-foreground line-clamp-2">{alert.message}</span>
                        <span className="block text-[11px] text-muted-foreground/80">
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
              <Button variant="secondary" className="relative h-9 w-9 rounded-full p-0">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>OPS</AvatarFallback>
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
    </motion.header>
  );
}
