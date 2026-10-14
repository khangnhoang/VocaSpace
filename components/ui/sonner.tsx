"use client"

import { usePathname } from "next/navigation"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

// Toaster duy nhất nằm ở root layout, ngoài wrapper `.dark` của /admin, nên theme được chọn theo route:
// /admin và /admin/* dùng nền tối, mọi route khác giữ nền sáng. Prop `theme` truyền vào luôn thắng.
const isAdminPath = (pathname: string | null) =>
  pathname === "/admin" || (pathname?.startsWith("/admin/") ?? false)

const Toaster = ({ theme, ...props }: ToasterProps) => {
  const pathname = usePathname()
  const resolvedTheme = theme ?? (isAdminPath(pathname) ? "dark" : "light")

  return (
    <Sonner
      theme={resolvedTheme}
      className="toaster group"
      icons={{
        success: (
          <CircleCheckIcon className="size-4" />
        ),
        info: (
          <InfoIcon className="size-4" />
        ),
        warning: (
          <TriangleAlertIcon className="size-4" />
        ),
        error: (
          <OctagonXIcon className="size-4" />
        ),
        loading: (
          <Loader2Icon className="size-4 animate-spin" />
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
