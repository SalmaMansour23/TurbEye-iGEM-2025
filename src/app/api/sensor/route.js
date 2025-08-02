let currentValue = 50;

export async function GET() {
  const fluctuation = (Math.random() - 0.5) * 10;
  currentValue = Math.max(0, Math.min(100, currentValue + fluctuation));

  const response = {
    timestamp: new Date().toISOString(),
    value: Number(currentValue.toFixed(2)),
  };

  return Response.json(response);
}
