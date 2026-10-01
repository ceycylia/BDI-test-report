export type AdminUser = {
  id: string;
  name: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN";
  isActive: boolean;
};

export type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
  };
};
