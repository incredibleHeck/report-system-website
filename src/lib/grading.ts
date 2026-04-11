export function calculateGrade(cw: number, mt: number, eot: number) {
  const total = cw + mt + eot;
  let grade = 'U';
  let comment = 'Fail';
  let isPass = false;

  if (total >= 90) {
    grade = 'A*';
    comment = 'Outstanding';
    isPass = true;
  } else if (total >= 80) {
    grade = 'A';
    comment = 'Excellent';
    isPass = true;
  } else if (total >= 70) {
    grade = 'B';
    comment = 'Very Good';
    isPass = true;
  } else if (total >= 60) {
    grade = 'C';
    comment = 'Good';
    isPass = true;
  } else if (total >= 50) {
    grade = 'D';
    comment = 'Credit';
    isPass = true;
  } else if (total >= 40) {
    grade = 'E';
    comment = 'Pass';
    isPass = true;
  } else {
    grade = 'U';
    comment = 'Fail';
    isPass = false;
  }

  return { totalScore: total, grade, comment, isPass };
}
