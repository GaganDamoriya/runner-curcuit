import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import {
  fetchCurrentWeather,
  fetchHourlyForecast,
  isNCRLocation,
  generateStartTimeRecommendations,
} from '@/lib/weather';
import { fetchWAQI, getAQICategory } from '@/lib/waqi';
import { fetchUV, getUVCategory } from '@/lib/openuv';
import { fetchWind, getWindDirectionLabel, getWindCategory } from '@/lib/windy';

/**
 * LangChain tool for fetching weather and AQI data
 */
export const weatherAnalysisTool = new DynamicStructuredTool({
  name: 'analyze_weather',
  description:
    'Analyzes weather conditions for a given location. ' +
    'Returns current weather, hourly forecast, AQI (India-optimized via WAQI), ' +
    'UV index, wind conditions, and start time recommendations with safety scores.',
  schema: z.object({
    lat: z.number().min(-90).max(90).describe('Latitude'),
    lng: z.number().min(-180).max(180).describe('Longitude'),
    timeRangeHours: z
      .number()
      .min(1)
      .max(120)
      .default(48)
      .describe('Forecast time range in hours'),
  }),
  func: async ({ lat, lng, timeRangeHours }) => {
    try {
      console.log(`[Weather Tool] Fetching weather for [${lat}, ${lng}]`);

      const isNCR = isNCRLocation(lat, lng);

      // Fetch all weather data in parallel
      const [current, hourlyForecast, aqiData, uvData, windData] =
        await Promise.all([
          fetchCurrentWeather(lat, lng),
          fetchHourlyForecast(lat, lng, timeRangeHours),
          isNCR
            ? fetchWAQI(lat, lng).then((data) =>
                data ? { ...data, label: getAQICategory(data.aqi).label } : null
              )
            : null,
          fetchUV(lat, lng),
          fetchWind(lat, lng),
        ]);

      // Enrich hourly data with AQI
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

      // Generate alerts
      const alerts: string[] = [];
      if (current.temp > 38) {
        alerts.push('⚠️ Extreme heat advisory - heat stroke risk');
      }
      if (isNCR && aqiData && aqiData.aqi >= 200) {
        alerts.push(
          `⚠️ Air quality unhealthy (AQI: ${aqiData.aqi}) - outdoor exercise not recommended`
        );
      }
      if (uvData && uvData.uv >= 8) {
        alerts.push(
          `⚠️ Very high UV index (${uvData.uv}) - Apply SPF 50+ sunscreen`
        );
      }
      if (windData && windData.speed > 10) {
        alerts.push(
          `⚠️ Strong winds (${windData.speed.toFixed(1)}m/s) - may affect running`
        );
      }

      const response = {
        success: true,
        location: { lat, lng, isNCR },
        current: {
          ...current,
          aqi: aqiData || undefined,
          uv: uvData
            ? {
                ...uvData,
                category: getUVCategory(uvData.uv).label,
                recommendation: getUVCategory(uvData.uv).recommendation,
              }
            : undefined,
          wind: windData
            ? {
                ...windData,
                directionLabel: getWindDirectionLabel(windData.direction),
                category: getWindCategory(windData.speed).label,
              }
            : undefined,
        },
        hourlyForecast: enrichedHourly,
        recommendations,
        alerts,
      };

      console.log(
        `[Weather Tool] Current: ${current.temp}°C, AQI: ${aqiData?.aqi || 'N/A'}, UV: ${uvData?.uv || 'N/A'}`
      );

      return JSON.stringify(response);
    } catch (error) {
      console.error('[Weather Tool] Error:', error);
      return JSON.stringify({
        success: false,
        error: String(error),
      });
    }
  },
});
