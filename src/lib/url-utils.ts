export interface RouteParams {
  distance: number;
  routeType: 'loop' | 'point-to-point';
  cityPreference: 'stay-in-city' | 'can-leave-city';
  lat: number;
  lng: number;
  historyId?: string;
}

export function encodeRouteToURL(params: RouteParams): string {
  const searchParams = new URLSearchParams({
    distance: params.distance.toString(),
    routeType: params.routeType,
    cityPreference: params.cityPreference,
    lat: params.lat.toFixed(6),
    lng: params.lng.toFixed(6),
  });

  if (params.historyId) {
    searchParams.set('historyId', params.historyId);
  }

  return `${window.location.origin}?${searchParams.toString()}`;
}

export function decodeURLToParams(searchParams: URLSearchParams): RouteParams | null {
  const distance = searchParams.get('distance');
  const routeType = searchParams.get('routeType');
  const cityPreference = searchParams.get('cityPreference');
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const historyId = searchParams.get('historyId');

  // Validate required params
  if (!distance || !routeType || !cityPreference || !lat || !lng) {
    return null;
  }

  // Validate route type
  if (routeType !== 'loop' && routeType !== 'point-to-point') {
    return null;
  }

  // Validate city preference
  if (cityPreference !== 'stay-in-city' && cityPreference !== 'can-leave-city') {
    return null;
  }

  // Parse numbers
  const distanceNum = parseFloat(distance);
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);

  // Validate number ranges
  if (
    isNaN(distanceNum) ||
    distanceNum < 1 ||
    distanceNum > 100 ||
    isNaN(latNum) ||
    isNaN(lngNum) ||
    latNum < -90 ||
    latNum > 90 ||
    lngNum < -180 ||
    lngNum > 180
  ) {
    return null;
  }

  return {
    distance: distanceNum,
    routeType,
    cityPreference,
    lat: latNum,
    lng: lngNum,
    historyId: historyId || undefined,
  };
}
