// Core weather data from OpenWeatherMap
export interface WeatherConditions {
  temp: number; // Celsius
  feelsLike: number; // Apparent temperature
  humidity: number; // Percentage
  description: string; // e.g., "clear sky", "light rain"
  icon: string; // OpenWeatherMap icon code
  rain?: {
    // Phase 4: Post-rain warnings
    '1h'?: number; // Rain volume in last 1 hour (mm)
    '3h'?: number; // Rain volume in last 3 hours (mm)
  };
}

export interface HourlyWeather {
  time: string; // ISO 8601 timestamp
  temp: number;
  feelsLike: number;
  heatIndex: number; // Calculated heat index
  humidity: number;
  description: string;
  icon: string;
  aqi?: number; // Air Quality Index (1-5 scale or 0-500 scale for WAQI)
  aqiLabel?: string; // "Good", "Moderate", "Unhealthy", etc.
  uv?: number; // UV index (Phase 2)
  windSpeed?: number; // Wind speed in m/s (Phase 2)
  windDirection?: number; // Wind direction in degrees (Phase 2)
}

export interface AQIData {
  aqi: number; // 1-5 scale (OpenWeatherMap) or 0-500 scale (WAQI)
  label: string; // "Good", "Fair", "Moderate", "Poor", "Very Poor"
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
  station?: string; // For WAQI data
  dominantPollutant?: string; // For WAQI data
}

export interface UVData {
  uv: number; // Current UV index
  uvMax: number; // Max expected today
  uvMaxTime: string; // When UV peaks (ISO timestamp)
  safeExposureTime: number; // Minutes until sunburn
  category: string; // "Low", "Moderate", "High", "Very High", "Extreme"
  recommendation: string; // Safety advice
}

export interface WindData {
  speed: number; // m/s
  direction: number; // degrees (0-360)
  gusts: number; // m/s
  directionLabel: string; // "N", "NE", "E", etc.
  category: string; // "Calm", "Light Breeze", etc.
}

export interface StartTimeRecommendation {
  time: string; // ISO 8601
  timeLabel: string; // Human-readable: "6:00 AM", "7:30 PM"
  score: number; // 0-100, higher is better
  temp: number;
  feelsLike: number;
  heatIndex: number;
  reasoning: string; // Why this time is recommended
  warnings: string[]; // Heat warnings, AQI warnings, etc.
  isNCR?: boolean; // Flag for NCR-specific advice
}

export interface WeatherAdviceResponse {
  location: {
    lat: number;
    lng: number;
    city?: string;
    isNCR: boolean; // Is this in NCR region?
  };
  current: WeatherConditions & {
    aqi?: AQIData;
    uv?: UVData; // NEW (Phase 2)
    wind?: WindData; // NEW (Phase 2)
  };
  hourlyForecast: HourlyWeather[]; // Next 48 hours
  recommendations: StartTimeRecommendation[];
  alerts: string[]; // Critical alerts (extreme heat, poor AQI, high UV)
}
