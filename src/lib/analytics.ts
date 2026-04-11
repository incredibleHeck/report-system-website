import { Student, Subject, Result } from '../types';

export interface StudentPerformance {
  student: Student;
  average: number;
  category: 'Gifted / High Achievers' | 'On Track' | 'Needs Intervention';
}

export function categorizeLearners(students: Student[], subjects: Subject[], results: Result[]) {
  // 1. Calculate student averages and categorize
  const studentPerformances: StudentPerformance[] = students.map(student => {
    const studentResults = results.filter(r => r.studentId === student.id);
    const totalScore = studentResults.reduce((sum, r) => sum + r.totalScore, 0);
    const average = studentResults.length > 0 ? totalScore / studentResults.length : 0;
    
    let category: StudentPerformance['category'] = 'Needs Intervention';
    if (average >= 75) category = 'Gifted / High Achievers';
    else if (average >= 50) category = 'On Track';

    return { student, average, category };
  }).filter(sp => results.some(r => r.studentId === sp.student.id)); // Only include students with results

  // 2. Calculate category distribution for Pie Chart
  const distribution = {
    'Gifted / High Achievers': 0,
    'On Track': 0,
    'Needs Intervention': 0,
  };
  
  studentPerformances.forEach(sp => {
    distribution[sp.category]++;
  });

  const pieData = [
    { name: 'Gifted / High Achievers', value: distribution['Gifted / High Achievers'], color: '#10b981' }, // emerald-500
    { name: 'On Track', value: distribution['On Track'], color: '#3b82f6' }, // blue-500
    { name: 'Needs Intervention', value: distribution['Needs Intervention'], color: '#ef4444' }, // red-500
  ].filter(d => d.value > 0);

  // 3. Calculate subject averages for Bar Chart
  const subjectAverages = subjects.map(subject => {
    const subjectResults = results.filter(r => r.subjectId === subject.id);
    const totalScore = subjectResults.reduce((sum, r) => sum + r.totalScore, 0);
    const average = subjectResults.length > 0 ? totalScore / subjectResults.length : 0;
    return {
      subject: subject.name,
      code: subject.code,
      average: Number(average.toFixed(1)),
      needsInterventionCount: subjectResults.filter(r => r.totalScore < 50).length
    };
  }).filter(sa => results.some(r => r.subjectId === subjects.find(s => s.code === sa.code)?.id));

  // 4. Generate Actionable AI Insights
  const insights: string[] = [];
  
  const giftedCount = distribution['Gifted / High Achievers'];
  if (giftedCount > 0) {
    insights.push(`🌟 ${giftedCount} student(s) are performing exceptionally well (75%+ average). Consider advanced placement or enrichment activities.`);
  }

  const interventionCount = distribution['Needs Intervention'];
  if (interventionCount > 0) {
    insights.push(`⚠️ ${interventionCount} student(s) require immediate academic intervention (below 50% average).`);
  }

  subjectAverages.forEach(sa => {
    if (sa.needsInterventionCount > 0) {
      insights.push(`📊 ${sa.needsInterventionCount} student(s) need intervention in ${sa.subject} (scored below 50%).`);
    }
    if (sa.average < 50 && sa.average > 0) {
      insights.push(`📉 School-wide average for ${sa.subject} is critically low (${sa.average}%). Review teaching methodologies for this subject.`);
    }
  });

  if (insights.length === 0 && studentPerformances.length > 0) {
    insights.push("✅ All students are on track. Keep up the good work!");
  } else if (studentPerformances.length === 0) {
    insights.push("ℹ️ No data available to generate insights. Please add student results.");
  }

  return {
    studentPerformances,
    pieData,
    subjectAverages,
    insights
  };
}
