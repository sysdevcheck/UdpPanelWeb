'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Braces,
  Brackets,
  Type,
  Hash,
  ToggleRight,
  PlusCircle,
  Trash2,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Key,
  X,
  Check,
} from 'lucide-react';

type JsonNodeProps = {
  value: any;
  nodeKey: string | number;
  path: (string | number)[];
  onUpdate: (path: (string | number)[], value: any) => void;
  onDelete: (path: (string | number)[]) => void;
  onAdd: (path: (string | number)[], key: string | null, value: any) => void;
  isRoot?: boolean;
};

const getValueType = (value: any) => {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
};

const getIconForType = (type: string) => {
  switch (type) {
    case 'object': return <Braces className="h-4 w-4 text-amber-500" />;
    case 'array': return <Brackets className="h-4 w-4 text-sky-500" />;
    case 'string': return <Type className="h-4 w-4 text-green-500" />;
    case 'number': return <Hash className="h-4 w-4 text-blue-500" />;
    case 'boolean': return <ToggleRight className="h-4 w-4 text-purple-500" />;
    default: return <div className="h-4 w-4 text-gray-500">N</div>;
  }
};

const AddEntryForm = ({ onAdd, isArray }: { onAdd: (key: string | null, value: any, type: string) => void, isArray: boolean }) => {
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [type, setType] = useState('string');
  const [popoverOpen, setPopoverOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    let parsedValue: any;
    switch (type) {
      case 'number': parsedValue = parseFloat(value) || 0; break;
      case 'boolean': parsedValue = value.toLowerCase() === 'true'; break;
      case 'object': parsedValue = {}; break;
      case 'array': parsedValue = []; break;
      case 'null': parsedValue = null; break;
      default: parsedValue = value;
    }
    onAdd(isArray ? null : key, parsedValue, type);
    setKey('');
    setValue('');
    setType('string');
    setPopoverOpen(false); // Close popover on submit
  };

  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6"><PlusCircle className="h-4 w-4 text-green-500" /></Button>
        </PopoverTrigger>
        <PopoverContent className="w-60" side="bottom" align="start" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmit} className="space-y-3 p-1">
                {!isArray && (
                    <Input placeholder="Key" value={key} onChange={(e) => setKey(e.target.value)} className="h-8" required />
                )}
                { !['object', 'array', 'null'].includes(type) && (
                    <Input placeholder="Value" value={value} onChange={(e) => setValue(e.target.value)} className="h-8" />
                )}
                 <Select value={type} onValueChange={setType} >
                    <SelectTrigger className="h-8">
                        <SelectValue placeholder="Type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="string">String</SelectItem>
                        <SelectItem value="number">Number</SelectItem>
                        <SelectItem value="boolean">Boolean</SelectItem>
                        <SelectItem value="object">Object</SelectItem>
                        <SelectItem value="array">Array</SelectItem>
                        <SelectItem value="null">Null</SelectItem>
                    </SelectContent>
                </Select>
                <Button type="submit" size="sm" className="w-full">Add</Button>
            </form>
        </PopoverContent>
    </Popover>
  );
};


export const JsonNode = ({ value, nodeKey, path, onUpdate, onDelete, onAdd, isRoot = false }: JsonNodeProps) => {
  const type = getValueType(value);
  const [isCollapsed, setIsCollapsed] = useState(isRoot ? false : true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  const handleEdit = () => {
    onUpdate(path, editValue);
    setIsEditing(false);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleEdit();
    if (e.key === 'Escape') setIsEditing(false);
  };

  const renderHeader = (label: string, icon: React.ReactNode, childrenCount?: number) => (
    <div className="flex items-center space-x-2 group">
      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsCollapsed(!isCollapsed)}>
        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </Button>
      {icon}
      <span className="font-semibold text-foreground/80">{label}</span>
      {typeof childrenCount === 'number' &&
        <span className="text-muted-foreground text-xs">({childrenCount} {childrenCount === 1 ? 'item' : 'items'})</span>
      }
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 ml-auto">
        <AddEntryForm onAdd={(k, v) => onAdd(path, k, v)} isArray={type === 'array'} />
        {!isRoot && (
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onDelete(path)}>
            <Trash2 className="h-4 w-4 text-red-500" />
          </Button>
        )}
      </div>
    </div>
  );

  if (type === 'object') {
    const entries = Object.entries(value);
    return (
      <div className="relative">
        {renderHeader(isRoot ? 'root' : String(nodeKey), getIconForType(type), entries.length)}
        {!isCollapsed && (
          <div className="pl-6 border-l-2 border-dashed border-border/50 ml-3">
            {entries.map(([key, childValue]) => (
              <JsonNode key={key} value={childValue} nodeKey={key} path={[...path, key]} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd}/>
            ))}
             {entries.length === 0 && <p className="text-muted-foreground text-xs py-2 pl-2">Object is empty.</p>}
          </div>
        )}
      </div>
    );
  }

  if (type === 'array') {
    return (
      <div className="relative">
        {renderHeader(String(nodeKey), getIconForType(type), value.length)}
        {!isCollapsed && (
          <div className="pl-6 border-l-2 border-dashed border-border/50 ml-3">
            {value.map((item: any, index: number) => (
              <JsonNode key={index} value={item} nodeKey={index} path={[...path, index]} onUpdate={onUpdate} onDelete={onDelete} onAdd={onAdd}/>
            ))}
            {value.length === 0 && <p className="text-muted-foreground text-xs py-2 pl-2">Array is empty.</p>}
          </div>
        )}
      </div>
    );
  }

  // Primitive values
  return (
    <div className="flex items-center space-x-2 py-1 group">
      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      {getIconForType(typeof nodeKey)}
      <span className="font-medium text-foreground/80">{nodeKey}:</span>
      {isEditing ? (
        <div className="flex items-center space-x-2 flex-1">
          {type === 'boolean' ? (
             <div className="flex items-center space-x-2">
                <Switch checked={editValue} onCheckedChange={(c) => setEditValue(c)} />
             </div>
          ) : (
            <Input
              type={type === 'number' ? 'number' : 'text'}
              value={String(editValue)}
              onChange={(e) => setEditValue(type === 'number' ? parseFloat(e.target.value) : e.target.value)}
              onBlur={handleEdit}
              onKeyDown={handleKeyDown}
              autoFocus
              className="h-8 text-sm"
            />
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleEdit}><Check className="h-4 w-4 text-green-500" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIsEditing(false)}><X className="h-4 w-4 text-red-500" /></Button>
        </div>
      ) : (
        <div className="flex items-center flex-1 space-x-2 min-h-[36px]" onDoubleClick={() => setIsEditing(true)}>
             <span className={`px-2 py-1 rounded-md cursor-pointer hover:bg-muted`}>
                {value === null ? 'null' : String(value)}
            </span>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => {e.stopPropagation(); onDelete(path)}}>
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
            </div>
        </div>
      )}
    </div>
  );
};

// Dummy Select components for AddEntryForm to work
const Select: React.FC<any> = ({ children, ...props }) => <select {...props}>{children}</select>;
const SelectTrigger: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>;
const SelectValue: React.FC<any> = ({...props}) => <div {...props} />;
const SelectContent: React.FC<any> = ({ children, ...props }) => <div {...props}>{children}</div>;
const SelectItem: React.FC<any> = ({ children, ...props }) => <option {...props}>{children}</option>;
