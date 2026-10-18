import AppShell from '@/components/layout/app-shell';
import { AnomalyProvider } from '@/components/providers/anomaly-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AnomalyProvider>
      <AppShell>{children}</AppShell>
    </AnomalyProvider>
  );
}
