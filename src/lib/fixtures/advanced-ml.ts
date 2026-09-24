/**
 * Reference assessment table from the Advanced ML module. Used as a fixture for the grade
 * calculation tests and by the optional `seed:demo` script. Weights sum to 100.
 * The "*" marker has a course-specific meaning, so it is modelled as a tag.
 */
export interface AssessmentFixture {
  lecturer: string;
  name: string;
  weight: number;
  starred: boolean;
}

export const ADVANCED_ML_ASSESSMENTS: AssessmentFixture[] = [
  { lecturer: "NdS", name: "Interactive books", weight: 3, starred: true },
  { lecturer: "NdS", name: "In-class quizzes", weight: 7, starred: true },
  { lecturer: "NdS", name: "Assignments", weight: 7, starred: true },
  {
    lecturer: "RTU",
    name: "AWS Certificate (Generative AI Foundations 175878)",
    weight: 17,
    starred: false,
  },
  { lecturer: "AF", name: "Homework Assignments (2)", weight: 16, starred: false },
  { lecturer: "NdS", name: "Final Exam (Part A)", weight: 17, starred: true },
  { lecturer: "RTU", name: "Final Exam (Part B)", weight: 17, starred: false },
  { lecturer: "AF", name: "Final Exam (Part C)", weight: 16, starred: false },
];
