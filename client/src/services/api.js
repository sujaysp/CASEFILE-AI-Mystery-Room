import axios from "axios";

export const AUTH_TOKEN_KEY = "casefile:token";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  timeout: 300000,
  headers: { "Content-Type": "application/json" },
});

// Attach the current account's token to protected API requests.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const registerAccount = async ({ name, email, password }) => {
  const response = await api.post("/auth/register", { name, email, password });
  return response.data;
};

export const loginAccount = async ({ email, password }) => {
  const response = await api.post("/auth/login", { email, password });
  return response.data;
};

// Send Google's ID token to the backend; never trust decoded browser claims.
export const googleLoginAccount = async (credential) => {
  if (typeof credential !== "string" || !credential) {
    throw new Error("Google did not return a valid credential.");
  }
  const response = await api.post("/auth/google", { credential });
  return response.data;
};

export const getCurrentUser = async () => {
  const response = await api.get("/auth/me");
  return response.data;
};

export const createMystery = async ({ premise, difficulty }) => {
  const response = await api.post("/cases", { premise, difficulty });
  return response.data;
};

export const listCases = async (limit = 100) => {
  const response = await api.get("/cases", { params: { limit } });
  return response.data;
};

export const getCase = async (caseId) => {
  if (!caseId) throw new Error("A case ID is required.");
  const response = await api.get(`/cases/${encodeURIComponent(caseId)}`);
  return response.data;
};

export const renameCase = async (caseId, customTitle) => {
  if (!caseId) throw new Error("A case ID is required.");
  if (typeof customTitle !== "string") throw new Error("A title is required.");
  const response = await api.patch(
    `/cases/${encodeURIComponent(caseId)}/rename`,
    { customTitle }
  );
  return response.data;
};

export const deleteCase = async (caseId) => {
  if (!caseId) throw new Error("A case ID is required.");
  const response = await api.delete(`/cases/${encodeURIComponent(caseId)}`);
  return response.data;
};

export const discoverClue = async (caseId, clueId) => {
  if (!caseId || !clueId) {
    throw new Error("A case ID and clue ID are required.");
  }
  const response = await api.post(
    `/cases/${encodeURIComponent(caseId)}/clues/${encodeURIComponent(clueId)}/discover`
  );
  return response.data;
};

export const useHint = async (caseId) => {
  if (!caseId) throw new Error("A case ID is required.");
  const response = await api.post(
    `/cases/${encodeURIComponent(caseId)}/hints/use`
  );
  return response.data;
};

export const submitAccusation = async (caseId, suspectId) => {
  if (!caseId || !suspectId) {
    throw new Error("A case ID and suspect ID are required.");
  }
  const response = await api.post(
    `/cases/${encodeURIComponent(caseId)}/accusation`,
    { suspectId }
  );
  return response.data;
};

export default api;
