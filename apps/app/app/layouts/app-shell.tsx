import { NavLink, Outlet } from "react-router";
import {
  LogoMark,
  DashboardIcon,
  FleetIcon,
  RecommendationIcon,
  RouteIcon,
  ApprovalIcon,
  KpiIcon,
} from "~/components/nav-icons";

// Persistent app shell for all 6 pages: steel-blue sidebar + scrollable content.
// Active nav item = translucent glass pill with a navy border (Figma).

interface NavItem {
  to: string;
  label: string;
  Icon: (props: { className?: string }) => React.ReactNode;
  end?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", Icon: DashboardIcon, end: true },
  { to: "/fleet", label: "Live Fleet Map", Icon: FleetIcon },
  { to: "/recommendation", label: "AI Recommendation", Icon: RecommendationIcon },
  { to: "/optimization", label: "Route Optimization", Icon: RouteIcon },
  { to: "/approvals", label: "Human Approval", Icon: ApprovalIcon },
  { to: "/impact", label: "Execution & KPI", Icon: KpiIcon },
];

export default function AppShell() {
  return (
    <div className="flex min-h-screen bg-bg text-ink">
      <aside className="flex w-[265px] shrink-0 flex-col bg-brand">
        <div className="flex items-center gap-2 px-5 pb-4 pt-6">
          <LogoMark className="h-9 w-9 text-white" />
          <span className="text-[22px] font-bold text-white">SLAra AI</span>
        </div>
        <div className="mx-5 mb-4 h-1 rounded-full bg-white/90" />

        <nav className="flex flex-col gap-1 px-3">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-[15px] border-2 px-4 py-2 text-[17px] transition-colors ${
                  isActive
                    ? "border-ink bg-white/15 text-white"
                    : "border-transparent text-white/90 hover:bg-white/10"
                }`
              }
            >
              <Icon className="h-6 w-6 shrink-0" />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-x-hidden px-8 py-6">
        <Outlet />
      </main>
    </div>
  );
}
