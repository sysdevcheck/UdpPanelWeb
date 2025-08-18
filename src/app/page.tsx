import { readConfig, getLoggedInUser, logout } from './actions';
import { UserManager } from '@/components/user-manager';
import { Users, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';

export default async function Home() {
  const loggedInUser = await getLoggedInUser();
  if (!loggedInUser) {
    redirect('/login');
  }

  const initialData = await readConfig();
  const users = initialData.auth?.config || [];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <Users className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                User Manager
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Welcome, <strong className="font-medium text-foreground">{loggedInUser}</strong></span>
              <form action={logout}>
                <Button variant="outline" size="sm">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <UserManager initialUsers={users} />
      </main>
    </div>
  );
}
