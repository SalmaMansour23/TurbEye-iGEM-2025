'use client';

import { useEffect, useRef, useState } from 'react';
import { Line } from 'react-chartjs-2';
import Chart from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import Image from 'next/image';

Chart.register(zoomPlugin);

type SensorData = {
  visible_ir: number;
  ir: number;
  lux: number;
  timestamp: number;
};

const THRESHOLD = 30;
const DEFAULT_IP = '192.168.1.51';

export default function Home() {
  const [ip, setIp] = useState(DEFAULT_IP);
  const [inputIp, setInputIp] = useState(DEFAULT_IP);
  const [dataPoints, setDataPoints] = useState<SensorData[]>([]);
  const [alert, setAlert] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [bufferedPoints, setBufferedPoints] = useState<SensorData[]>([]);
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'loading'>('loading');
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const alertSoundRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    alertSoundRef.current = new Audio('/alert.mp3');
    alertSoundRef.current.load();
  }, []);

  useEffect(() => {
    setStatus('loading');
    setAlert(null);
    setLastUpdate(null);

    function fetchData() {
      fetch(`http://${ip}/data`)
        .then(async (res) => {
          if (!res.ok) throw new Error(`HTTP error ${res.status}`);
          const json: SensorData = await res.json();
          if (isPaused) {
            setBufferedPoints((prev) => [...prev, json]);
          } else {
            setDataPoints((prev) => [...prev, json]);
          }
          setStatus('connected');
          setLastUpdate(json.timestamp);

          if (json.visible_ir < THRESHOLD) {
            setAlert(`⚠️ Turbidity alert! Visible+IR dropped to ${json.visible_ir}`);
            if (alertSoundRef.current) {
              alertSoundRef.current.currentTime = 0;
              alertSoundRef.current.play().catch(() => {});
            }
          } else {
            setAlert(null);
          }
        })
        .catch(() => {
          setStatus(dataPoints.length === 0 ? 'loading' : 'disconnected');
          setAlert('Failed to fetch sensor data. Please check connection and IP address.');
        });
    }

    fetchData();
    const interval = setInterval(fetchData, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ip, isPaused]);

  const handlePause = () => setIsPaused(true);

  const handleResume = () => {
    setIsPaused(false);
    setDataPoints((prev) => [...prev, ...bufferedPoints]);
    setBufferedPoints([]);
  };

  // Chart data and options
  const chartData = {
    labels: dataPoints.map((d) =>
      new Date(d.timestamp * 1000).toLocaleTimeString('en-GB', { hour12: false })
    ),
    datasets: [
      {
        label: 'Visible + IR',
        data: dataPoints.map((d) => d.visible_ir),
        borderColor: '#00BFFF',
        backgroundColor: '#00BFFF22',
        fill: true,
        tension: 0.3,
      },
      {
        label: 'Lux',
        data: dataPoints.map((d) => d.lux),
        borderColor: '#2ECC40',
        backgroundColor: '#2ECC4022',
        fill: true,
        tension: 0.3,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' as const },
      tooltip: { mode: 'index' as const, intersect: false },
      zoom: {
        pan: { enabled: true, mode: 'x' as const },
        zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' as const },
        limits: { x: { min: 0 } },
      },
    },
    scales: {
      x: { title: { display: true, text: 'Time (HH:MM:SS)' } },
      y: { title: { display: true, text: 'Value' } },
    },
  };

  // Connection status indicator
  const statusColor =
    status === 'connected'
      ? '#2ECC40'
      : status === 'disconnected'
      ? '#FF4136'
      : '#FFDC00';

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
        position: 'relative',
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
        TurbEye: iGEM Shaker Incubator <br />
        Turbidity Monitoring Device
      </h1>

      {/* Connection Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
        <span
          style={{
            display: 'inline-block',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            backgroundColor: statusColor,
            marginRight: '6px',
            border: '2px solid #fff',
          }}
          title={status === 'connected' ? 'Connected' : status === 'disconnected' ? 'Disconnected' : 'Loading'}
        />
        <span style={{ fontWeight: 'bold' }}>
          {status === 'connected'
            ? 'Connected'
            : status === 'disconnected'
            ? 'Disconnected'
            : 'Waiting for sensor data...'}
        </span>
        {lastUpdate && (
          <span style={{ marginLeft: '16px', fontSize: '0.95em', color: '#FFDC00' }}>
            Last update: {new Date(lastUpdate * 1000).toLocaleTimeString('en-GB', { hour12: false })}
          </span>
        )}
      </div>

      {/* IP Address Input */}
      <form
        style={{ marginBottom: '10px', display: 'flex', gap: '10px', alignItems: 'center' }}
        onSubmit={(e) => {
          e.preventDefault();
          setIp(inputIp.trim());
        }}
      >
        <label htmlFor="ip-input" style={{ fontWeight: 'bold' }}>
          ESP32 IP Address:
        </label>
        <input
          id="ip-input"
          type="text"
          value={inputIp}
          onChange={(e) => setInputIp(e.target.value)}
          style={{
            border: '1px solid #00BFFF',
            padding: '6px 10px',
            borderRadius: '6px',
            width: '140px',
            background: '#012b4e',
            color: 'white',
          }}
        />
        <button
          type="submit"
          style={{
            backgroundColor: '#00BFFF',
            color: 'white',
            padding: '6px 16px',
            borderRadius: '6px',
            border: 'none',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          Set IP
        </button>
      </form>

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
        <Line data={chartData} options={chartOptions} />
        <div style={{ color: '#FFDC00', fontSize: '0.95em', marginTop: '8px' }}>
          <b>Tip:</b> Scroll, pinch, or drag horizontally to view previous data.
        </div>
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
