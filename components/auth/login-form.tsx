"use client"

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { isDemoLogin, useAuth } from '@/components/providers/auth-provider';
import { Loader2, ScanEye, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const loginSchema = z.object({
  username: z.string().min(1, { message: "Username is required" }),
  password: z.string().min(1, { message: "Password is required" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginForm() {
  const [isLoading, setIsLoading] = useState(false);
  const [systemName, setSystemName] = useState('AnomalyGuard');
  const { login } = useAuth();
  const { toast } = useToast();

  // Load system name from localStorage on component mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSettings = localStorage.getItem('generalSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.systemName) {
            setSystemName(settings.systemName);
          }
        }
      } catch (error) {
        console.error('Error loading system name:', error);
      }
    }
  }, []);

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setIsLoading(true);
    try {
      await login(values.username, values.password);
      toast({
        title: "Login successful",
        description: `Welcome back to ${systemName}`,
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid credentials",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-border/40">
      <CardHeader className="space-y-1 text-center">
        <div className="flex items-center justify-center">
          <div className="rounded-lg bg-emerald-600 p-2 text-white mb-2"><ScanEye className="h-8 w-8" /></div>
        </div>
        <CardTitle className="text-2xl font-semibold">{systemName}</CardTitle>
        <CardDescription>SDP Township · City of Elmina<br />Township operations &amp; predictive maintenance</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter username" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
          </form>
        </Form>
        <div className="mt-5 flex items-start gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200">
          <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
          <p>
            Privacy-by-design, aligned with PDPA principles: AnomalyGuard detects object states, hazards and anonymous
            behaviour, with no facial recognition. Access is for authorised operators only, and evidence snapshots are
            always anonymised.
          </p>
        </div>
        {isDemoLogin && (
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            Demo login: admin / admin (demo build only; not for public deployment)
          </p>
        )}
      </CardContent>
    </Card>
  );
}