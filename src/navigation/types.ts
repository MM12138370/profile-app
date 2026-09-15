export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;
  Main: undefined;
  Profile: { resumeId?: string };
  MasterTemplate: undefined;
  ResumePreview: { resumeId: string };
  JobNew: undefined;
  JobDetail: { jobId: string };
  JobStructured: { jobId: string };
  ProjectMatch: { jobId: string };
  InterviewSession: { jobId: string };
  InterviewReview: { jobId: string };
  Settings: undefined;
  AiConnect: undefined;
};

export type MainTabParamList = {
  ProfileTab: undefined;
  JobsTab: undefined;
  InterviewTab: undefined;
};
