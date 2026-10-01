export type AdminIdentity = {
  id: string;
  name: string;
  username: string;
  role: "SUPERADMIN" | "ADMIN";
  isActive: boolean;
};

export type AdminSessionIdentity = {
  id: string;
  csrfTokenHash: string;
  expiresAt: string;
};

export type AppEnvironment = {
  Bindings: Env;
  Variables: {
    admin: AdminIdentity;
    adminSession: AdminSessionIdentity;
  };
};
