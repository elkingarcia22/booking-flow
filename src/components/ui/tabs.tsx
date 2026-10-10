"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"
import { motion } from "framer-motion"

import { cn } from "@/lib/utils"

export type TabsVariant = "view" | "page"

const TabsVariantContext = React.createContext<TabsVariant>("view")

const TabsValueContext = React.createContext<{
  value: string;
  onValueChange: (value: string) => void;
  id: string;
}>({ value: "", onValueChange: () => {}, id: "" })

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ value, defaultValue, onValueChange, ...props }, ref) => {
  const [active, setActive] = React.useState(value || defaultValue || "");
  const id = React.useId();
  
  React.useEffect(() => {
    if (value !== undefined) {
      setActive(value as string);
    }
  }, [value]);

  const handleValueChange = (newValue: string) => {
    setActive(newValue);
    if (onValueChange) {
      onValueChange(newValue);
    }
  };

  return (
    <TabsValueContext.Provider value={{ value: active, onValueChange: handleValueChange, id }}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        {...props}
      />
    </TabsValueContext.Provider>
  )
})
Tabs.displayName = TabsPrimitive.Root.displayName

interface TabsListProps
  extends React.ComponentPropsWithoutRef<typeof TabsPrimitive.List> {
  variant?: TabsVariant
}

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  TabsListProps
>(({ className, variant = "view", ...props }, ref) => (
  <TabsVariantContext.Provider value={variant}>
    <TabsPrimitive.List
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center bg-tab-track p-1 text-text-secondary",
        // Same corner ratio the other h-10 controls use (Input, Select): a
        // full pill at this height read rounder than everything around it.
        variant === "page" ? "h-10 rounded-md" : "h-9 rounded-lg",
        className
      )}
      {...props}
    />
  </TabsVariantContext.Provider>
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const variant = React.useContext(TabsVariantContext)
  const { value: activeValue, id } = React.useContext(TabsValueContext)
  const isActive = activeValue === value

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      className={cn(
        "relative inline-flex h-full items-center justify-center gap-2 whitespace-nowrap px-3 py-0 text-[13px] font-medium ring-offset-background transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:font-semibold",
        variant === "page"
          ? "rounded-sm data-[state=active]:text-primary-foreground"
          : "rounded-md data-[state=active]:text-primary",
        className
      )}
      {...props}
    >
      {isActive && (
        <motion.div
          layoutId={`tabs-bg-${id}`}
          className={cn(
            "absolute inset-0 z-0",
            variant === "page" ? "rounded-sm bg-primary" : "rounded-md bg-surface shadow-card ring-1 ring-border"
          )}
          initial={false}
          transition={{
            type: "spring",
            stiffness: 400,
            damping: 30,
            mass: 1,
          }}
        />
      )}
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
    </TabsPrimitive.Trigger>
  )
})
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
