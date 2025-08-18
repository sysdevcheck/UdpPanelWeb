import { readConfig } from './actions';
import { JsonEditor } from '@/components/json-editor';
import { HardDrive } from 'lucide-react';

export default async function Home() {
  const initialData = await readConfig();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <HardDrive className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                VPS Config Editor
              </h1>
            </div>
          </div>
        </div>
      </header>
      <main className="container mx-auto p-4 sm:p-6 lg:p-8">
        <JsonEditor initialData={initialData} />
      </main>
    </div>
  );
}
