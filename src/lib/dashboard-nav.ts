import {
  BarChart3,
  HardDrive,
  LayoutDashboard,
  Settings,
  Star,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react';

/** Sidebar navigation model, shared by the desktop rail and the mobile drawer. */

export interface DashboardNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

export interface DashboardNavGroup {
  title: string;
  items: readonly DashboardNavItem[];
}

export const DASHBOARD_NAV: readonly DashboardNavGroup[] = [
  {
    title: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        description: 'Usage at a glance',
      },
      {
        label: 'Conversions',
        href: '/dashboard/conversions',
        icon: Zap,
        description: 'Your full history',
      },
      {
        label: 'Favorites',
        href: '/dashboard/favorites',
        icon: Star,
        description: 'Pinned shortcuts',
      },
    ],
  },
  {
    title: 'Insights',
    items: [
      {
        label: 'Statistics',
        href: '/dashboard/statistics',
        icon: BarChart3,
        description: 'Trends and breakdowns',
      },
      {
        label: 'Storage',
        href: '/dashboard/storage',
        icon: HardDrive,
        description: 'What is stored right now',
      },
    ],
  },
  {
    title: 'Account',
    items: [
      {
        label: 'Profile',
        href: '/dashboard/profile',
        icon: UserRound,
        description: 'Name, email and sign-in methods',
      },
      {
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        description: 'Password, sessions and deletion',
      },
    ],
  },
];

/** Flattened, for breadcrumb and page-title lookup. */
export const DASHBOARD_ITEMS: readonly DashboardNavItem[] =
  DASHBOARD_NAV.flatMap((group) => group.items);
