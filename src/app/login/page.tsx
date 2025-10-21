'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Loader2 } from 'lucide-react';
import { useAuth } from '@/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const auth = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPending(true);
    setError(null);

    if (!auth) {
      setError('El servicio de autenticación no está disponible.');
      setIsPending(false);
      return;
    }

    if (!email || !password) {
      setError('Se requieren correo y contraseña.');
      setIsPending(false);
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const idToken = await userCredential.user.getIdToken();
      
      // Send token to server-side to set a session cookie
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const data = await response.json();

      if (response.ok) {
        router.push('/');
      } else {
        setError(data.error || 'Fallo al iniciar sesión.');
      }

    } catch (e: any) {
      console.error("Login page error:", e);
      switch (e.code) {
        case 'auth/user-not-found':
        case 'auth/wrong-password':
        case 'auth/invalid-credential':
          setError('Usuario o contraseña inválidos.');
          break;
        case 'auth/too-many-requests':
          setError('Demasiados intentos fallidos. Por favor, intenta de nuevo más tarde.');
          break;
        default:
          setError('Ocurrió un error inesperado durante el inicio de sesión.');
          break;
      }
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
              <Label htmlFor="email">Correo</Label>
              <Input id="email" name="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required disabled={isPending}/>
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
