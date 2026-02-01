'use client';

import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = ({ className, ...props }: TabsPrimitive.TabsListProps) => (
  <TabsPrimitive.List
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-md border border-white/45 bg-white/12 p-1 text-white/70 backdrop-blur-md',
      className
    )}
    {...props}
  />
);

const TabsTrigger = ({ className, ...props }: TabsPrimitive.TabsTriggerProps) => (
  <TabsPrimitive.Trigger
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium text-slate-700 transition-all disabled:pointer-events-none disabled:opacity-50 hover:bg-white/16 data-[state=active]:bg-white/30 data-[state=active]:text-white/95 data-[state=active]:ring-1 data-[state=active]:ring-white/60 data-[state=active]:shadow-[0_6px_16px_rgba(6,18,32,0.2)]',
      'border-r border-white/30 last:border-r-0',
      className
    )}
    {...props}
  />
);

const TabsContent = ({ className, ...props }: TabsPrimitive.TabsContentProps) => (
  <TabsPrimitive.Content className={cn('mt-4 focus-visible:outline-none', className)} {...props} />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
