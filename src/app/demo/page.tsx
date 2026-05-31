import { IntelligentRouteDemo } from '@/components/IntelligentRouteDemo';

export const metadata = {
  title: 'Intelligent Route Demo | Runner Circuit',
  description: 'Test the LangGraph-powered intelligent routing system',
};

export default function DemoPage() {
  return (
    <main className="h-screen overflow-hidden">
      <IntelligentRouteDemo />
    </main>
  );
}
