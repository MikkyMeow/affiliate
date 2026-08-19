import type { Metadata } from 'next';
import { DashboardMainPageContent } from './DashboardMainPageContent';

export const metadata: Metadata = {
  title: 'Главная',
};

export default function DashboardPage() {
  return <DashboardMainPageContent />;
}
