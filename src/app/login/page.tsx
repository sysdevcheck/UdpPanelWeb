
'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Terminal, Info } from 'lucide-react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, undefined);

  // Check for specific informative messages to style them differently
  const isPermissionsError = state?.error?.includes('permisos') || state?.error?.includes('propietario');

  const getAlertVariant = () => {
    if (isPermissionsError) {
      return 'default'; // Use a neutral variant for actionable advice
    }
    if (state?.error) {
      return 'destructive'; // For actual login errors
    }
    return 'destructive'; // Fallback
  };

  const getAlertIcon = () => {
    if (isPermissionsError) {
      return <Info className="h-4 w-4" />;
    }
    return <Terminal className="h-4 w-4" />;
  };

  const getAlertTitle = () => {
    if (isPermissionsError) return 'Problema de Permisos Detectado';
    if (state?.error) return 'Login Fallido';
    return 'Error';
  };
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <form action={formAction}>
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="text-2xl">Iniciar Sesión</CardTitle>
            <CardDescription>
              Introduce tus credenciales para acceder al panel.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            {state?.error && (
               <Alert variant={getAlertVariant()} className={ isPermissionsError ? 'bg-blue-900/20 border-blue-500/50' : ''}>
                  {getAlertIcon()}
                  <AlertTitle>{getAlertTitle()}</AlertTitle>
                  <AlertDescription>
                    {state.error}
                  </AlertDescription>
              </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="username">Usuario</Label>
              <Input id="username" name="username" type="text" required disabled={isPending}/>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input id="password" name="password" type="password" required disabled={isPending}/>
            </div>
          </CardContent>
          <CardFooter>
            <Button className="w-full" type="submit" disabled={isPending}>Entrar</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
