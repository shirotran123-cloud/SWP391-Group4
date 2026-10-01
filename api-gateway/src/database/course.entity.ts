export interface CourseRecord {
  courseId: string;
  courseCode: string;
  courseName: string;
  description?: string;
  semester: string;
  instructorId: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
