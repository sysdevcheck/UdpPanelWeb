
import { getSession, logout } from './actions';
import { UserManager } from '@/components/user-manager';
import { SshConfigManager } from '@/components/ssh-config-manager';
import { BackupManager } from '@/components/backup-manager';
import { ManagerAdmin } from '@/components/manager-admin';
import { Users, LogOut, UserCog, Server, Database, UserPlus } from 'lucide-react';
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
  const session = await getSession();
  let user = null;

  if (session?.value) {
      try {
        const sessionData = JSON.parse(session.value);
         if (sessionData.username && sessionData.role) {
             user = {
                uid: sessionData.username, 
                username: sessionData.username,
                role: sessionData.role,
                assignedServerId: sessionData.assignedServerId || null,
            };
         }
      } catch (e) {
          console.error("Failed to parse session cookie", e);
          await logout();
      }
  }

  if (!user) {
    redirect('/login');
  }

  const { uid, username, role, assignedServerId } = user;
  const isOwner = role === 'owner';
  const defaultTab = isOwner ? "servers" : "vpn-users";

  return (
    <div className="flex flex-col flex-grow">
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
                <span className="hidden sm:inline">Bienvenido, </span>
                <strong className="font-medium text-foreground">{username}</strong>
                 {isOwner ? <span className="text-amber-500 ml-1">(Dueño)</span> : <span className="text-cyan-500 ml-1">(Manager)</span>}
              </span>
              <form action={logout}>
                <Button variant="outline" size="sm">
                  <LogOut className="mr-0 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">Cerrar Sesión</span>
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>
      <div className="flex-grow container mx-auto p-4 sm:p-6 lg:p-8">
         <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className={`grid w-full ${isOwner ? 'grid-cols-4' : 'grid-cols-1'} max-w-2xl mx-auto`}>
            {isOwner && (
                <TabsTrigger value="servers">
                    <Server className="mr-2 h-4 w-4" />
                    Servidores
                </TabsTrigger>
            )}
            <TabsTrigger value="vpn-users">
              <Users className="mr-2 h-4 w-4" />
              Usuarios VPN
            </TabsTrigger>
            {isOwner && (
                <TabsTrigger value="managers">
                    <UserPlus className="mr-2 h-4 w-4" />
                    Managers
                </TabsTrigger>
            )}
            {isOwner && (
                <TabsTrigger value="backup">
                    <Database className="mr-2 h-4 w-4" />
                    Backup
                </TabsTrigger>
            )}
          </TabsList>
           {isOwner && (
            <TabsContent value="servers">
               <SshConfigManager />
            </TabsContent>
          )}
          <TabsContent value="vpn-users">
            {!isOwner && !assignedServerId && (
                 <Alert variant="destructive" className="max-w-xl mx-auto">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>No Asignado a un Servidor</AlertTitle>
                  <AlertDescription>
                    No estás asignado a un servidor. Por favor, contacta al dueño para que te asigne a un VPS.
                  </AlertDescription>
                </Alert>
            )}
            {(isOwner || assignedServerId) && (
              <UserManager 
                user={user}
              />
            )}
          </TabsContent>
           {isOwner && (
            <TabsContent value="managers">
               <ManagerAdmin />
            </TabsContent>
          )}
           {isOwner && (
            <TabsContent value="backup">
               <BackupManager />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
