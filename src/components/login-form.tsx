
'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { login } from '@/app/actions';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Iniciar Sesión
        </Button>
    );
}

export function LoginForm() {
    const [state, formAction] = useFormState(login, undefined);

    return (
        <form action={formAction}>
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle>Bienvenido</CardTitle>
                    <CardDescription>Accede a tu cuenta de Dueño o Manager.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="username">Usuario</Label>
                        <Input type="text" id="username" name="username" placeholder="Tu nombre de usuario" required />
                    </div>
                    <div className="grid w-full items-center gap-1.5">
                        <Label htmlFor="password">Contraseña</Label>
                        <Input type="password" id="password" name="password" placeholder="Tu contraseña" required />
                    </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-4">
                    {state?.error && (
                         <Alert variant="destructive" className="w-full">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{state.error}</AlertDescription>
                        </Alert>
                    )}
                    <SubmitButton />
                </CardFooter>
            </Card>
        </form>
    );
}
