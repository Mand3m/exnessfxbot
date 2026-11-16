/** Sample accounts for local testing. Real members still need a full email and 6+ character password. */
export const SAMPLE_STUDENT_LOGIN = "amos";
export const SAMPLE_STUDENT_PASSWORD = "amos";
export const STAFF_LOGIN = "mandem";
export const STAFF_PASSWORD = "mandem";

export function isSampleStudentLogin(value: string) {
  return value.trim().toLowerCase() === SAMPLE_STUDENT_LOGIN;
}

export function isSampleStaffLogin(value: string) {
  return value.trim().toLowerCase() === STAFF_LOGIN;
}
