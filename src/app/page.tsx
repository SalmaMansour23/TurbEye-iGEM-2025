'use client';

import { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import Image from 'next/image';

type DataPoint = {
  time: string;
  value: number;
};

const THRESHOLD = 30;

export default function Home() {
  const [dataPoints, setDataPoints] = useState<DataPoint[]>([]);
  const [alert, setAlert] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [bufferedPoints, setBufferedPoints] = useState<DataPoint[]>([]);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Preload the sound
    alertSoundRef.current = new Audio('/alert.mp3');
    alertSoundRef.current.load();
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/sensor');
      const data = await res.json();

      const newValue: DataPoint = {
        time: new Date(data.timestamp).toLocaleTimeString(),
        value: data.value,
      };

      if (isPaused) {
        setBufferedPoints((prev) => [...prev, newValue]);
      } else {
        setDataPoints((prev) => [...prev.slice(-29), newValue]);
      }

      if (data.value < THRESHOLD) {
        setAlert(`⚠️ Turbidity alert! Sensor value dropped to ${data.value}`);
        if (alertSoundRef.current) {
          alertSoundRef.current.currentTime = 0;
          alertSoundRef.current.play().catch((e) => console.warn('Audio play failed', e));
        }
      } else {
        setAlert(null);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPaused]);

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleResume = () => {
    setIsPaused(false);
    setDataPoints((prev) => [...prev.slice(-29 + bufferedPoints.length), ...bufferedPoints]);
    setBufferedPoints([]);
  };

  const chartData = {
    labels: dataPoints.map((dp) => dp.time),
    datasets: [
      {
        label: 'Light Sensor Value',
        data: dataPoints.map((dp) => dp.value),
        borderColor: '#00BFFF',
        backgroundColor: '#00BFFF22',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  return (
  <div
    style={{
      backgroundColor: '#001f3f',
      minHeight: '100vh',
      padding: '40px',
      color: 'white',
      fontFamily: 'sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      position: 'relative', // So logo can be absolutely positioned inside
    }}
  >
    {/* Logo in top-left corner */}
    <div
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
      }}
    >
      <Image
        src="/logo.png"
        alt="iGEM Logo"
        width={60}
        height={60}
        style={{ borderRadius: '8px' }}
      />
    </div>

    {/* Title */}
    <h1
      style={{
        fontSize: '2rem',
        color: '#00BFFF',
        textAlign: 'center',
        marginTop: '40px',
      }}
    >
      iGEM Shaker Incubator <br />
      Turbidity Monitoring Device
    </h1>

    {/* Alert Box */}
    {alert && (
      <div
        style={{
          backgroundColor: '#FF4136',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '10px',
          fontWeight: 'bold',
          animation: 'pulse 1s infinite alternate',
        }}
      >
        {alert}
      </div>
    )}

    {/* Pause/Resume Buttons */}
    <div style={{ display: 'flex', gap: '20px' }}>
      <button
        onClick={handlePause}
        disabled={isPaused}
        style={{
          padding: '10px 20px',
          backgroundColor: '#FF851B',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: isPaused ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        Pause
      </button>
      <button
        onClick={handleResume}
        disabled={!isPaused}
        style={{
          padding: '10px 20px',
          backgroundColor: '#2ECC40',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: !isPaused ? 'not-allowed' : 'pointer',
          fontWeight: 'bold',
        }}
      >
        Resume
      </button>
    </div>

    {/* Chart */}
    <div
      style={{
        width: '90%',
        maxWidth: '800px',
        backgroundColor: '#012b4e',
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 0 20px #00000044',
      }}
    >
      <Line data={chartData} />
    </div>

    <style jsx>{`
      @keyframes pulse {
        from {
          transform: scale(1);
          box-shadow: 0 0 10px #ff413666;
        }
        to {
          transform: scale(1.05);
          box-shadow: 0 0 20px #ff4136cc;
        }
      }
    `}</style>
  </div>
);
}
