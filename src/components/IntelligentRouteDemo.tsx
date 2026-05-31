'use client';

import { useState, useEffect } from 'react';
import { useIntelligentRoute } from '@/hooks/useIntelligentRoute';
import { MapView } from '@/components/MapView';
import { useRouteStore } from '@/store/route-store';

/**
 * Demo component for the LangGraph intelligent routing system
 *
 * Showcases:
 * - Natural language route queries
 * - Conversational explanations
 * - Safety assessments with risk scores
 * - Agent conversation trace
 * - User-friendly advice
 * - Interactive map visualization
 */
export function IntelligentRouteDemo() {
  const [userQuery, setUserQuery] = useState(
    'I want a safe 10km morning run avoiding pollution'
  );

  const { mutate, data, isPending, error } = useIntelligentRoute();

  // Use route store directly instead of local state
  const startCoord = useRouteStore((state) => state.startCoord);
  const setStartCoord = useRouteStore((state) => state.setStartCoord);
  const setRoute = useRouteStore((state) => state.setRoute);

  // Update route store when intelligent route is generated
  useEffect(() => {
    if (data?.success && data.data.route) {
      setRoute(data.data.route);
    }
  }, [data, setRoute]);

  const handleGenerate = () => {
    mutate({
      distanceKm: 10,
      startCoord,
      routeType: 'loop',
      cityPreference: 'stay-in-city',
      timeOfDay: 6,
      userQuery,
    });
  };

  return (
    <div className="flex flex-col md:flex-row h-screen">
      {/* Left Sidebar: Form + Results */}
      <div className="w-full md:w-1/3 overflow-y-auto bg-gray-50 p-6 space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-3xl font-bold mb-2">
          🤖 Intelligent Route Planner
        </h1>
        <p className="text-blue-100">
          Powered by LangGraph multi-agent system with GPT-4o-mini
        </p>
      </div>

      {/* Input Form */}
      <div className="bg-white rounded-lg shadow-md p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tell me what you need
          </label>
          <textarea
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            rows={3}
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            placeholder="E.g., I want a safe morning run avoiding pollution and traffic"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Longitude
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={startCoord[0]}
              onChange={(e) =>
                setStartCoord([parseFloat(e.target.value), startCoord[1]])
              }
              step="0.0001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Latitude
            </label>
            <input
              type="number"
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              value={startCoord[1]}
              onChange={(e) =>
                setStartCoord([startCoord[0], parseFloat(e.target.value)])
              }
              step="0.0001"
            />
          </div>
        </div>

        <button
          onClick={handleGenerate}
          disabled={isPending}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-md transition-colors"
        >
          {isPending ? '🤖 AI Agents Working...' : '🚀 Generate Intelligent Route'}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-semibold mb-1">❌ Error</h3>
          <p className="text-red-600">{error.message}</p>
        </div>
      )}

      {/* Results */}
      {data?.success && (
        <div className="space-y-6">
          {/* AI Explanation */}
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border border-purple-200">
            <h2 className="text-xl font-bold text-purple-900 mb-3 flex items-center gap-2">
              <span>🤖</span> AI Recommendation
            </h2>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
              {data.explanation}
            </p>
          </div>

          {/* Safety Score */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              🛡️ Safety Assessment
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <ScoreCard
                label="Overall"
                score={data.data.safety.overallScore}
                icon="🎯"
              />
              <ScoreCard
                label="Heat Risk"
                score={100 - data.data.safety.heatRisk}
                icon="🌡️"
              />
              <ScoreCard
                label="AQI Risk"
                score={100 - data.data.safety.aqiRisk}
                icon="💨"
              />
              <ScoreCard
                label="UV Risk"
                score={100 - data.data.safety.uvRisk}
                icon="☀️"
              />
              <ScoreCard
                label="Wind Risk"
                score={100 - data.data.safety.windRisk}
                icon="🍃"
              />
              <ScoreCard
                label="Surface"
                score={data.data.safety.surfaceQuality}
                icon="🛣️"
              />
            </div>

            {data.data.safety.bestStartTime && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-green-800">
                  <strong>⏰ Best Start Time:</strong>{' '}
                  {data.data.safety.bestStartTime}
                </p>
              </div>
            )}
          </div>

          {/* Warnings */}
          {data.data.safety.warnings.length > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="text-yellow-900 font-semibold mb-2">
                ⚠️ Warnings
              </h3>
              <ul className="space-y-1">
                {data.data.safety.warnings.map((warning, idx) => (
                  <li key={idx} className="text-yellow-800">
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Advice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-blue-900 font-semibold mb-3">
              💡 Recommendations
            </h3>
            <ul className="space-y-2">
              {data.advice.map((tip, idx) => (
                <li key={idx} className="text-blue-800 flex items-start gap-2">
                  <span className="text-blue-600 mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Route Metrics */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              📊 Route Details
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label="Distance"
                value={`${data.data.route.distanceKm.toFixed(2)} km`}
              />
              <MetricCard
                label="Duration"
                value={`${data.data.route.durationMin.toFixed(0)} min`}
              />
              <MetricCard
                label="Elevation Gain"
                value={`${data.data.route.elevationGain || 0} m`}
              />
              <MetricCard
                label="Surface Score"
                value={`${data.data.route.surfaceScore}/100`}
              />
            </div>

            {data.data.metrics && (
              <div className="mt-4 grid grid-cols-2 gap-4">
                <MetricCard
                  label="Distance Accuracy"
                  value={`${data.data.metrics.distanceAccuracy.toFixed(1)}%`}
                />
                <MetricCard
                  label="Turn Count"
                  value={`${data.data.metrics.turnCount} turns`}
                />
              </div>
            )}
          </div>

          {/* Water Points */}
          {data.data.waterPoints && data.data.waterPoints.length > 0 && (
            <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
              <h3 className="text-cyan-900 font-semibold mb-2">
                💧 Water Points Along Route
              </h3>
              <p className="text-cyan-800">
                {data.data.waterPoints.length} water fountain(s) found for
                hydration
              </p>
            </div>
          )}

          {/* Agent Conversation */}
          <details className="bg-gray-50 rounded-lg p-4">
            <summary className="font-semibold text-gray-900 cursor-pointer hover:text-blue-600">
              🔍 View Agent Conversation
            </summary>
            <div className="mt-4 space-y-3">
              {data.conversation.map((msg, idx) => (
                <div
                  key={idx}
                  className={`p-3 rounded-lg ${
                    msg.agent === 'user'
                      ? 'bg-blue-100 border-l-4 border-blue-500'
                      : msg.agent === 'route'
                        ? 'bg-green-100 border-l-4 border-green-500'
                        : msg.agent === 'safety'
                          ? 'bg-yellow-100 border-l-4 border-yellow-500'
                          : 'bg-purple-100 border-l-4 border-purple-500'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-700 mb-1">
                    {msg.agent === 'user' ? '👤' : '🤖'}{' '}
                    {msg.agent.charAt(0).toUpperCase() + msg.agent.slice(1)}{' '}
                    Agent
                  </p>
                  <p className="text-gray-800 text-sm">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
      </div>

      {/* Right Panel: Map */}
      <div className="flex-1 relative h-96 md:h-screen">
        <MapView />
        {isPending && (
          <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center pointer-events-none">
            <div className="bg-white rounded-lg shadow-lg p-4">
              <p className="text-gray-800 font-semibold">
                🤖 AI Generating Route...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper Components

function ScoreCard({
  label,
  score,
  icon,
}: {
  label: string;
  score: number;
  icon: string;
}) {
  const color =
    score >= 70 ? 'text-green-600' : score >= 40 ? 'text-yellow-600' : 'text-red-600';
  const bgColor =
    score >= 70 ? 'bg-green-100' : score >= 40 ? 'bg-yellow-100' : 'bg-red-100';

  return (
    <div className={`${bgColor} rounded-lg p-4`}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className={`text-3xl font-bold ${color}`}>{score}</div>
      <div className="text-sm text-gray-600 mt-1">{label}</div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="text-sm text-gray-600 mb-1">{label}</div>
      <div className="text-xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
