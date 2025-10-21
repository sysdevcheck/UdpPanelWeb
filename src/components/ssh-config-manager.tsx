
'use client';

import { useEffect, useRef } from 'react';
import { useActionState } from 'react';
import { saveSshConfig } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Server } from 'lucide-react';


type SshConfig = {
    host: string;
    port: number;
    username: string;
}

type Manager = {
  username: string;
  ssh?: SshConfig;
}

const initialSshActionState = {
    success: false,
    error: undefined,
    message: undefined,
}

export function SshConfigManager({ owner, ownerUsername }: { owner: Manager | null, ownerUsername: string }) {
    const { toast } = useToast();
    const sshFormRef = useRef<HTMLFormElement>(null);
    const [sshState, sshAction, isSshPending] = useActionState(saveSshConfig, initialSshActionState);

    useEffect(() => {
        if(sshState.success || sshState.error) {
            if (sshState.success) {
                if (sshState.message) {
                    toast({ title: 'Success', description: sshState.message, className: 'bg-green-500 text-white' });
                }
            } else if (sshState.error) {
                toast({ variant: 'destructive', title: 'Error Saving SSH Config', description: sshState.error });
            }
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sshState]);

    const isPending = isSshPending;

    return (
        <Card className="w-full max-w-4xl mx-auto shadow-lg mt-6">
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Server className="w-5 h-5"/>Remote Server SSH Config</CardTitle>
                <CardDescription>
                    Enter the credentials for the remote VPS where ZiVPN is installed. This enables remote management. Leave this blank to manage users on the same server where this panel is running.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <form ref={sshFormRef} action={sshAction} className="space-y-4">
                    <input type="hidden" name="ownerUsername" value={ownerUsername} />
                    <div className="grid sm:grid-cols-2 gap-4">
                         <div className="grid gap-1.5">
                            <Label htmlFor="host">Server IP / Hostname</Label>
                            <Input name="host" id="host" placeholder="e.g., 123.45.67.89" defaultValue={owner?.ssh?.host} required disabled={isPending} />
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="port">SSH Port</Label>
                            <Input name="port" id="port" type="number" placeholder="22" defaultValue={owner?.ssh?.port} disabled={isPending} />
                        </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                         <div className="grid gap-1.5">
                            <Label htmlFor="ssh-username">SSH Username</Label>
                            <Input name="username" id="ssh-username" placeholder="e.g., root" defaultValue={owner?.ssh?.username} required disabled={isPending} />
                        </div>
                         <div className="grid gap-1.5">
                            <Label htmlFor="ssh-password">SSH Password</Label>
                            <Input name="password" id="ssh-password" type="password" placeholder="Enter SSH password" required disabled={isPending} />
                        </div>
                    </div>
                    <div className='flex justify-end'>
                        <Button type="submit" disabled={isPending} className="gap-2">
                            {isSshPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save SSH Config
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}
