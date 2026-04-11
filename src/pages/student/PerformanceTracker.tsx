import { useMemo, useState } from "react";
import { useData } from "../../context/DataContext";
import { categorizeLearners } from "../../lib/analytics";
import { BrainCircuit, TrendingUp, AlertTriangle, Lightbulb } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

export default function PerformanceTracker() {
  const { students, subjects, results } = useData();
  
  // Filters
  const [term, setTerm] = useState("Term 1");
  const [academicYear, setAcademicYear] = useState("2025/2026");

  // Run AI Data Science Utility
  const analytics = useMemo(() => {
    const filteredResults = results.filter(r => r.term === term && r.academicYear === academicYear);
    return categorizeLearners(students, subjects, filteredResults);
  }, [students, subjects, results, term, academicYear]);

  const { pieData, subjectAverages, insights } = analytics;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-indigo-600" />
            AI Performance Tracker
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Data-driven insights and categorization of student performance.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
          <select
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="block rounded-md border-0 py-1.5 pl-3 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600"
          >
            <option value="Term 1">Term 1</option>
            <option value="Term 2">Term 2</option>
            <option value="Term 3">Term 3</option>
          </select>
          <select
            value={academicYear}
            onChange={(e) => setAcademicYear(e.target.value)}
            className="block rounded-md border-0 py-1.5 pl-3 pr-8 text-sm text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-indigo-600"
          >
            <option value="2025/2026">2025/2026</option>
            <option value="2024/2025">2024/2025</option>
          </select>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Bar Chart: Subject Averages */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">Average Performance per Subject</h2>
          </div>
          <div className="h-80 w-full">
            {subjectAverages.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={subjectAverages} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                  <XAxis dataKey="code" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} />
                  <Tooltip 
                    cursor={{ fill: '#f3f4f6' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="average" name="Average Score (%)" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                No data available for the selected period.
              </div>
            )}
          </div>
        </div>

        {/* Pie Chart: Learner Categorization */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <BrainCircuit className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-semibold text-gray-900">AI Learner Categorization</h2>
          </div>
          <div className="h-80 w-full">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-gray-500 border-2 border-dashed border-gray-200 rounded-lg">
                No data available for the selected period.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Actionable AI Insights */}
      <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-2">
          <Lightbulb className="h-6 w-6 text-indigo-600" />
          <h2 className="text-xl font-bold text-indigo-900">Actionable AI Insights</h2>
        </div>
        
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {insights.map((insight, index) => {
            // Determine styling based on insight content
            let bgColor = "bg-white";
            let borderColor = "border-gray-200";
            let icon = null;

            if (insight.includes("🌟")) {
              bgColor = "bg-emerald-50";
              borderColor = "border-emerald-200";
            } else if (insight.includes("⚠️") || insight.includes("📉")) {
              bgColor = "bg-red-50";
              borderColor = "border-red-200";
              icon = <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />;
            } else if (insight.includes("📊")) {
              bgColor = "bg-orange-50";
              borderColor = "border-orange-200";
            }

            return (
              <div 
                key={index} 
                className={`flex items-start gap-3 rounded-lg border p-4 shadow-sm transition-all hover:shadow-md ${bgColor} ${borderColor}`}
              >
                {icon}
                <p className="text-sm font-medium text-gray-800 leading-relaxed">
                  {insight.replace(/^[🌟⚠️📊📉✅ℹ️]\s/, '')}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
