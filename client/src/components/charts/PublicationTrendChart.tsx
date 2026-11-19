import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

export interface TrendPoint { year: number | string; papers: number }

export default function PublicationTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data.length) return <p className="empty-state">No publication trend data yet.</p>;
  return <div className="chart-container" role="img" aria-label="Publications by year"><ResponsiveContainer width="100%" height={280}>
    <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: -16 }}>
      <defs><linearGradient id="paperTrend" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#91d4ad" stopOpacity={0.32}/><stop offset="100%" stopColor="#91d4ad" stopOpacity={0}/></linearGradient></defs>
      <CartesianGrid stroke="#28322d" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="year" stroke="#9ba9a1" tickLine={false}/><YAxis allowDecimals={false} stroke="#9ba9a1" tickLine={false}/><Tooltip contentStyle={{ background: '#171c19', border: '1px solid #28322d', borderRadius: 8 }}/><Area type="monotone" dataKey="papers" stroke="#91d4ad" fill="url(#paperTrend)" strokeWidth={2}/>
    </AreaChart>
  </ResponsiveContainer></div>;
}
