
import { readConfig, getLoggedInUser, logout, readManagers } from './actions';
import { UserManager } from '@/components/user-manager';
import { ManagerAdmin } from '@/components/manager-admin';
import { Users, LogOut, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";


export default async function Home() {
  const loggedInUser = await getLoggedInUser();
  if (!loggedInUser) {
    redirect('/login');
  }

  const managersData = await readManagers();
  if (managersData.error || !managersData.managers) {
    console.error("Critical State: Could not read managers file.", managersData.error);
    // Optional: Redirect to an error page or show a message
    return <div>Error loading manager data. Please try again later.</div>;
  }
  const allManagers = managersData.managers;

  if (allManagers.length === 0) {
    // This case should theoretically not be hit if login is successful,
    // but as a safeguard, we redirect to login to re-trigger the creation logic.
    console.error("Critical State: Logged in, but no managers found. Redirecting to login.");
    redirect('/login');
  }

  // Fetch initial data for the logged-in user
  const initialVpnUsersData = await readConfig(loggedInUser);
  const vpnUsers = initialVpnUsersData.auth?.config || [];
  
  // The first manager in the list is the owner/superadmin
  const ownerUsername = allManagers.length > 0 ? allManagers[0].username : '';
  const isOwner = loggedInUser === ownerUsername;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <UserCog className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                ZiVPN Manager
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-sm text-muted-foreground">
                <span className="hidden sm:inline">Welcome, </span>
                <strong className="font-medium text-foreground">{loggedInUser}</strong>
              </span>
              <form action={logout}>
                <Button variant="outline" size="sm">
                  <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Logout</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
         <Tabs defaultValue="vpn-users" className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="vpn-users">
              <Users className="mr-2 h-4 w-4" />
              VPN Users
            </TabsTrigger>
            {isOwner && (
              <TabsTrigger value="managers">
                <UserCog className="mr-2 h-4 w-4" />
                Managers
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="vpn-users">
            <UserManager initialUsers={vpnUsers} managerUsername={loggedInUser} />
          </TabsContent>
          {isOwner && (
            <TabsContent value="managers">
               <ManagerAdmin initialManagers={allManagers} ownerUsername={ownerUsername} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
