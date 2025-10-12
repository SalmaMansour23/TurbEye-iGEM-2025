"use client";
import React, { useEffect, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
} from "chart.js";

ChartJS.register(LineElement, PointElement, CategoryScale, LinearScale, Legend, Tooltip);

type SensorData = {
  visible_ir: number;
  ir: number;
  lux: number;
  timestamp: number;
};

const DEFAULT_IP = "192.168.1.51";

export default function SensorDashboard() {
  const [ip, setIp] = useState(DEFAULT_IP);
  const [inputIp, setInputIp] = useState(DEFAULT_IP);
  const [dataPoints, setDataPoints] = useState<SensorData[]>([]);
  const [status, setStatus] = useState<"connected" | "disconnected" | "loading">("loading");
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch sensor data every second
  useEffect(() => {
    setStatus("loading");
    setError(null);
    setDataPoints([]);
    setLastUpdate(null);

    function fetchData() {
      fetch(`http://${ip}/data`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const json: SensorData = await res.json();
          setDataPoints((prev) => {
            const updated = [...prev, json].slice(-60);
            return updated;
          });
          setStatus("connected");
          setError(null);
          setLastUpdate(json.timestamp);
        })
        .catch((err) => {
          setStatus(dataPoints.length === 0 ? "loading" : "disconnected");
          setError("Failed to fetch sensor data. Please check connection and IP address.");
        });
    }

    fetchData(); // Initial fetch
    intervalRef.current = setInterval(fetchData, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip]);

  // Chart data
  const chartData = {
    labels: dataPoints.map((d) =>
      new Date(d.timestamp * 1000).toLocaleTimeString("en-GB", { hour12: false })
    ),
    datasets: [
      {
        label: "Visible + IR",
        data: dataPoints.map((d) => d.visible_ir),
        borderColor: "#0070f3",
        backgroundColor: "rgba(0,112,243,0.1)",
        tension: 0.3,
      },
      {
        label: "Lux",
        data: dataPoints.map((d) => d.lux),
        borderColor: "#10b981",
        backgroundColor: "rgba(16,185,129,0.1)",
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: "top" as const },
      tooltip: { mode: "index" as const, intersect: false },
    },
    scales: {
      x: { title: { display: true, text: "Time (HH:MM:SS)" } },
      y: { title: { display: true, text: "Value" } },
    },
  };

  // Connection status indicator
  const statusColor =
    status === "connected"
      ? "bg-green-500"
      : status === "disconnected"
      ? "bg-red-500"
      : "bg-yellow-400";

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow">
      <h1 className="text-2xl font-bold mb-4">Turbidity Sensor Dashboard</h1>
      <div className="flex items-center mb-4 gap-2">
        <span
          className={`inline-block w-3 h-3 rounded-full ${statusColor} mr-2`}
          title={status === "connected" ? "Connected" : status === "disconnected" ? "Disconnected" : "Loading"}
        />
        <span className="font-semibold">
          {status === "connected"
            ? "Connected"
            : status === "disconnected"
            ? "Disconnected"
            : "Waiting for sensor data..."}
        </span>
        {lastUpdate && (
          <span className="ml-4 text-sm text-gray-500">
            Last update: {new Date(lastUpdate * 1000).toLocaleTimeString("en-GB", { hour12: false })}
          </span>
        )}
      </div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setIp(inputIp.trim());
        }}
      >
        <label className="font-medium" htmlFor="ip-input">
          ESP32 IP Address:
        </label>
        <input
          id="ip-input"
          type="text"
          value={inputIp}
          onChange={(e) => setInputIp(e.target.value)}
          className="border px-2 py-1 rounded w-40"
        />
        <button
          type="submit"
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
        >
          Set IP
        </button>
      </form>
      {error && (
        <div className="mb-4 text-red-600 font-medium">{error}</div>
      )}
      <div className="mb-4 grid grid-cols-3 gap-4">
        <div className="bg-gray-100 p-3 rounded text-center">
          <div className="text-xs text-gray-500">Visible + IR</div>
          <div className="text-xl font-bold">
            {dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].visible_ir : "--"}
          </div>
        </div>
        <div className="bg-gray-100 p-3 rounded text-center">
          <div className="text-xs text-gray-500">Infrared</div>
          <div className="text-xl font-bold">
            {dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].ir : "--"}
          </div>
        </div>
        <div className="bg-gray-100 p-3 rounded text-center">
          <div className="text-xs text-gray-500">Illuminance (Lux)</div>
          <div className="text-xl font-bold">
            {dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].lux : "--"}
          </div>
        </div>
      </div>
      <div className="bg-gray-50 p-4 rounded">
        <Line data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}