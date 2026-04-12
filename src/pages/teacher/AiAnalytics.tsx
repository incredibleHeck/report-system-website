import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { generateAiInsights } from '../../lib/analytics';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, Sector
} from 'recharts';
import { BrainCircuit, Sparkles, TrendingUp, AlertTriangle, Lightbulb, PieChart as PieChartIcon } from 'lucide-react';

/* 
  NOTE: To view these charts, please install recharts:
  npm install recharts 
*/

export default function AiAnalytics() {
  const { currentUser } = useAuth();
  const { classes, students, results } = useDatabase();
  const [selectedClassId, setSelectedClassId] = useState('');

  // 1. Find classes assigned to this teacher
  const myClasses = useMemo(() => 
    classes.filter(c => 
      c.teacherId === currentUser?.id || 
      c.subjectTeachers?.some(st => st.teacherId === currentUser?.id)
    ),
    [classes, currentUser]
  );

  useEffect(() => {
    if (myClasses.length > 0 && !selectedClassId) {
      setSelectedClassId(myClasses[0].id);
    }
  }, [myClasses, selectedClassId]);

  const activeClass = useMemo(() => 
    classes.find(c => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  const classStudents = useMemo(() => 
    students.filter(s => s.classId === selectedClassId),
    [students, selectedClassId]
  );

  // 2. Generate AI Insights using our utility
  const analytics = useMemo(() => {
    if (!activeClass || classStudents.length === 0) return null;
    return generateAiInsights(activeClass, classStudents, results);
  }, [activeClass, classStudents, results]);

  if (myClasses.length === 0) {
    return (
      <div className="max-w-2xl mx-auto mt-12 bg-white p-10 rounded-3xl border border-gray-100 text-center space-y-4">
        <BrainCircuit className="h-12 w-12 text-indigo-400 mx-auto" />
        <h2 className="text-2xl font-black text-gray-900">AI Scientist is Idle</h2>
        <p className="text-gray-500">You need to be assigned to a class to view AI performance analytics.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 animate-in fade-in duration-1000">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-indigo-600 font-bold uppercase tracking-widest text-xs">
            <Sparkles className="h-4 w-4" />
            Empowered by AI
          </div>
          <h1 className="text-4xl font-black text-gray-900 tracking-tight">Academic AI Scientist</h1>
          <p className="text-gray-500 font-medium">Deep-dive into student performance and classroom trends.</p>
        </div>

        <div className="flex flex-col">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Current Focus</label>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="rounded-xl border-gray-200 text-sm font-bold focus:ring-2 focus:ring-indigo-500 h-12 px-6 border bg-white min-w-[220px] shadow-sm"
          >
            {myClasses.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {!analytics ? (
        <div className="p-20 text-center bg-white rounded-3xl border border-gray-200">
          <p className="text-gray-400 italic">No student data found for this class. Add students and marks to activate AI Analysis.</p>
        </div>
      ) : (
        <>
          {/* Top Row: AI Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-indigo-600 rounded-3xl p-6 text-white shadow-xl shadow-indigo-100">
              <p className="text-indigo-200 text-xs font-bold uppercase tracking-widest mb-2">Power Subject</p>
              <h3 className="text-3xl font-black mb-1">{analytics.bestSubject}</h3>
              <p className="text-indigo-100 text-xs flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Best average performance across the class
              </p>
            </div>
            
            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
              <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Intervention Hub</p>
              <h3 className="text-3xl font-black text-red-500 mb-1">{analytics.weakestSubject}</h3>
              <p className="text-gray-500 text-xs flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 text-amber-500" />
                Requires immediate instructional review
              </p>
            </div>

            <div className="bg-white rounded-3xl p-6 border border-gray-200 shadow-sm">
               <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-2">Success Rate</p>
               <h3 className="text-3xl font-black text-gray-900 mb-1">
                  {Math.round(((analytics.stats.gifted + analytics.stats.onTrack) / (classStudents.length || 1)) * 100)}%
               </h3>
               <p className="text-gray-500 text-xs flex items-center gap-1">
                 <Users className="h-3 w-3 text-indigo-400" />
                 Total students passing (50%+)
               </p>
            </div>
          </div>

          {/* Visual Analytics Row */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Subject Performance Bar Chart */}
            <div className="lg:col-span-3 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <h4 className="font-black text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" />
                Subject Average Distribution
              </h4>
              <div className="h-[350px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.subjectAverages} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12, fontWeight: 700 }}
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 12 }}
                      domain={[0, 100]}
                    />
                    <Tooltip 
                      cursor={{ fill: '#f8fafc' }}
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                    />
                    <Bar 
                      dataKey="average" 
                      fill="#4f46e5" 
                      radius={[6, 6, 0, 0]} 
                      barSize={40}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Student Category Pie Chart */}
            <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-200 shadow-sm space-y-6">
              <h4 className="font-black text-gray-900 flex items-center gap-2">
                <PieChartIcon className="h-5 w-5 text-indigo-600" />
                Performance Segments
              </h4>
              <div className="h-[350px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={analytics.categoryDistribution}
                      cx="50%"
                      cy="45%"
                      innerRadius={70}
                      outerRadius={100}
                      paddingAngle={8}
                      dataKey="value"
                    >
                      {analytics.categoryDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Legend for Pie Chart */}
                <div className="absolute bottom-0 left-0 right-0 flex flex-col gap-2">
                  {analytics.categoryDistribution.map((d, i) => (
                    <div key={i} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }}></div>
                        <span className="text-gray-600 font-bold">{d.name}</span>
                      </div>
                      <span className="font-black text-gray-900">{d.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* AI Insights & Alerts */}
          <div className="bg-gray-900 rounded-[2.5rem] p-10 text-white relative overflow-hidden shadow-2xl border-4 border-white">
            <div className="absolute top-0 right-0 opacity-10 transform translate-x-1/4 -translate-y-1/4">
               <BrainCircuit className="h-96 w-96" />
            </div>
            
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-4">
                <div className="p-4 bg-white/10 backdrop-blur-md rounded-2xl text-yellow-400">
                  <Lightbulb className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">AI Summary Report</h3>
                  <p className="text-indigo-200 font-medium">Actionable insights generated from real-time data analysis.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {analytics.insights.map((insight, idx) => (
                  <div 
                    key={idx} 
                    className="flex gap-4 p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-colors group"
                  >
                    <div className="h-2 w-2 rounded-full bg-indigo-500 mt-2 flex-shrink-0 group-hover:scale-150 transition-transform"></div>
                    <p className="text-indigo-50 font-medium leading-relaxed">{insight}</p>
                  </div>
                ))}
              </div>

              <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                 <p className="text-xs text-indigo-300 font-bold uppercase tracking-widest">
                    AI Scientist Analysis Complete • Updated {new Date().toLocaleTimeString()}
                 </p>
                 <button className="text-xs font-black bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl transition-all active:scale-95">
                    Generate Full Class Report PDF
                 </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
