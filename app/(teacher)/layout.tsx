import AreaLocale from "@/components/i18n/area-locale";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <AreaLocale>{children}</AreaLocale>
}
