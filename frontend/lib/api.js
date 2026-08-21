import { getSession, signOut } from "next-auth/react";
import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

export const apiFetch = async (endpoint, options = {}) => {
  const session = await getSession();
  const token = session?.backendJwt;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  const formattedEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const response = await fetch(`${API_URL}${formattedEndpoint}`, config);

  if (response.status === 401) {
    if (typeof window !== "undefined") {
      toast.error("Session expired. Please log in again.");
      console.warn("Backend token expired or invalid. Logging out...");
      signOut({ callbackUrl: "/" });
    }
  }

  return response;
};
