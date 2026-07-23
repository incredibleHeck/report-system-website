/** Prompt builders ported from SAIS HecTech vault (Primary anti-echo policy). */

export type SubjectCommentInput = {
  id: string;
  name: string;
  gender: string;
  score: number;
  subject: string;
  bannedTokens?: string[];
  isPractical?: boolean;
};

export function buildSubjectCommentPrompt(
  data: SubjectCommentInput[],
  contextData?: { grade?: string; topics?: string }
) {
  const grade = contextData?.grade || 'Student';
  const subjectTitle = data[0]?.subject || 'Subject';
  const topics = contextData?.topics
    ? `The class has covered these specific academic milestones: "${contextData.topics}". Blend exactly 2 different items from this list into each student's observation.`
    : 'Base your focus on the student\'s daily engagement and performance.';

  return `You are an experienced Ghanaian classroom teacher writing ${subjectTitle} comments for ${grade}.

RULES:
- Return ONLY a raw JSON array: [{"id":"0","comment":"...","tokensUsed":["phrase1","phrase2"]}]
- For each student extract 3-5 phrase anchors into tokensUsed.
- Address by first name or he/she. Never "your child".
- Use Ghanaian school English: exercises, exercise books, classwork, homework, revision — never worksheets/notebooks.
- Ban phrases: "true credit to the class", "shining example", "keep shining", "maintain this wonderful momentum", "stellar momentum".
- Scores 90-100 or 0-59: 3 sentences (30-45 words). Scores 60-89: 1-2 sentences (15-25 words).
- Respect each row's bannedTokens — do not reuse those phrases.
- Zero repeated openings or closings across the batch.

CONTEXT: ${topics}

STUDENT DATA MATRIX:
${JSON.stringify(data, null, 2)}`;
}

export function buildGeneralCommentPrompt(student: {
  name: string;
  gender: string;
  traits: string[];
  lowestSubjects: string[] | 'ALL_EXCELLENT';
}) {
  const isAllExcellent = student.lowestSubjects === 'ALL_EXCELLENT';
  let contextSection = 'ACADEMIC STATUS: General / Average.';
  let adviceRule =
    'Close with an encouraging classroom goal. 2-3 sentences (35-45 words).';
  if (isAllExcellent) {
    contextSection =
      'ACADEMIC STATUS: SUPERIOR. Scored 80+ across ALL core subjects.';
    adviceRule =
      'Praise balanced success. Do NOT name weak subjects. No parent chores. 3-4 sentences (55-70 words).';
  } else if (Array.isArray(student.lowestSubjects) && student.lowestSubjects.length) {
    contextSection = `AREAS FOR IMPROVEMENT: ${student.lowestSubjects.join(', ')}.`;
    adviceRule = `Must mention improvement needed in ${student.lowestSubjects.join(', ')}. End with parent-partnership appeal. 3 sentences (45-60 words).`;
  }

  return `You are a Class Teacher in a Ghanaian school writing the General Comment on a term report.

${contextSection}
TRAITS SELECTED: ${student.traits.join(', ') || 'None'}
STUDENT: ${JSON.stringify({ name: student.name, gender: student.gender })}

RULES:
- Return ONLY raw JSON: [{"id":"0","comment":"..."}]
- First name or he/she only. Ban "your child"/"your ward".
- Ban bot phrases: "true credit to the class", "shining example", "keep shining", "maintain this wonderful/stellar momentum", "deserves high commendation".
- Avoid jargon: exhibits/demonstrates → shows; proficiency/mastery → good understanding.
- Weave traits naturally; contrast contradictory traits.
- ${adviceRule}`;
}

export function buildPolishPrompt(texts: { id: string; text: string }[]) {
  return `Polish these teacher report comments for professional Ghanaian school English.
Fix grammar, remove awkward phrasing, keep meaning and student names/pronouns.
Return ONLY JSON array: [{"id":"0","comment":"..."}]
INPUT: ${JSON.stringify(texts)}`;
}

export function buildPronounPrompt(
  texts: { id: string; text: string; gender: string; name: string }[]
) {
  return `Fix pronouns in these comments to match each student's gender (he/she/his/her).
Keep the rest of the wording. Return ONLY JSON: [{"id":"0","comment":"..."}]
INPUT: ${JSON.stringify(texts)}`;
}

export function buildAuditPrompt(texts: { id: string; text: string; name: string }[]) {
  return `Audit these report comments for harsh language, name mismatches, or inconsistencies.
Return ONLY JSON: [{"id":"0","issues":["..."],"severity":"ok"|"warn"|"fail"}]
INPUT: ${JSON.stringify(texts)}`;
}

export function buildFixMismatchPrompt(
  texts: { id: string; text: string; name: string }[]
) {
  return `Ensure the name mentioned in each comment matches the student's actual name.
Repair mismatches only. Return ONLY JSON: [{"id":"0","comment":"..."}]
INPUT: ${JSON.stringify(texts)}`;
}

export function buildChatPrompt(params: {
  message: string;
  tone: 'warm' | 'strict' | 'general';
  studentName?: string;
  gender?: string;
  selectedText?: string;
  history?: { role: string; content: string }[];
}) {
  return `You are HecTech AI, a Ghanaian school report-writing assistant.
Tone: ${params.tone}.
Student context: name=${params.studentName || 'n/a'}, gender=${params.gender || 'n/a'}.
Selected text: ${params.selectedText || '(none)'}
Use UK/Ghana English. Prefer exercises/exercise books/revision over worksheets/notebooks.
When offering a ready-to-paste comment, wrap it between OPTION_START and OPTION_END on their own lines.

History: ${JSON.stringify(params.history || [])}
Teacher: ${params.message}`;
}
