import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";
export default function Chart({
  data,
  field = "value",
  color = "#54d9f6",
  unit = "",
  bar = false,
}: {
  data: any[];
  field?: string;
  color?: string;
  unit?: string;
  bar?: boolean;
}) {
  const axis = (
    <>
      <CartesianGrid stroke="var(--line)" vertical={false} />
      <XAxis
        dataKey="label"
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        minTickGap={24}
      />
      <YAxis
        width={38}
        tick={{ fill: "var(--muted)", fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        domain={bar ? [0, "auto"] : ["auto", "auto"]}
      />
      <Tooltip
        contentStyle={{
          background: "var(--panel)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          color: "var(--text)",
        }}
        formatter={(v: any) => [`${v ?? "—"} ${unit}`, "Valor"]}
      />
    </>
  );
  return (
    <div
      className="chart"
      role="img"
      aria-label={`Gráfica de ${unit || field}`}
    >
      <ResponsiveContainer width="100%" height="100%">
        {bar ? (
          <BarChart data={data}>
            {axis}
            <Bar dataKey={field} fill={color} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={data}>
            {axis}
            <defs>
              <linearGradient
                id={"gradient" + field}
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor={color} stopOpacity={0.3} />
                <stop offset="1" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area
              type="monotone"
              dataKey={field}
              stroke={color}
              strokeWidth={2.5}
              fill={`url(#gradient${field})`}
              connectNulls={false}
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
