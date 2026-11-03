export interface StudentQuizOption {
  id: string;
  label: string;
}

export interface StudentQuizQuestion {
  id: string;
  question: string;
  options: StudentQuizOption[];
}

export interface QuizAttemptSummary {
  id: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  passed: boolean;
  submittedAt: string | Date;
}

export interface StudentModuleQuiz {
  id: string;
  sectionId: string;
  title: string;
  instructions: string | null;
  passMark: number;
  questions: StudentQuizQuestion[];
  latestAttempt: QuizAttemptSummary | null;
  bestScore: number | null;
}

export interface QuizSubmissionResult extends QuizAttemptSummary {
  answers: Array<{
    questionId: string;
    selectedOptionId: string;
    correctOptionId: string;
    isCorrect: boolean;
    explanation: string | null;
  }>;
}

export interface CourseQuizReport {
  enrolledStudents: number;
  modules: Array<{
    sectionId: string;
    sectionTitle: string;
    quizId: string | null;
    quizTitle: string | null;
    isPublished: boolean;
    questionCount: number;
    attemptedStudents: number;
    outstandingStudents: number;
    averageScore: number | null;
    passedStudents: number;
    students: Array<{
      studentId: string;
      name: string | null;
      email: string;
      attempts: number;
      latestScore: number | null;
      bestScore: number | null;
      passed: boolean | null;
      lastSubmittedAt: Date | string | null;
    }>;
  }>;
}
