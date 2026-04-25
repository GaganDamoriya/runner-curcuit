import { MapView } from '@/components/MapView';
import { RouteSidebar } from '@/components/RouteSidebar';

export default function Home() {
  return (
    <div className="relative w-full h-screen">
      <MapView />
      <RouteSidebar />
    </div>
  );
}
