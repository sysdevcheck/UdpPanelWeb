'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { saveConfig } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { JsonNode } from './json-node';
import { set, del } from 'object-path-immutable';
import { Badge } from '@/components/ui/badge';

type SavingStatus = 'idle' | 'saving' | 'saved' | 'error';

export function JsonEditor({ initialData }: { initialData: any }) {
  const [data, setData] = useState(initialData);
  const [status, setStatus] = useState<SavingStatus>('idle');
  const { toast } = useToast();
  const isMounted = useRef(false);

  const handleUpdate = useCallback((path: (string | number)[], value: any) => {
    setData((currentData) => set(currentData, path, value));
  }, []);

  const handleDelete = useCallback((path: (string | number)[]) => {
    setData((currentData) => del(currentData, path));
  }, []);
  
  const handleAdd = useCallback((path: (string | number)[], key: string | null, value: any) => {
    const newPath = key ? [...path, key] : [...path, Array.isArray(value) ? value.length : 0];
    setData(currentData => {
        if(Array.isArray(currentData) && path.length === 0){
             return set(currentData, newPath.slice(1), value);
        }
        
        if(Array.isArray(data) && path.length>0){
             const parent = path.slice(0,-1)
             const last = path.slice(-1)
             const currentArray = parent.length > 0 ? set(data,parent)[last[0]] : data
             const newArray = [...currentArray, value]
             return set(data, path, newArray);
        }

        if(key) {
           return set(currentData, [...path, key], value);
        } else {
            const arr = set(currentData, path) as any[];
            return set(currentData, path, [...arr, value]);
        }
    });
  }, [data]);

  const saveData = useCallback(async () => {
    setStatus('saving');
    const result = await saveConfig(data);
    if (result.success) {
      setStatus('saved');
      setTimeout(() => setStatus('idle'), 2000);
    } else {
      setStatus('error');
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: result.error || 'An unknown error occurred.',
      });
      setTimeout(() => setStatus('idle'), 4000);
    }
  }, [data, toast]);

  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }

    setStatus('saving');
    const handler = setTimeout(() => {
      saveData();
    }, 1500); // 1.5-second debounce

    return () => {
      clearTimeout(handler);
    };
  }, [data, saveData]);
  
  const getStatusBadge = () => {
    switch (status) {
      case 'saving':
        return <Badge variant="secondary">Saving...</Badge>;
      case 'saved':
        return <Badge className="bg-green-500 text-white">Saved</Badge>;
      case 'error':
        return <Badge variant="destructive">Error</Badge>;
      default:
        return <Badge variant="outline">Auto-Save Enabled</Badge>;
    }
  };

  return (
    <Card className="w-full shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
            <div>
                <CardTitle className="text-xl">Configuration</CardTitle>
                <CardDescription>
                Live edit of <code className="bg-muted px-1.5 py-0.5 rounded">/etc/zivpn/config.json</code>
                </CardDescription>
            </div>
            {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent>
        <div className="p-4 rounded-lg bg-background border font-mono text-sm overflow-x-auto">
          <JsonNode
            nodeKey="root"
            value={data}
            path={[]}
            onUpdate={handleUpdate}
            onDelete={handleDelete}
            onAdd={handleAdd}
          />
        </div>
      </CardContent>
    </Card>
  );
}
