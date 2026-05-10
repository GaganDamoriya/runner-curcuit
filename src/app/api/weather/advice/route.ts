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

    // Fetch weather data in parallel
    const [current, hourlyForecast, aqiData] = await Promise.all([
      fetchCurrentWeather(lat, lng),
      fetchHourlyForecast(lat, lng, timeRangeHours),
      isNCR ? fetchAQI(lat, lng) : Promise.resolve(null),
    ]);

    console.log(
      `[Weather Advice] Current: ${current.temp}°C, Forecast: ${hourlyForecast.length} intervals`
    );
    if (isNCR && aqiData) {
      console.log(`[Weather Advice] AQI: ${aqiData.aqi} (${aqiData.label})`);
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

    // Generate critical alerts
    const alerts: string[] = [];
    if (current.temp > 38) {
      alerts.push('Extreme heat advisory in effect');
    }
    if (isNCR && aqiData && aqiData.aqi >= 4) {
      alerts.push(
        'Air quality unhealthy - outdoor exercise not recommended'
      );
    }

    const response: WeatherAdviceSuccessResponse = {
      success: true,
      data: {
        location: { lat, lng, isNCR },
        current: {
          ...current,
          aqi: aqiData || undefined,
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
