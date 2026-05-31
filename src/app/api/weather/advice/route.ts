import { NextRequest, NextResponse } from 'next/server';
import {
  WeatherAdviceSuccessResponse,
  WeatherAdviceError,
} from '@/types/api';
import {
  fetchCurrentWeather,
  fetchHourlyForecast,
  fetchAQI,
  isNCRLocation,
  generateStartTimeRecommendations,
} from '@/lib/weather';
import { fetchWAQI, getAQICategory } from '@/lib/waqi';
import { fetchUV, getUVCategory } from '@/lib/openuv';
import { fetchWind, getWindDirectionLabel, getWindCategory } from '@/lib/windy';

export async function GET(request: NextRequest) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const timeRangeHours = parseInt(searchParams.get('hours') || '48');

    // Validation
    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json<WeatherAdviceError>(
        {
          success: false,
          error: 'Invalid coordinates',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return NextResponse.json<WeatherAdviceError>(
        {
          success: false,
          error: 'Coordinates out of range',
          code: 'INVALID_REQUEST',
        },
        { status: 400 }
      );
    }

    if (!process.env.WEATHER_API_KEY) {
      console.error('[Weather Advice] WEATHER_API_KEY not configured');
      return NextResponse.json<WeatherAdviceError>(
        {
          success: false,
          error: 'Weather API not configured',
          code: 'API_KEY_MISSING',
        },
        { status: 500 }
      );
    }

    console.log(`[Weather Advice] Fetching weather for [${lat}, ${lng}]`);

    // Detect NCR location
    const isNCR = isNCRLocation(lat, lng);
    console.log(`[Weather Advice] NCR location: ${isNCR}`);

    // Fetch weather data in parallel (Phase 2: added UV, Wind, WAQI)
    const [current, hourlyForecast, aqiData, uvData, windData] = await Promise.all([
      fetchCurrentWeather(lat, lng),
      fetchHourlyForecast(lat, lng, timeRangeHours),
      // Use WAQI for India (more accurate), fallback to OpenWeatherMap for other regions
      isNCR ? fetchWAQI(lat, lng).then(data => data ? { ...data, label: getAQICategory(data.aqi).label } : null) : fetchAQI(lat, lng),
      fetchUV(lat, lng), // NEW: UV index
      fetchWind(lat, lng), // NEW: Wind direction
    ]);

    console.log(
      `[Weather Advice] Current: ${current.temp}°C, Forecast: ${hourlyForecast.length} intervals`
    );
    if (isNCR && aqiData) {
      console.log(`[Weather Advice] AQI: ${aqiData.aqi} (${aqiData.label})${aqiData.station ? ` from ${aqiData.station}` : ''}`);
    }
    if (uvData) {
      console.log(`[Weather Advice] UV Index: ${uvData.uv} (${getUVCategory(uvData.uv).label})`);
    }
    if (windData) {
      console.log(`[Weather Advice] Wind: ${windData.speed.toFixed(1)}m/s from ${getWindDirectionLabel(windData.direction)}`);
    }

    // Attach AQI to hourly data if available
    const enrichedHourly = hourlyForecast.map((hour) => ({
      ...hour,
      aqi: aqiData?.aqi,
      aqiLabel: aqiData?.label,
    }));

    // Generate start time recommendations
    const recommendations = generateStartTimeRecommendations(
      enrichedHourly,
      isNCR
    );

    console.log(
      `[Weather Advice] Generated ${recommendations.length} recommendations, best: ${recommendations[0]?.timeLabel} (score: ${recommendations[0]?.score})`
    );

    // Generate critical alerts (Phase 2: added UV alerts)
    const alerts: string[] = [];
    if (current.temp > 38) {
      alerts.push('Extreme heat advisory in effect');
    }
    if (isNCR && aqiData && aqiData.aqi >= 200) {
      // WAQI uses 0-500 scale, 200+ is unhealthy
      alerts.push(
        'Air quality unhealthy - outdoor exercise not recommended'
      );
    } else if (!isNCR && aqiData && aqiData.aqi >= 4) {
      // OpenWeatherMap uses 1-5 scale
      alerts.push(
        'Air quality unhealthy - outdoor exercise not recommended'
      );
    }
    if (uvData && uvData.uv >= 8) {
      alerts.push(
        `Very high UV index (${uvData.uv}) - Apply SPF 50+ sunscreen and avoid midday sun`
      );
    }

    const response: WeatherAdviceSuccessResponse = {
      success: true,
      data: {
        location: { lat, lng, isNCR },
        current: {
          ...current,
          aqi: (aqiData && 'o3' in aqiData) ? aqiData : undefined,
          uv: uvData ? {
            ...uvData,
            category: getUVCategory(uvData.uv).label,
            recommendation: getUVCategory(uvData.uv).recommendation,
          } : undefined,
          wind: windData ? {
            ...windData,
            directionLabel: getWindDirectionLabel(windData.direction),
            category: getWindCategory(windData.speed).label,
          } : undefined,
        },
        hourlyForecast: enrichedHourly,
        recommendations,
        alerts,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const err = error as Error & { status?: number };

    if (err.status === 429) {
      console.error('[Weather Advice] Rate limit exceeded');
      return NextResponse.json<WeatherAdviceError>(
        {
          success: false,
          error: 'Weather API rate limit exceeded',
          code: 'RATE_LIMIT',
        },
        { status: 429 }
      );
    }

    console.error('[Weather Advice] Error:', err);
    return NextResponse.json<WeatherAdviceError>(
      {
        success: false,
        error: 'Failed to fetch weather advice',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}
