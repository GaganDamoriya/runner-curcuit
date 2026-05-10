import {
  WeatherConditions,
  HourlyWeather,
  AQIData,
  StartTimeRecommendation,
} from '@/types/weather';

const OWM_BASE_URL = 'https://api.openweathermap.org/data/2.5';
const OWM_API_KEY = process.env.WEATHER_API_KEY!;

// NCR (National Capital Region) detection
const NCR_BOUNDS = {
  north: 29.0,
  south: 28.0,
  east: 77.8,
  west: 76.8,
};

const NCR_CITIES = [
  'delhi',
  'new delhi',
  'ghaziabad',
  'gurugram',
  'gurgaon',
  'noida',
  'greater noida',
  'faridabad',
];

/**
 * Determines if a location is in the NCR (National Capital Region)
 */
export function isNCRLocation(
  lat: number,
  lng: number,
  cityName?: string
): boolean {
  // Geographic bounds check
  const inBounds =
    lat >= NCR_BOUNDS.south &&
    lat <= NCR_BOUNDS.north &&
    lng >= NCR_BOUNDS.west &&
    lng <= NCR_BOUNDS.east;

  // City name check (if provided)
  const matchesName = cityName
    ? NCR_CITIES.some((city) => cityName.toLowerCase().includes(city))
    : false;

  return inBounds || matchesName;
}

/**
 * Calculates heat index using Rothfusz regression formula
 * Used by US National Weather Service
 */
export function calculateHeatIndex(tempC: number, humidity: number): number {
  // Convert to Fahrenheit for formula
  const tempF = (tempC * 9) / 5 + 32;

  // Below 80°F, heat index equals air temperature
  if (tempF < 80) return tempC;

  // Rothfusz regression formula
  const hi =
    -42.379 +
    2.04901523 * tempF +
    10.14333127 * humidity -
    0.22475541 * tempF * humidity -
    0.00683783 * tempF * tempF -
    0.05481717 * humidity * humidity +
    0.00122874 * tempF * tempF * humidity +
    0.00085282 * tempF * humidity * humidity -
    0.00000199 * tempF * tempF * humidity * humidity;

  // Convert back to Celsius
  return (hi - 32) * (5 / 9);
}

/**
 * Formats a Date object to human-readable time string
 */
function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${ampm}`;
}

/**
 * Fetches current weather conditions from OpenWeatherMap
 */
export async function fetchCurrentWeather(
  lat: number,
  lng: number
): Promise<WeatherConditions> {
  const response = await fetch(
    `${OWM_BASE_URL}/weather?` +
      `lat=${lat}&lon=${lng}` +
      `&units=metric` +
      `&appid=${OWM_API_KEY}`
  );

  if (!response.ok) {
    const err = new Error('Weather API request failed') as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  const data = await response.json();

  return {
    temp: data.main.temp,
    feelsLike: data.main.feels_like,
    humidity: data.main.humidity,
    description: data.weather[0].description,
    icon: data.weather[0].icon,
  };
}

/**
 * Fetches hourly forecast from OpenWeatherMap
 */
export async function fetchHourlyForecast(
  lat: number,
  lng: number,
  hours: number = 48
): Promise<HourlyWeather[]> {
  const response = await fetch(
    `${OWM_BASE_URL}/forecast?` +
      `lat=${lat}&lon=${lng}` +
      `&units=metric` +
      `&appid=${OWM_API_KEY}`
  );

  if (!response.ok) {
    const err = new Error('Weather API request failed') as Error & {
      status?: number;
    };
    err.status = response.status;
    throw err;
  }

  const data = await response.json();

  // OpenWeatherMap forecast is in 3-hour intervals
  const numIntervals = Math.ceil(hours / 3);

  return data.list.slice(0, numIntervals).map((item: any) => ({
    time: new Date(item.dt * 1000).toISOString(),
    temp: item.main.temp,
    feelsLike: item.main.feels_like,
    heatIndex: calculateHeatIndex(item.main.temp, item.main.humidity),
    humidity: item.main.humidity,
    description: item.weather[0].description,
    icon: item.weather[0].icon,
  }));
}

/**
 * Fetches Air Quality Index data from OpenWeatherMap
 * Returns null if request fails (non-critical feature)
 */
export async function fetchAQI(
  lat: number,
  lng: number
): Promise<AQIData | null> {
  try {
    const response = await fetch(
      `${OWM_BASE_URL}/air_pollution?` +
        `lat=${lat}&lon=${lng}` +
        `&appid=${OWM_API_KEY}`
    );

    if (!response.ok) return null;

    const data = await response.json();
    const aqi = data.list[0].main.aqi;
    const components = data.list[0].components;

    const labels = ['Good', 'Fair', 'Moderate', 'Poor', 'Very Poor'];

    return {
      aqi,
      label: labels[aqi - 1] || 'Unknown',
      pm25: components.pm2_5,
      pm10: components.pm10,
      o3: components.o3,
      no2: components.no2,
      so2: components.so2,
      co: components.co,
    };
  } catch {
    return null;
  }
}

/**
 * Generates start time recommendations based on weather conditions
 * Applies India-specific logic (peak heat avoidance, NCR AQI priority)
 */
export function generateStartTimeRecommendations(
  hourlyData: HourlyWeather[],
  isNCR: boolean
): StartTimeRecommendation[] {
  const recommendations: StartTimeRecommendation[] = [];
  const now = new Date();

  // Filter to next 24 hours, daylight running hours only (5 AM - 9 PM)
  const candidates = hourlyData.filter((hour) => {
    const hourTime = new Date(hour.time);
    const hourOfDay = hourTime.getHours();
    const isFuture = hourTime > now;
    const isDaylightHours = hourOfDay >= 5 && hourOfDay <= 21;
    return isFuture && isDaylightHours;
  });

  for (const hour of candidates) {
    const hourTime = new Date(hour.time);
    const hourOfDay = hourTime.getHours();

    let score = 100;
    const warnings: string[] = [];
    let reasoning = '';

    // INDIA SUMMER LOGIC: Peak heat penalty (11 AM - 4 PM)
    if (hourOfDay >= 11 && hourOfDay <= 16) {
      score -= 40;
      warnings.push('Avoid peak heat hours');
      reasoning = 'Peak heat hours - not recommended for outdoor running';
    }

    // Heat index penalties
    if (hour.heatIndex > 40) {
      score -= 30;
      warnings.push('Extreme heat warning - risk of heat stroke');
    } else if (hour.heatIndex > 35) {
      score -= 20;
      warnings.push('High heat - stay well hydrated');
    } else if (hour.heatIndex > 30) {
      score -= 10;
      warnings.push('Warm conditions - bring water');
    }

    // AQI penalties (critical for NCR)
    if (isNCR && hour.aqi) {
      if (hour.aqi >= 4) {
        // Poor or Very Poor
        score -= 30;
        warnings.push('Unhealthy air quality - consider indoor workout');
      } else if (hour.aqi === 3) {
        // Moderate
        score -= 15;
        warnings.push('Poor air quality for NCR region');
      }
    }

    // Early morning bonus (5 AM - 8 AM)
    if (hourOfDay >= 5 && hourOfDay <= 8) {
      score += 15;
      if (!reasoning)
        reasoning = 'Cool morning temperatures, ideal for running';
    }

    // Evening bonus (6 PM - 9 PM)
    if (hourOfDay >= 18 && hourOfDay <= 21) {
      score += 10;
      if (!reasoning) reasoning = 'Pleasant evening conditions';
    }

    // Default reasoning if none set
    if (!reasoning) {
      if (score >= 70) {
        reasoning = 'Good conditions for outdoor running';
      } else if (score >= 50) {
        reasoning = 'Moderate conditions - take precautions';
      } else {
        reasoning = 'Challenging conditions - not ideal for running';
      }
    }

    recommendations.push({
      time: hour.time,
      timeLabel: formatTime(hourTime),
      score: Math.max(0, Math.min(100, score)),
      temp: hour.temp,
      feelsLike: hour.feelsLike,
      heatIndex: hour.heatIndex,
      reasoning,
      warnings,
      isNCR,
    });
  }

  // Sort by score descending, return top 5
  return recommendations.sort((a, b) => b.score - a.score).slice(0, 5);
}
