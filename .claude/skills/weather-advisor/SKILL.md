---
name: weather-advisor
description: Start time advisor using OpenWeatherMap — India heat rules, AQI, hourly windows
---

# Weather-based start time advisor

## API

OpenWeatherMap — server-side only (OWM_API_KEY env var)
Endpoint: GET https://api.openweathermap.org/data/2.5/forecast
Params: lat, lon, appid, units=metric, cnt=16 (48hr hourly)

## Response fields that matter

- list[n].dt — unix timestamp
- list[n].main.feels_like — perceived temp in °C
- list[n].main.humidity
- list[n].weather[0].main — Clear, Rain, Clouds etc
- list[n].wind.speed — m/s
- list[n].pop — precipitation probability (0-1)

## AQI

Endpoint: GET https://api.openweathermap.org/data/2.5/air_pollution
Params: lat, lon, appid
Response: list[0].main.aqi (1=Good, 2=Fair, 3=Moderate, 4=Poor, 5=Very Poor)

## Start time scoring logic

```typescript
function scoreTimeSlot(
  hour: number,
  weather: SlotData,
): "green" | "yellow" | "red" {
  const { feelsLike, aqi, pop, condition } = weather;

  if (condition === "Rain" || pop > 0.7) return "red";
  if (aqi >= 4) return "red"; // Poor or Very Poor AQI

  if (feelsLike > 35) return "red";
  if (feelsLike > 28) return "yellow";
  if (aqi === 3) return "yellow";

  return "green";
}
```

## India-specific rules

- May / June / July in North India (lat 25-32°): default recommend 4:30-6:00 AM
- Sunrise in Delhi summer: ~5:30 AM — recommend starting before sunrise for long runs
- Post-monsoon (Aug-Sep): humidity > 80% at any temp = yellow flag
- Winter (Nov-Feb): 6:00-8:00 AM slot usually green
- Never recommend 11 AM - 4 PM slot in summer — always red regardless of temp reading

## Time estimate for distances

Base pace for advisory (moderate runner):

- 5km = 30 min, 10km = 60 min, 21km = 2h15m, 30km = 3h15m, 42km = 4h30m
  Add 10% for hilly routes (elevation gain > 100m)

Use this to calculate finish time → check weather at both start AND finish window.

## Response shape to return from API route

```typescript
{
  recommendedStart: "05:00",
  reason: "Feels like 24°C, AQI Good, clear skies",
  slots: [
    { time: "04:30", label: "4:30 AM", score: "green", feelsLike: 23, aqi: 1 },
    { time: "05:00", label: "5:00 AM", score: "green", feelsLike: 24, aqi: 1 },
    { time: "06:00", label: "6:00 AM", score: "yellow", feelsLike: 27, aqi: 2 },
    { time: "07:00", label: "7:00 AM", score: "red", feelsLike: 31, aqi: 2 }
  ],
  warning: null // or "AQI Poor — consider indoor alternative"
}
```
