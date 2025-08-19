
'use client';

import { useState, useTransition, useRef, useEffect } from 'react';
import { useActionState } from 'react';
import { addManager, deleteManager } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2, Plus, Loader2, User, Crown, Shield } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from './ui/badge';
import { Label } from './ui/label';

type Manager = {
  username: string;
}

export function ManagerAdmin({ initialManagers, ownerUsername }: { initialManagers: Manager[], ownerUsername: string }) {
  const [managers, setManagers] = useState<Manager[]>(initialManagers);
  const [isDeleting, startDeleteTransition] = useTransition();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);

  const [addManagerState, addManagerAction, isAddingPending] = useActionState(addManager, { success: false, error: undefined, managers: initialManagers });

  useEffect(() => {
    if (addManagerState.success && addManagerState.managers) {
        setManagers(addManagerState.managers);
        toast({ title: 'Success', description: `Manager has been added.`, className: 'bg-green-500 text-white' });
        formRef.current?.reset();
    } else if (addManagerState.error) {
        toast({ variant: 'destructive', title: 'Error Adding Manager', description: addManagerState.error });
    }
  }, [addManagerState, toast]);


  const handleDeleteManager = (username: string) => {
    startDeleteTransition(async () => {
      const result = await deleteManager(username);
      if (result.success && result.managers) {
        setManagers(result.managers);
        toast({ title: 'Success', description: `Manager "${username}" has been deleted.` });
      } else {
        toast({ variant: 'destructive', title: 'Error Deleting Manager', description: result.error });
      }
    });
  };

  const isPending = isAddingPending || isDeleting;

  return (
    <div className="space-y-6">
      <Card className="w-full max-w-3xl mx-auto shadow-lg">
        <CardHeader>
          <CardTitle>Add New Manager</CardTitle>
          <CardDescription>
            Create new accounts that can log in and manage their own set of VPN users.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form ref={formRef} action={addManagerAction} className="flex flex-col sm:flex-row gap-2">
            <div className="grid w-full gap-1.5">
                <Label htmlFor="username">Username</Label>
                <Input name="username" id="username" placeholder="New manager username" required disabled={isPending} />
            </div>
             <div className="grid w-full gap-1.5">
                <Label htmlFor="password">Password</Label>
                <Input name="password" id="password" type="password" placeholder="Password" required disabled={isPending} />
            </div>
            <div className='self-end'>
                <Button type="submit" disabled={isPending} className='w-full sm:w-auto'>
                    {isAddingPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    <span>Add Manager</span>
                </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      
      <Card className="w-full max-w-3xl mx-auto shadow-lg">
        <CardHeader>
            <CardTitle>Current Managers</CardTitle>
            <CardDescription>List of all accounts with access to this panel.</CardDescription>
        </CardHeader>
        <CardContent>
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {managers.length > 0 ? (
                    managers.map((manager) => (
                        <TableRow key={manager.username}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <User className="w-5 h-5 text-muted-foreground" />
                              <span className="font-mono text-base">{manager.username}</span>
                            </div>
                          </TableCell>
                           <TableCell>
                             {manager.username === ownerUsername ? (
                                <Badge variant="default" className="bg-amber-500 hover:bg-amber-500/90">
                                    <Crown className="mr-2 h-4 w-4" />
                                    Owner
                                </Badge>
                             ) : (
                                <Badge variant="secondary">
                                    <Shield className="mr-2 h-4 w-4" />
                                    Manager
                                </Badge>
                             )}
                          </TableCell>
                          <TableCell className="text-right">
                            {manager.username !== ownerUsername && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" disabled={isPending}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete the manager <strong className="font-mono">{manager.username}</strong> and revoke their access. This does not delete the VPN users they created.
                                        </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteManager(manager.username)} className="bg-destructive hover:bg-destructive/90" disabled={isDeleting}>
                                            {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                                            Delete Manager
                                        </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                          </TableCell>
                        </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                        No managers found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
        </CardContent>
    </Card>
    </div>
  );
}
