'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('password');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    if (!username || !password) {
      setError('Se requieren usuario y contraseña.');
      setIsPending(false);
      return;
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/');
        router.refresh(); // Forzar la recarga de datos del servidor en la página de inicio
      } else {
        setError(data.error || 'Fallo al iniciar sesión.');
      }

    } catch (e: any) {
      console.error("Login page error:", e);
      setError('Ocurrió un error inesperado durante el inicio de sesión.');
    } finally {
      setIsPending(false);
    }
  };
  
  return (
    <div className="flex min-h-[calc(100vh-6rem)] items-center justify-center bg-background">
      <form onSubmit={handleLogin}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
            <CardDescription>
              Introduce tus credenciales para acceder al panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {error && (
               <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Login Fallido</AlertTitle>
                  <AlertDescription>
                    {error}
                  </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="username">Usuario</Label>
              <Input id="username" name="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} required disabled={isPending}/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required disabled={isPending}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Entrar
            </Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
