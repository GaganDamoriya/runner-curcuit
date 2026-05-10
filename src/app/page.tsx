import { MapView } from '@/components/MapView';
import { RouteSidebar } from '@/components/RouteSidebar';

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  return (
    <div className="relative w-full h-screen">
      <MapView />
      <RouteSidebar initialParams={params} />
    </div>
  );
}
