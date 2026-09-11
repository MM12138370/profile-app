export type RootStackParamList = {
  Login: undefined;
  Welcome: undefined;
  Main: undefined;
  Profile: undefined;
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
