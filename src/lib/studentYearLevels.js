export const ENROLLMENT_YEAR_LEVELS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
export const STUDENT_YEAR_LEVELS = [...ENROLLMENT_YEAR_LEVELS, 'Graduated'];

export function studentYearLevel(student) {
  return student.yearLevel?.trim() || student.yearSection?.split(' - ')[0].trim() || '';
}

export function updatedYearSection(student, yearLevel, section) {
  const legacySection = student.yearSection?.split(' - ').slice(1).join(' - ').trim();
  return [yearLevel, section === undefined ? student.section || legacySection : section].filter(Boolean).join(' - ');
}
