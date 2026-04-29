"use client"

import React from "react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: (
          <div className="flex items-center justify-center mr-2">
            <CircleCheckIcon className="size-5 text-emerald-500" />
          </div>
        ),
        info: (
          <div className="flex items-center justify-center mr-2">
            <InfoIcon className="size-5 text-blue-500" />
          </div>
        ),
        warning: (
          <div className="flex items-center justify-center mr-2">
            <TriangleAlertIcon className="size-5 text-orange-500" />
          </div>
        ),
        error: (
          <div className="flex items-center justify-center mr-2">
            <OctagonXIcon className="size-5 text-red-500" />
          </div>
        ),
        loading: (
          <div className="flex items-center justify-center mr-2">
            <Loader2Icon className="size-5 text-slate-500 animate-spin" />
          </div>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
