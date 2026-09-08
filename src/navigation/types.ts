export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  JobNew: undefined;
  JobDetail: { jobId: string };
  InterviewSession: { jobId: string };
  Settings: undefined;
};

export type MainTabParamList = {
  ProfileTab: undefined;
  JobsTab: undefined;
  InterviewTab: undefined;
};
