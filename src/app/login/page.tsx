
import { LoginForm } from '@/components/login-form';
import { UserCog } from 'lucide-react';
import { getSession } from '../actions';
import { redirect } from 'next/navigation';

export default async function LoginPage() {
    const session = await getSession();

    if (session?.value) {
        try {
            const sessionData = JSON.parse(session.value);
            if (sessionData.username) {
                redirect('/');
            }
        } catch (e) {
            // Invalid cookie, let user login again
        }
    }

    return (
        <main className="flex-grow flex items-center justify-center bg-muted/40 p-4">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center bg-primary text-primary-foreground p-3 rounded-full mb-4">
                        <UserCog className="h-8 w-8" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">ZiVPN Multi-Manager</h1>
                    <p className="text-muted-foreground mt-2">Introduce tus credenciales para acceder al panel.</p>
                </div>
                <LoginForm />
            </div>
        </main>
    );
}
