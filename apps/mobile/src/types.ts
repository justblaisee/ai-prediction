export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
};

export type Organization = {
  id: string;
  name: string;
};

export type AuthPayload = {
  accessToken: string;
  refreshToken: string;
  user: User;
  organization: Organization;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category?: string | null;
  currentStock: number;
  minThreshold: number;
};

export type TrainStatus = {
  status: 'idle' | 'running' | 'completed' | 'failed';
  productId: string;
  message: string;
  progress: number;
  error?: string;
};
