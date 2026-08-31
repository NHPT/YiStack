"use client"

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

export type ToasterTheme = "light" | "dark" | "system"

function isToasterTheme(theme: string): theme is ToasterTheme {
  return theme === "light" || theme === "dark" || theme === "system"
}

function resolveToasterTheme(theme: string | undefined): ToasterTheme {
  if (typeof theme === "string" && isToasterTheme(theme)) {
    return theme
  }

  return "system"
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme()
  const toasterTheme = resolveToasterTheme(theme)

  return (
    <Sonner
      theme={toasterTheme}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
