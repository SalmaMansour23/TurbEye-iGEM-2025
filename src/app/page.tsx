'use client';

import { useEffect, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';

type DataPoint = {
  time: string;
  value: number;
};

export default function Home() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/sensor');
      const data = await res.json();

      setDataPoints((prev) => [
        ...prev.slice(-29),
        { time: new Date(data.timestamp).toLocaleTimeString(), value: data.value },
      ]);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const chartData = {
    labels: dataPoints.map((dp) => dp.time),
    datasets: [
      {
        label: 'Light Sensor Value',
        data: dataPoints.map((dp) => dp.value),
        borderColor: 'rgb(75, 192, 192)',
        fill: false,
        tension: 0.3,
      },
    ],
  };

  return (
    <div style={{ padding: 40, fontFamily: 'sans-serif' }}>
      <h2>Live Light Sensor Dashboard</h2>
      <Line data={chartData} />
    </div>
  );
}
