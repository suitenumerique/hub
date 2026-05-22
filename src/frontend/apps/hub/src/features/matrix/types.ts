// In future implementation we could merge both types
// import { User } from '@/features/auth/types';

// response from login with matrix client
export type MatrixUserInterface = {
  homeserverUrl: string;
  identityServerUrl?: string;
  mxId: string;
  deviceId?: string;
  accessToken: string;
  refreshToken?: string;
  guest?: boolean;
  pickleKey?: string;
  freshLogin?: boolean;
};
