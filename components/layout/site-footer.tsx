import { Github } from 'lucide-react';
import { cn } from '@/lib/utils';

const TEAM = [
  { name: 'Nurul Hanna binti Abdul Halim', github: 'nurulhanna05' },
  { name: 'Nur Hannah binti Muhammad Yuri', github: 'hana-yur' },
  { name: 'Rasya Aleeya binti Mohd Shakri', github: 'rasyashakri05' },
  { name: 'Siti Najah Nurdini binti Mohd Amran', github: 'nurdini1645' },
];

const link = 'underline-offset-4 transition-colors hover:text-foreground hover:underline';

// Team credit and the open-source base, shown under every dashboard page and on the login screen.
export function SiteFooter({ className }: { className?: string }) {
  return (
    <footer className={cn('border-t pt-6 text-xs text-muted-foreground', className)}>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-1">
          <p>
            <span className="font-medium text-foreground">Orbit</span> by <span className="font-medium text-foreground">SheCodes</span>,
            built for the Sime Darby Property Hackathon 2026.
          </p>
          <p>
            Based on{' '}
            <a href="https://github.com/rudra-sah00/A-AI" target="_blank" rel="noopener noreferrer" className={link}>
              rudra-sah00/A-AI
            </a>{' '}
            (MIT License). © 2026 SheCodes.
          </p>
        </div>
        <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2" aria-label="Team SheCodes">
          {TEAM.map(member => (
            <li key={member.github}>
              <a
                href={`https://github.com/${member.github}`}
                target="_blank"
                rel="noopener noreferrer"
                className={cn('inline-flex items-center gap-1.5', link)}
              >
                <Github className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {member.name}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
