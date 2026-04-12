import { ClassRoom, Student, SubjectResult, User } from '../types';

export interface AnalyticsData {
  subjectAverages: { name: string; average: number }[];
  categoryDistribution: { name: string; value: number; color: string }[];
  insights: string[];
  bestSubject: string;
  weakestSubject: string;
  stats: {
    gifted: number;
    onTrack: number;
    highRisk: number;
  };
}

export function generateAiInsights(
  activeClass: ClassRoom,
  classStudents: Student[],
  allResults: SubjectResult[]
): AnalyticsData {
  const classResults = allResults.filter(r => classStudents.some(s => s.id === r.studentId));

  // 1. Calculate student averages and categorize
  const studentStats = classStudents.map(student => {
    const studentResults = classResults.filter(r => r.studentId === student.id);
    const totalScore = studentResults.reduce((sum, r) => sum + r.totalScore, 0);
    const average = studentResults.length > 0 ? totalScore / studentResults.length : 0;
    
    let category: 'gifted' | 'onTrack' | 'highRisk' = 'highRisk';
    if (average >= 75) category = 'gifted';
    else if (average >= 50) category = 'onTrack';

    return { student, average, category };
  });

  const stats = {
    gifted: studentStats.filter(s => s.category === 'gifted').length,
    onTrack: studentStats.filter(s => s.category === 'onTrack').length,
    highRisk: studentStats.filter(s => s.category === 'highRisk').length,
  };

  // 2. Calculate subject averages
  const subjects = Array.from(new Set(classResults.map(r => r.subjectName)));
  const subjectAverages = subjects.map(sub => {
    const subResults = classResults.filter(r => r.subjectName === sub);
    const avg = subResults.reduce((sum, r) => sum + r.totalScore, 0) / (subResults.length || 1);
    return { name: sub, average: Number(avg.toFixed(1)) };
  }).sort((a, b) => b.average - a.average);

  const bestSubject = subjectAverages.length > 0 ? subjectAverages[0].name : 'N/A';
  const weakestSubject = subjectAverages.length > 0 ? subjectAverages[subjectAverages.length - 1].name : 'N/A';

  // 3. Category Distribution for Pie Chart
  const categoryDistribution = [
    { name: 'Gifted / High Achievers', value: stats.gifted, color: '#10b981' }, // Emerald
    { name: 'On Track', value: stats.onTrack, color: '#3b82f6' }, // Blue
    { name: 'High Risk / Needs Intervention', value: stats.highRisk, color: '#ef4444' }, // Red
  ].filter(d => d.value > 0);

  // 4. Actionable AI Insights
  const insights: string[] = [];
  
  if (stats.highRisk > 0) {
    insights.push(`AI Alert: ${stats.highRisk} student(s) in ${activeClass.name} are showing severe gaps and require immediate intervention (below 50% avg).`);
  }

  if (subjectAverages.length > 0 && subjectAverages[subjectAverages.length - 1].average < 50) {
    insights.push(`Subject Alert: ${weakestSubject} is currently the weakest subject. Consider a dedicated review session for this subject.`);
  }

  if (stats.gifted > 0) {
    insights.push(`Performance Note: ${stats.gifted} student(s) are excelling in ${bestSubject}. Consider them for the school's peer-to-peer tutoring program.`);
  }

  if (classResults.length > 0) {
    insights.push(`Data Insight: The overall class performance is driven by strong results in ${bestSubject}. Let's replicate those teaching strategies in other areas.`);
  } else {
    insights.push("Data Insight: No results have been recorded for this class yet. Start entering marks to see AI analytics.");
  }

  return {
    subjectAverages,
    categoryDistribution,
    insights,
    bestSubject,
    weakestSubject,
    stats
  };
}
