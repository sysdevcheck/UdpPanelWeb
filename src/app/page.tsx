
import { readConfig, getLoggedInUser, logout, readFullConfig } from './actions';
import { UserManager } from '@/components/user-manager';
import { ManagerAdmin } from '@/components/manager-admin';
import { SshConfigManager } from '@/components/ssh-config-manager';
import { Users, LogOut, UserCog, Server } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { redirect } from 'next/navigation';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { AlertCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


export default async function Home() {
  const loggedInUser = await getLoggedInUser();
  if (!loggedInUser) {
    redirect('/login');
  }

  const configData = await readFullConfig();
  if (configData.error || !configData.managersData) {
    console.error("Critical State: Could not read managers file.", configData.error);
    return <div>Error loading configuration data: {configData.error}. Please check file permissions or login again.</div>;
  }
  const { owner, servers, managers } = configData.managersData;

  const isOwner = loggedInUser === owner.username;
  const managerInfo = !isOwner ? managers.find(m => m.username === loggedInUser) : null;
  const assignedServer = managerInfo ? servers.find(s => s.id === managerInfo.assignedServerId) : null;

  // Fetch initial data for the logged-in user
  // For managers, this loads users from their assigned server.
  // For owners, it starts empty; they must select a server to manage.
  const initialVpnUsersData = await readConfig(loggedInUser);
  const vpnUsers = initialVpnUsersData.auth?.config || [];

  const defaultTab = isOwner ? "servers" : "vpn-users";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <UserCog className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
              <h1 className="text-lg sm:text-2xl font-bold tracking-tight text-foreground">
                ZiVPN Multi-Manager
              </h1>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <span className="text-sm text-muted-foreground">
                <span className="hidden sm:inline">Welcome, </span>
                <strong className="font-medium text-foreground">{loggedInUser}</strong>
                 {isOwner && <span className="text-amber-500 ml-1">(Owner)</span>}
                 {!isOwner && assignedServer && <span className="text-muted-foreground ml-1 hidden sm:inline">({assignedServer.name})</span>}
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
         <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className={`grid w-full ${isOwner ? 'grid-cols-3' : 'grid-cols-1'} max-w-lg mx-auto`}>
            {isOwner && (
                <TabsTrigger value="servers">
                    <Server className="mr-2 h-4 w-4" />
                    Servers
                </TabsTrigger>
            )}
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
           {isOwner && (
            <TabsContent value="servers">
               <SshConfigManager ownerUsername={owner.username} initialServers={servers} />
            </TabsContent>
          )}
          <TabsContent value="vpn-users">
            {!isOwner && !assignedServer && (
                 <Alert variant="destructive" className="max-w-xl mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Not Assigned to a Server</AlertTitle>
                  <AlertDescription>
                    You are not currently assigned to a server. Please contact the owner to have your account assigned to a VPS.
                  </AlertDescription>
                </Alert>
            )}
            {isOwner && (
                <Alert className="max-w-xl mx-auto mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Owner View</AlertTitle>
                  <AlertDescription>
                    As the owner, you can manage users on any server. Go to the <strong className='font-bold'>Servers</strong> tab, select a server, and click "Manage Users".
                  </AlertDescription>
                </Alert>
            )}
            {((!isOwner && assignedServer) || isOwner) && (
              <UserManager 
                initialUsers={vpnUsers} 
                managerUsername={loggedInUser} 
                isOwner={isOwner}
                servers={servers}
              />
            )}
          </TabsContent>
          {isOwner && (
            <TabsContent value="managers">
               <ManagerAdmin ownerUsername={owner.username} initialManagers={managers} allServers={servers} />
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
}
