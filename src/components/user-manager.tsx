'use client';

import { useState, useTransition } from 'react';
import { addUser, deleteUser } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Trash2, Plus, Loader2, User } from 'lucide-react';
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
} from "@/components/ui/alert-dialog"

export function UserManager({ initialUsers }: { initialUsers: string[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [newUser, setNewUser] = useState('');
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleAddUser = () => {
    if (!newUser.trim()) {
      toast({
        variant: 'destructive',
        title: 'Validation Error',
        description: 'Username cannot be empty.',
      });
      return;
    }
    startTransition(async () => {
      const result = await addUser(newUser.trim());
      if (result.success && result.users) {
        setUsers(result.users);
        setNewUser('');
        toast({
          title: 'Success',
          description: `User "${newUser.trim()}" has been added.`,
          className: 'bg-green-500 text-white',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Adding User',
          description: result.error,
        });
      }
    });
  };

  const handleDeleteUser = (username: string) => {
    startTransition(async () => {
      const result = await deleteUser(username);
      if (result.success && result.users) {
        setUsers(result.users);
        toast({
          title: 'Success',
          description: `User "${username}" has been deleted.`,
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error Deleting User',
          description: result.error,
        });
      }
    });
  };

  return (
    <Card className="w-full max-w-2xl mx-auto shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">User Passwords</CardTitle>
        <CardDescription>
          Add or remove users from <code className="bg-muted px-1.5 py-0.5 rounded">auth.config</code>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-6">
          <Input
            placeholder="New username"
            value={newUser}
            onChange={(e) => setNewUser(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddUser()}
            disabled={isPending}
            className="text-base"
          />
          <Button onClick={handleAddUser} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            <span>Add User</span>
          </Button>
        </div>

        <div className="space-y-3">
            <h3 className="text-lg font-medium text-foreground/80 mb-2">Current Users</h3>
            {users.length > 0 ? (
                <ul className="border rounded-md divide-y">
                    {users.map((user) => (
                    <li key={user} className="p-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-3">
                            <User className="w-5 h-5 text-muted-foreground" />
                            <span className="font-mono text-base">{user}</span>
                        </div>
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
                                    This action cannot be undone. This will permanently delete the user <strong className="font-mono">{user}</strong>.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDeleteUser(user)} className="bg-destructive hover:bg-destructive/90">
                                    Delete
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </li>
                    ))}
                </ul>
            ) : (
                <p className="text-muted-foreground text-center py-4">No users configured.</p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
