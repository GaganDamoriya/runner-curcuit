// Core weather data from OpenWeatherMap
export interface WeatherConditions {
  temp: number; // Celsius
  feelsLike: number; // Apparent temperature
  humidity: number; // Percentage
  description: string; // e.g., "clear sky", "light rain"
  icon: string; // OpenWeatherMap icon code
}

export interface HourlyWeather {
  time: string; // ISO 8601 timestamp
  temp: number;
  feelsLike: number;
  heatIndex: number; // Calculated heat index
  humidity: number;
  description: string;
  icon: string;
  aqi?: number; // Air Quality Index (1-5 scale)
  aqiLabel?: string; // "Good", "Moderate", "Unhealthy", etc.
}

export interface AQIData {
  aqi: number; // 1-5 scale
  label: string; // "Good", "Fair", "Moderate", "Poor", "Very Poor"
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
  so2: number;
  co: number;
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
  };
  hourlyForecast: HourlyWeather[]; // Next 48 hours
  recommendations: StartTimeRecommendation[];
  alerts: string[]; // Critical alerts (extreme heat, poor AQI)
}
