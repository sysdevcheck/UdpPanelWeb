import { readConfig, getLoggedInUser, logout, readManagersFile, saveManagersFile } from './actions';
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

/**
 * Initializes the manager configuration on the server. If the manager file doesn't exist,
 * it creates it with a default admin user. This is a critical step for the first run.
 * @returns {Promise<any[]>} The list of all managers.
 */
async function initializeManagers() {
    let managers;
    try {
        // This function now simply returns an empty array if the file doesn't exist.
        managers = await readManagersFile();
    } catch (e: any) {
        // This will be caught by the Next.js error boundary if reading fails for other reasons.
        throw new Error(`CRITICAL: Could not read managers file. Check server logs. Error: ${e.message}`);
    }

    // If the list is empty, it means the file didn't exist or was empty.
    // We create the default manager here.
    if (managers.length === 0) {
        console.log('No managers found or file does not exist. Creating a default admin user.');
        const defaultManager = { username: 'admin', password: 'password' };
        const result = await saveManagersFile([defaultManager]);
        
        // This error is critical because the app can't function without it.
        if (!result.success) {
            throw new Error(`CRITICAL: Could not create default manager file. Reason: ${result.error}`);
        }
        
        // Return the newly created list of managers
        return [defaultManager];
    }
    
    // If managers already exist, just return them.
    return managers;
}


export default async function Home() {
  const loggedInUser = await getLoggedInUser();
  if (!loggedInUser) {
    redirect('/login');
  }

  // This function now ensures the manager file exists with a default user before we proceed.
  const allManagers = await initializeManagers();

  // Fetch initial data for the logged-in user
  const initialVpnUsersData = await readConfig();
  const vpnUsers = initialVpnUsersData.auth?.config || [];
  
  // The first manager in the list is the owner/superadmin
  const ownerUsername = allManagers.length > 0 ? allManagers[0].username : '';
  const isOwner = loggedInUser === ownerUsername;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCog className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                ZiVPN Multi-Manager
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
            <UserManager initialUsers={vpnUsers} />
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

    