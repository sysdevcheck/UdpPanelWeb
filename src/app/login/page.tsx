
'use client';

import { useActionState, useEffect, useState } from 'react';
import { login } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Info } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, undefined);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');

  const isDefaultUserMessage = state?.error?.includes('default user');

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form action={formAction}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Login</CardTitle>
            <CardDescription>
              Enter your manager credentials to access the panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {state && state.error && (
               <Alert variant={isDefaultUserMessage ? 'default' : 'destructive'} className={isDefaultUserMessage ? 'bg-blue-900/20 border-blue-500/50' : ''}>
                  {isDefaultUserMessage ? <Info className="h-4 w-4" /> : <Terminal className="h-4 w-4" />}
                  <AlertTitle>{isDefaultUserMessage ? 'Welcome!' : 'Login Failed'}</AlertTitle>
                  <AlertDescription>
                    {state.error}
                  </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" name="username" type="text" required value={username} onChange={e => setUsername(e.target.value)} disabled={isPending}/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required value={password} onChange={e => setPassword(e.target.value)} disabled={isPending}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isPending}>Sign in</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}

    