import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronRight,
  Clock3,
  Copy,
  Feather,
  FileSearch,
  Fingerprint,
  Flame,
  FolderClock,
  Gem,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Menu,
  Plus,
  Pencil,
  Save,
  Trash2,
  Search,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserRound,
  WandSparkles,
  X,
  XCircle,
  Eye,
  EyeOff,
} from "lucide-react";

import {
  createMystery,
  getCase,
  discoverClue,
  useHint as requestHint,
  submitAccusation,
  listCases,
  renameCase,
  deleteCase,
  registerAccount,
  loginAccount,
  googleLoginAccount,
  getCurrentUser,
  AUTH_TOKEN_KEY,
} from "./services/api";

import GoogleSignInButton from "./components/GoogleSignInButton";

import "./App.css";
import "./Investigation.css";

const HISTORY_KEY = "casefile:history";
const LAST_CASE_KEY = "casefile:lastCaseId";
const HINT_KEY_PREFIX = "casefile:hints:";
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || "";

const difficultyOptions = [
  {
    name: "Easy",
    description: "A gentle investigation",
    detail: "A focused case with fewer moving parts.",
    suspects: 3,
    clues: 5,
    hints: 2,
    icon: Feather,
    score: 100,
  },
  {
    name: "Medium",
    description: "A test of deduction",
    detail: "More evidence, more possibilities.",
    suspects: 4,
    clues: 7,
    hints: 3,
    icon: Search,
    score: 150,
  },
  {
    name: "Hard",
    description: "For sharp investigators",
    detail: "A layered case for careful readers.",
    suspects: 5,
    clues: 9,
    hints: 3,
    icon: Flame,
    score: 200,
  },
];

const samplePremises = [
  "During a private auction at the Bellweather Hotel, a rare sapphire disappears from a locked display case. The curator insists the security system never stopped recording, yet the final four minutes of footage show an empty ballroom. Four guests had access to the gallery, and each has a reason to keep the night's events secret.",
  "At 11:47 PM, the lighthouse at Greyhaven sends a distress signal despite having been decommissioned for twelve years. The next morning, its caretaker is missing and the logbook contains a fresh entry in handwriting that belongs to someone who died decades ago. Investigate the station, question the people who visited that week, and uncover what happened.",
  "During the annual midnight test at the Arclight Radio Observatory, retired signal engineer Dev Malhotra is found dead inside a soundproof transmission booth. The booth was locked from the inside, the emergency power system never activated, and exactly 47 seconds of the night's recording have mysteriously disappeared. Five people were inside the observatory that night, each hiding something about an unusual transmission discovered by Dev.",
];

function readHistory() {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item?.caseId) : [];
  } catch {
    return [];
  }
}

function writeHistory(items) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("Unable to save Casefile history in this browser:", error);
  }
}

function clearLocalAccountCache() {
  localStorage.removeItem(HISTORY_KEY);
  localStorage.removeItem(LAST_CASE_KEY);
  const hintKeys = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(HINT_KEY_PREFIX)) hintKeys.push(key);
  }
  hintKeys.forEach((key) => localStorage.removeItem(key));
}

function getHintStorageKey(caseId) {
  return `${HINT_KEY_PREFIX}${caseId}`;
}

function readHints(caseId) {
  try {
    const parsed = JSON.parse(localStorage.getItem(getHintStorageKey(caseId)) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    localStorage.removeItem(getHintStorageKey(caseId));
    return [];
  }
}

function getErrorMessage(error) {
  const serverMessage = error?.response?.data?.message;
  if (serverMessage) return serverMessage;
  if (error?.code === "ECONNABORTED") {
    return "The request took too long. Check the server terminal and try again.";
  }
  if (!error?.response) {
    return "The Casefile server could not be reached. Make sure the backend is running.";
  }
  return error.message || "Something went wrong. Please try again.";
}

function formatDate(value) {
  if (!value) return "Just created";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just created";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDate(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}

function historyRecord(caseData) {
  const customTitle = caseData.customTitle || null;
  const title = caseData.title || "Untitled investigation";
  return {
    caseId: caseData.caseId,
    title,
    customTitle,
    displayTitle: customTitle || title,
    difficulty: caseData.difficulty || "Medium",
    status: caseData.status || "active",
    createdAt: caseData.createdAt || new Date().toISOString(),
    updatedAt: caseData.updatedAt || new Date().toISOString(),
    score: caseData.score ?? 0,
    clueCount: caseData.clues?.length ?? caseData.clueCount ?? 0,
    discoveredClueCount:
      caseData.clues?.filter((clue) => clue.discovered).length ??
      caseData.discoveredClueCount ?? 0,
    hintCount: caseData.hintProgress?.total ?? caseData.hintCount ?? 0,
    usedHintCount: caseData.hintProgress?.used ?? caseData.usedHintCount ?? 0,
  };
}

function App() {
  const [authUser, setAuthUser] = useState(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [authMode, setAuthMode] = useState("login");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [showAuthPassword, setShowAuthPassword] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [premise, setPremise] = useState("");
  const [difficulty, setDifficulty] = useState("Medium");
  const [history, setHistory] = useState([]);
  const [historySearch, setHistorySearch] = useState("");
  const [editingCaseId, setEditingCaseId] = useState("");
  const [renameDraft, setRenameDraft] = useState("");
  const [generatedCase, setGeneratedCase] = useState(null);
  const [finalResult, setFinalResult] = useState(null);
  const [revealedHints, setRevealedHints] = useState([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRestoringCase, setIsRestoringCase] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState(false);
  const [selectedSuspectId, setSelectedSuspectId] = useState("");
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const selectedDifficulty =
    difficultyOptions.find((option) => option.name === difficulty) || difficultyOptions[1];

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    if (!query) return history;
    return history.filter((item) =>
      `${item.displayTitle || item.customTitle || item.title} ${item.title} ${item.difficulty} ${item.status}`.toLowerCase().includes(query)
    );
  }, [history, historySearch]);

  const rememberCase = (caseData) => {
    if (!caseData?.caseId) return;
    const current = readHistory();
    const previous = current.find((item) => item.caseId === caseData.caseId);
    const nextRecord = historyRecord({
      ...caseData,
      customTitle: caseData.customTitle ?? previous?.customTitle ?? null,
    });
    const next = [
      nextRecord,
      ...current.filter((item) => item.caseId !== caseData.caseId),
    ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    writeHistory(next);
    setHistory(next);
    localStorage.setItem(LAST_CASE_KEY, caseData.caseId);
  };

  const restoreCase = async (caseId, showNotice = false) => {
    if (!caseId) return;
    setIsRestoringCase(true);
    setError("");
    try {
      const response = await getCase(caseId);
      if (!response?.success || !response?.case) {
        throw new Error(response?.message || "This investigation could not be loaded.");
      }
      setGeneratedCase(response.case);
      setFinalResult(response.result || null);
      setRevealedHints(response.case.revealedHints || readHints(caseId));
      setSelectedSuspectId("");
      localStorage.setItem(LAST_CASE_KEY, caseId);
      rememberCase(response.case);
      if (showNotice) setNotice("Investigation reopened from your case history.");
      setMobileSidebarOpen(false);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsRestoringCase(false);
    }
  };

  // Restore the signed-in account before making any private case-history requests.
  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = localStorage.getItem(AUTH_TOKEN_KEY);
      if (!token) {
        if (!cancelled) {
          setAuthUser(null);
          setAuthChecking(false);
          setIsRestoringCase(false);
        }
        return;
      }

      try {
        const response = await getCurrentUser();
        if (!cancelled && response?.success && response?.user) {
          setAuthUser(response.user);
        } else if (!cancelled) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
          setAuthUser(null);
        }
      } catch (sessionError) {
        if (sessionError?.response?.status === 401 || sessionError?.response?.status === 403) {
          localStorage.removeItem(AUTH_TOKEN_KEY);
        }
        if (!cancelled) {
          setAuthUser(null);
          setAuthError(getErrorMessage(sessionError));
        }
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!authUser?.id) return undefined;

    let cancelled = false;

    async function loadHistoryAndRestoreLastCase() {
      await Promise.resolve();
      if (cancelled) return;

      const localHistory = readHistory();
      const lastCaseId = localStorage.getItem(LAST_CASE_KEY);
      setHistory(localHistory);
      setIsRestoringCase(true);

      try {
        const historyResponse = await listCases(100);
        if (cancelled) return;
        if (historyResponse?.success && Array.isArray(historyResponse.cases)) {
          const serverHistory = historyResponse.cases.map(historyRecord);
          writeHistory(serverHistory);
          setHistory(serverHistory);
        }
      } catch (historyError) {
        console.warn(
          "MongoDB case history could not be loaded; using this browser's saved list:",
          historyError
        );
      }

      if (lastCaseId) {
        try {
          const response = await getCase(lastCaseId);
          if (cancelled) return;
          if (response?.success && response?.case) {
            setGeneratedCase(response.case);
            setFinalResult(response.result || null);
            setRevealedHints(response.case.revealedHints || readHints(lastCaseId));
            const cached = readHistory().find((item) => item.caseId === lastCaseId);
            const restoredRecord = historyRecord({
              ...response.case,
              customTitle: response.case.customTitle ?? cached?.customTitle ?? null,
            });
            const next = [
              restoredRecord,
              ...readHistory().filter((item) => item.caseId !== lastCaseId),
            ];
            writeHistory(next);
            setHistory(next);
          }
        } catch (restoreError) {
          console.warn("The last opened case could not be restored:", restoreError);
        }
      }

      if (!cancelled) setIsRestoringCase(false);
    }

    loadHistoryAndRestoreLastCase();
    return () => {
      cancelled = true;
    };
  }, [authUser?.id]);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");

    try {
      const credentials = {
        email: authEmail.trim().toLowerCase(),
        password: authPassword,
      };
      const response = authMode === "register"
        ? await registerAccount({ ...credentials, name: authName.trim() })
        : await loginAccount(credentials);

      if (!response?.success || !response?.token || !response?.user) {
        throw new Error(response?.message || "Authentication could not be completed.");
      }

      // Clear the previous browser cache when switching accounts. MongoDB remains the source of truth.
      clearLocalAccountCache();
      localStorage.setItem(AUTH_TOKEN_KEY, response.token);
      setHistory([]);
      setGeneratedCase(null);
      setFinalResult(null);
      setRevealedHints([]);
      setAuthPassword("");
      setIsRestoringCase(true);
      setAuthUser(response.user);
    } catch (requestError) {
      setAuthError(getErrorMessage(requestError));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleCredential = async (credential) => {
    if (!credential || authBusy) return;
    setAuthBusy(true);
    setAuthError("");

    try {
      const response = await googleLoginAccount(credential);
      if (!response?.success || !response?.token || !response?.user) {
        throw new Error(response?.message || "Google sign-in could not be completed.");
      }

      clearLocalAccountCache();
      localStorage.setItem(AUTH_TOKEN_KEY, response.token);
      setHistory([]);
      setGeneratedCase(null);
      setFinalResult(null);
      setRevealedHints([]);
      setAuthPassword("");
      setIsRestoringCase(true);
      setAuthUser(response.user);
    } catch (requestError) {
      setAuthError(getErrorMessage(requestError));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleGoogleScriptError = () => {
    setAuthError("Google sign-in could not load. Check your connection or continue with email.");
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    clearLocalAccountCache();
    setAuthUser(null);
    setIsRestoringCase(false);
    setHistory([]);
    setGeneratedCase(null);
    setFinalResult(null);
    setRevealedHints([]);
    setPremise("");
    setAuthPassword("");
    setAuthMode("login");
    setNotice("");
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanPremise = premise.trim();

    if (cleanPremise.length < 20 || cleanPremise.length > 600) {
      setError("Your premise must contain between 20 and 600 characters.");
      return;
    }

    setIsGenerating(true);
    setError("");
    setNotice("");
    setGeneratedCase(null);
    setFinalResult(null);
    setRevealedHints([]);
    setSelectedSuspectId("");
    setCopied(false);
    localStorage.removeItem(LAST_CASE_KEY);

    try {
      const response = await createMystery({ premise: cleanPremise, difficulty });
      if (!response?.success || !response?.case) {
        throw new Error(response?.message || "The mystery could not be created.");
      }

      setGeneratedCase(response.case);
      setFinalResult(null);
      setRevealedHints([]);
      setPremise("");
      setNotice("Your new investigation is ready. Examine the briefing before you begin.");
      rememberCase(response.case);

      window.setTimeout(() => {
        document.getElementById("generated-case")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartNew = () => {
    if (
      generatedCase?.status === "active" &&
      !window.confirm("Start a new investigation? Your current case will remain in your history.")
    ) {
      return;
    }

    localStorage.removeItem(LAST_CASE_KEY);
    setGeneratedCase(null);
    setFinalResult(null);
    setRevealedHints([]);
    setSelectedSuspectId("");
    setPremise("");
    setDifficulty("Medium");
    setError("");
    setNotice("");
    setCopied(false);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSelectHistory = async (caseId) => {
    if (busyAction || isGenerating || isRestoringCase) return;
    if (generatedCase?.caseId === caseId) {
      setMobileSidebarOpen(false);
      return;
    }
    await restoreCase(caseId, true);
  };

  const beginRenameHistoryItem = (event, item) => {
    event.stopPropagation();
    setEditingCaseId(item.caseId);
    setRenameDraft(item.customTitle || item.title || "");
  };

  const cancelRenameHistoryItem = (event) => {
    event?.stopPropagation();
    setEditingCaseId("");
    setRenameDraft("");
  };

  const handleSaveRename = async (event, caseId) => {
    event.preventDefault();
    event.stopPropagation();
    const cleanTitle = renameDraft.trim();
    if (cleanTitle.length > 80) {
      setError("Sidebar titles must be 80 characters or fewer.");
      return;
    }

    setBusyAction(`rename:${caseId}`);
    setError("");
    try {
      const response = await renameCase(caseId, cleanTitle);
      if (!response?.success || !response?.case) {
        throw new Error(response?.message || "Unable to rename this investigation.");
      }
      const renamedRecord = historyRecord(response.case);
      const next = [
        renamedRecord,
        ...readHistory().filter((item) => item.caseId !== caseId),
      ].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
      writeHistory(next);
      setHistory(next);
      if (generatedCase?.caseId === caseId) setGeneratedCase(response.case);
      setEditingCaseId("");
      setRenameDraft("");
      setNotice(cleanTitle ? "Investigation renamed in your case history." : "Original AI-generated title restored.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const handleDeleteHistoryItem = async (event, caseId) => {
    event.stopPropagation();
    const selected = history.find((item) => item.caseId === caseId);
    const displayName = selected?.displayTitle || selected?.customTitle || selected?.title || "this investigation";
    const confirmed = window.confirm(
      `Permanently delete "${displayName}" from the database? This cannot be undone.`
    );
    if (!confirmed) return;

    setBusyAction(`delete:${caseId}`);
    setError("");
    try {
      const response = await deleteCase(caseId);
      if (!response?.success) {
        throw new Error(response?.message || "Unable to delete this investigation.");
      }
      const next = readHistory().filter((item) => item.caseId !== caseId);
      writeHistory(next);
      setHistory(next);
      localStorage.removeItem(getHintStorageKey(caseId));
      if (localStorage.getItem(LAST_CASE_KEY) === caseId) {
        localStorage.removeItem(LAST_CASE_KEY);
      }
      if (generatedCase?.caseId === caseId) {
        setGeneratedCase(null);
        setFinalResult(null);
        setRevealedHints([]);
        setSelectedSuspectId("");
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      setNotice("Investigation permanently deleted.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const handleDiscoverClue = async (clue) => {
    if (!generatedCase || clue.discovered || busyAction || isCaseCompleted) return;
    setBusyAction(`clue:${clue.clueId}`);
    setError("");
    setNotice("");
    try {
      const response = await discoverClue(generatedCase.caseId, clue.clueId);
      if (!response?.success || !response?.case) {
        throw new Error(response?.message || "Unable to discover this clue.");
      }
      setGeneratedCase(response.case);
      rememberCase(response.case);
      setNotice(`Evidence added to your board: ${clue.title}`);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const handleUseHint = async () => {
    if (!generatedCase || busyAction || isCaseCompleted) return;
    if ((generatedCase.hintProgress?.remaining ?? 0) <= 0) {
      setError("You have used all available hints for this investigation.");
      return;
    }
    setBusyAction("hint");
    setError("");
    setNotice("");
    try {
      const response = await requestHint(generatedCase.caseId);
      if (!response?.success || !response?.hint || !response?.case) {
        throw new Error(response?.message || "Unable to retrieve a hint.");
      }
      const updatedHints = [...revealedHints, response.hint];
      setRevealedHints(updatedHints);
      setGeneratedCase(response.case);
      rememberCase(response.case);
      localStorage.setItem(getHintStorageKey(generatedCase.caseId), JSON.stringify(updatedHints));
      setNotice("A new hint has been added to your investigation notes.");
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const handleAccusation = async (event) => {
    event.preventDefault();
    if (!generatedCase || busyAction || finalResult || isCaseCompleted) return;
    if (!selectedSuspectId) {
      setError("Select a suspect before submitting your final accusation.");
      return;
    }

    const selectedSuspect = generatedCase.suspects?.find(
      (suspect) => suspect.suspectId === selectedSuspectId
    );
    if (
      !window.confirm(
        `Submit your final accusation against ${selectedSuspect?.name || "this suspect"}? The investigation will then be closed.`
      )
    ) {
      return;
    }

    setBusyAction("accusation");
    setError("");
    setNotice("");
    try {
      const response = await submitAccusation(generatedCase.caseId, selectedSuspectId);
      if (!response?.success || !response?.case || !response?.result) {
        throw new Error(response?.message || "Unable to submit your accusation.");
      }
      setGeneratedCase(response.case);
      rememberCase(response.case);
      setFinalResult(response.result);
      setNotice(
        response.result.isCorrect
          ? "Correct accusation. The evidence led you to the truth."
          : "The case is closed. The complete solution is now available."
      );
      window.setTimeout(() => {
        document.getElementById("final-result")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 120);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyAction("");
    }
  };

  const handleCopyCaseId = async () => {
    if (!generatedCase?.caseId) return;
    try {
      await navigator.clipboard.writeText(generatedCase.caseId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Unable to copy the case ID. You can select and copy it manually.");
    }
  };

  const handleSamplePremise = () => {
    const index = Math.floor(Math.random() * samplePremises.length);
    setPremise(samplePremises[index]);
    setError("");
  };

  const isCaseCompleted = generatedCase?.status === "completed";
  const discoveredCount =
    generatedCase?.clues?.filter((clue) => clue.discovered).length || 0;
  const totalClues = generatedCase?.clues?.length || 0;
  const totalHints = generatedCase?.hintProgress?.total || 0;
  const usedHints = generatedCase?.hintProgress?.used || 0;
  const remainingHints = generatedCase?.hintProgress?.remaining || 0;

  if (authChecking) {
    return (
      <div className="auth-screen">
        <div className="auth-loading"><LoaderCircle className="spin" size={22} /> Restoring your secure Casefile session...</div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="auth-screen">
        <div className="auth-shell">
          <section className="auth-showcase" aria-label="About CASEFILE">
            <div className="auth-brand">
              <div className="brand-mark"><Fingerprint size={23} strokeWidth={1.7} /></div>
              <div>
                <div className="brand-name">CASEFILE</div>
                <div className="brand-caption">THE MYSTERY ROOM</div>
              </div>
            </div>

            <div className="auth-showcase-copy">
              <div className="auth-showcase-kicker"><span /> THE ART OF DEDUCTION</div>
              <h1>Every mystery<br /><em>leaves a trace.</em></h1>
              <p>
                Step into a world of carefully crafted cases. Follow the evidence,
                question every alibi, and find the truth hidden between the details.
              </p>

              <div className="auth-benefits">
                <div>
                  <span className="auth-benefit-icon"><ShieldCheck size={16} /></span>
                  <div><strong>Your cases stay yours</strong><small>Private investigations, saved to your account.</small></div>
                </div>
                <div>
                  <span className="auth-benefit-icon"><Sparkles size={16} /></span>
                  <div><strong>Stories made to be solved</strong><small>Fresh AI-generated mysteries at every difficulty.</small></div>
                </div>
                <div>
                  <span className="auth-benefit-icon"><Clock3 size={16} /></span>
                  <div><strong>Pick up where you left off</strong><small>Your evidence and progress are always close.</small></div>
                </div>
              </div>
            </div>

            <div className="auth-artwork" aria-hidden="true">
              <div className="auth-art-orbit auth-art-orbit-one" />
              <div className="auth-art-orbit auth-art-orbit-two" />
              <div className="auth-art-seal"><Gem size={48} strokeWidth={1.1} /></div>
              <div className="auth-dossier">
                <div className="auth-dossier-top"><span>CASEFILE / 047</span><span>CONFIDENTIAL</span></div>
                <div className="auth-dossier-rule" />
                <strong>THE SILENT FREQUENCY</strong>
                <div className="auth-dossier-bottom"><span>STATUS: OPEN</span><span>5 SUSPECTS · 9 CLUES</span></div>
              </div>
            </div>

            <div className="auth-showcase-footer">
              <span>01 — PRIVATE INVESTIGATOR ACCESS</span>
              <span>BUILT FOR THE CURIOUS</span>
            </div>
          </section>

          <main className="auth-panel">
            <div className="auth-panel-topline">
              <span>{authMode === "login" ? "WELCOME BACK" : "YOUR FIRST CASE STARTS HERE"}</span>
              <span className="auth-secure-label"><LockKeyhole size={13} /> SECURE ACCESS</span>
            </div>

            <div className="auth-form-content">
              <div className="auth-form-heading">
                <span className="auth-eyebrow">{authMode === "login" ? "SIGN IN TO CASEFILE" : "CREATE YOUR INVESTIGATOR PROFILE"}</span>
                <h2>{authMode === "login" ? "Good to see you again." : "Make yourself at home."}</h2>
                <p>
                  {authMode === "login"
                    ? "Your investigations are waiting right where you left them."
                    : "Create an account to save cases, track clues, and keep your progress."}
                </p>
              </div>

              {authError && (
                <div className="auth-error" role="alert">
                  <AlertCircle size={16} /> <span>{authError}</span>
                </div>
              )}

              <div className="auth-google-area">
                {GOOGLE_CLIENT_ID ? (
                  <GoogleSignInButton
                    clientId={GOOGLE_CLIENT_ID}
                    onCredential={handleGoogleCredential}
                    onError={handleGoogleScriptError}
                  />
                ) : (
                  <div className="google-setup-placeholder" aria-disabled="true">
                    <span className="google-g-mark">G</span>
                    <span className="google-placeholder-copy"><strong>Continue with Google</strong><small>Google sign-in will be enabled after OAuth setup</small></span>
                    <LockKeyhole size={14} />
                  </div>
                )}
              </div>

              <div className="auth-divider"><span>OR CONTINUE WITH EMAIL</span></div>

              <form className="auth-form" onSubmit={handleAuthSubmit}>
                {authMode === "register" && (
                  <label className="auth-field">
                    <span>FULL NAME</span>
                    <div className="auth-input-wrap">
                      <UserRound size={16} />
                      <input
                        value={authName}
                        onChange={(event) => setAuthName(event.target.value)}
                        placeholder="How should we address you?"
                        minLength={2}
                        maxLength={40}
                        autoComplete="name"
                        required
                      />
                    </div>
                  </label>
                )}

                <label className="auth-field">
                  <span>EMAIL ADDRESS</span>
                  <div className="auth-input-wrap">
                    <UserRound size={16} />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(event) => setAuthEmail(event.target.value)}
                      placeholder="you@example.com"
                      autoComplete="email"
                      maxLength={254}
                      required
                    />
                  </div>
                </label>

                <label className="auth-field">
                  <span>PASSWORD</span>
                  <div className="auth-input-wrap">
                    <LockKeyhole size={16} />
                    <input
                      type={showAuthPassword ? "text" : "password"}
                      value={authPassword}
                      onChange={(event) => setAuthPassword(event.target.value)}
                      placeholder={authMode === "login" ? "Enter your password" : "At least 8 characters"}
                      minLength={8}
                      maxLength={72}
                      autoComplete={authMode === "login" ? "current-password" : "new-password"}
                      required
                    />
                    <button
                      className="auth-password-toggle"
                      type="button"
                      onClick={() => setShowAuthPassword((visible) => !visible)}
                      aria-label={showAuthPassword ? "Hide password" : "Show password"}
                    >
                      {showAuthPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </label>

                <button className="auth-submit" type="submit" disabled={authBusy}>
                  {authBusy ? <LoaderCircle className="spin" size={17} /> : <LockKeyhole size={16} />}
                  <span>{authBusy ? "Please wait..." : authMode === "login" ? "Sign in to your workspace" : "Create your account"}</span>
                  {!authBusy && <ArrowRight size={16} />}
                </button>
              </form>

              <div className="auth-switch">
                <span>{authMode === "login" ? "New to CASEFILE?" : "Already have an account?"}</span>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode(authMode === "login" ? "register" : "login");
                    setAuthError("");
                    setAuthPassword("");
                    setShowAuthPassword(false);
                  }}
                >
                  {authMode === "login" ? "Create an account" : "Sign in instead"}
                </button>
              </div>
            </div>

            <div className="auth-panel-footer">
              <div><ShieldCheck size={15} /><span>Your investigations are private to your account.</span></div>
              <span>CASEFILE © {new Date().getFullYear()}</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <button
        className={`sidebar-scrim ${mobileSidebarOpen ? "visible" : ""}`}
        aria-label="Close navigation"
        onClick={() => setMobileSidebarOpen(false)}
      />

      <aside className={`sidebar ${mobileSidebarOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand-row">
          <div className="brand">
            <div className="brand-mark"><Fingerprint size={23} strokeWidth={1.7} /></div>
            <div>
              <div className="brand-name">CASEFILE</div>
              <div className="brand-caption">THE MYSTERY ROOM</div>
            </div>
          </div>
          <button className="icon-button sidebar-close" onClick={() => setMobileSidebarOpen(false)} aria-label="Close sidebar">
            <X size={17} />
          </button>
        </div>

        <button className="new-investigation-button" onClick={handleStartNew}>
          <Plus size={17} />
          <span>New investigation</span>
          <span className="shortcut">NEW</span>
        </button>

        <div className="history-heading">
          <span>YOUR CASE HISTORY</span>
          <span className="history-count">{history.length}</span>
        </div>

        <label className="history-search">
          <Search size={15} />
          <input
            value={historySearch}
            onChange={(event) => setHistorySearch(event.target.value)}
            placeholder="Search investigations"
            aria-label="Search case history"
          />
          {historySearch && (
            <button type="button" onClick={() => setHistorySearch("")} aria-label="Clear search">
              <X size={13} />
            </button>
          )}
        </label>

        <div className="history-list">
          {isRestoringCase && history.length === 0 ? (
            <div className="history-empty"><LoaderCircle className="spin" size={17} /> Loading history...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="history-empty">
              <FolderClock size={23} />
              <strong>{history.length ? "No matching cases" : "Your case history is empty"}</strong>
              <span>{history.length ? "Try another search term." : "Every mystery you create will appear here."}</span>
            </div>
          ) : (
            filteredHistory.map((item) => {
              const active = generatedCase?.caseId === item.caseId;
              return (
                <div className={`history-item-wrap ${active ? "selected" : ""}`} key={item.caseId}>
                  {editingCaseId === item.caseId ? (
                    <form className="history-rename-form" onSubmit={(event) => handleSaveRename(event, item.caseId)}>
                      <input
                        autoFocus
                        maxLength={80}
                        value={renameDraft}
                        onChange={(event) => setRenameDraft(event.target.value)}
                        aria-label="New investigation title"
                        onClick={(event) => event.stopPropagation()}
                      />
                      <button type="submit" title="Save title" disabled={busyAction === `rename:${item.caseId}`}>
                        {busyAction === `rename:${item.caseId}` ? <LoaderCircle className="spin" size={13} /> : <Save size={13} />}
                      </button>
                      <button type="button" title="Cancel rename" onClick={cancelRenameHistoryItem}>
                        <X size={13} />
                      </button>
                    </form>
                  ) : (
                    <>
                      <button className="history-item" onClick={() => handleSelectHistory(item.caseId)} disabled={Boolean(busyAction)}>
                        <span className="history-item-icon"><FileSearch size={16} /></span>
                        <span className="history-item-copy">
                          <strong>{item.displayTitle || item.customTitle || item.title || "Untitled investigation"}</strong>
                          <span>{shortDate(item.createdAt)} <i>·</i> {item.difficulty}</span>
                          <small>{item.status === "completed" ? `Completed · ${item.score || 0} pts` : "Active investigation"}</small>
                        </span>
                        <span className={`history-status ${item.status === "completed" ? "complete" : ""}`} title={item.status}>
                          {item.status === "completed" ? <Check size={12} /> : <span />}
                        </span>
                      </button>
                      <div className="history-actions">
                        <button
                          className="history-action-button"
                          title="Rename investigation"
                          aria-label={`Rename ${item.displayTitle || item.title}`}
                          onClick={(event) => beginRenameHistoryItem(event, item)}
                          disabled={Boolean(busyAction)}
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          className="history-action-button history-delete-button"
                          title="Permanently delete investigation"
                          aria-label={`Delete ${item.displayTitle || item.title}`}
                          onClick={(event) => handleDeleteHistoryItem(event, item.caseId)}
                          disabled={Boolean(busyAction)}
                        >
                          {busyAction === `delete:${item.caseId}` ? <LoaderCircle className="spin" size={12} /> : <Trash2 size={12} />}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <div className="sidebar-note-icon"><LockKeyhole size={17} /></div>
            <div>
              <strong>Every detail matters.</strong>
              <p>Your investigations are loaded from the case database. Rename or remove cases from this workspace.</p>
            </div>
          </div>
          <div className="sidebar-footer">
            <span className="online-dot" />
            <span>CASEFILE WORKSPACE</span>
            <span className="footer-version">V1.0</span>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button className="icon-button mobile-menu" onClick={() => setMobileSidebarOpen(true)} aria-label="Open navigation">
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <ChevronRight size={14} />
              <strong>{generatedCase ? "Investigation desk" : "New investigation"}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="system-status"><span className="online-dot" /> AI ENGINE READY</div>
            <div className="topbar-divider" />
            <div className="account-identity" title={authUser.email}>
              <div className="workspace-avatar"><UserRound size={17} /></div>
              <span>{authUser.name || authUser.email}</span>
            </div>
            <button className="signout-button" onClick={handleLogout} title="Sign out">
              <LogOut size={14} /> <span>Sign out</span>
            </button>
          </div>
        </header>

        <div className="workspace-content">
          {notice && (
            <div className="notice-message" role="status">
              <BadgeCheck size={16} />
              <span>{notice}</span>
              <button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={14} /></button>
            </div>
          )}

          {error && (
            <div className="error-message app-error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
              <button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button>
            </div>
          )}

          {!generatedCase ? (
            <>
              <section className="hero-section">
                <div className="hero-copy">
                  <div className="eyebrow"><Sparkles size={14} /> THE ART OF DEDUCTION</div>
                  <h1>Every mystery<br /><em>leaves a trace.</em></h1>
                  <p className="hero-description">
                    Build a case worth solving. Examine the evidence, challenge every alibi,
                    and uncover the truth hidden between the details.
                  </p>
                  <div className="hero-proof">
                    <span><ShieldCheck size={14} /> Evidence-led stories</span>
                    <span><Activity size={14} /> AI-generated cases</span>
                  </div>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <div className="hero-art-halo halo-one" />
                  <div className="hero-art-halo halo-two" />
                  <div className="hero-art-core"><Gem size={66} strokeWidth={1} /></div>
                  <span className="hero-art-label label-top">CASE NO. 001</span>
                  <span className="hero-art-label label-bottom">THE TRUTH IS IN THE DETAILS</span>
                </div>
              </section>

              <div className="section-heading">
                <div>
                  <span className="section-index">01 / CASE CREATION</span>
                  <h2>Set the scene</h2>
                  <p>Start with a premise. Your investigation will take shape from there.</p>
                </div>
                <div className="private-label"><LockKeyhole size={14} /> SOLUTION HIDDEN UNTIL THE END</div>
              </div>

              {isRestoringCase && (
                <div className="loading-card">
                  <LoaderCircle className="spin" size={20} />
                  <div><strong>Checking your saved investigations</strong><p>Restoring your most recent case...</p></div>
                </div>
              )}

              <div className="creation-layout">
                <section className="form-card">
                  <div className="card-heading">
                    <div>
                      <span className="card-kicker">THE BEGINNING</span>
                      <h3>What happened?</h3>
                      <p>Describe the incident, setting, and any details you want the mystery to explore.</p>
                    </div>
                    <div className="step-icon"><WandSparkles size={21} /></div>
                  </div>

                  <form onSubmit={handleSubmit}>
                    <div className="field-heading">
                      <label htmlFor="premise">Mystery premise</label>
                      <span>20–600 CHARACTERS</span>
                    </div>
                    <textarea
                      id="premise"
                      value={premise}
                      onChange={(event) => { setPremise(event.target.value); if (error) setError(""); }}
                      placeholder="A priceless artefact vanishes from a locked mansion during a thunderstorm. Three guests were inside, and nobody admits to seeing anything..."
                      minLength={20}
                      maxLength={600}
                      required
                      disabled={isGenerating}
                    />
                    <div className="textarea-footer">
                      <button type="button" className="sample-button" onClick={handleSamplePremise} disabled={isGenerating}>
                        <Lightbulb size={14} /> Generate a premise idea
                      </button>
                      <span className={premise.length > 600 ? "count-error" : ""}>{premise.length}/600</span>
                    </div>

                    <div className="form-divider" />

                    <div className="field-heading difficulty-heading">
                      <label>Choose your difficulty</label>
                      <span>YOUR CHALLENGE</span>
                    </div>
                    <div className="difficulty-grid">
                      {difficultyOptions.map((option) => {
                        const Icon = option.icon;
                        const selected = difficulty === option.name;
                        return (
                          <button
                            key={option.name}
                            type="button"
                            className={`difficulty-card ${selected ? "selected" : ""}`}
                            aria-pressed={selected}
                            onClick={() => setDifficulty(option.name)}
                            disabled={isGenerating}
                          >
                            <div className="difficulty-card-top">
                              <span className="difficulty-icon"><Icon size={19} /></span>
                              <span className="selection-circle">{selected && <Check size={12} />}</span>
                            </div>
                            <strong>{option.name}</strong>
                            <span className="difficulty-description">{option.description}</span>
                            <span className="difficulty-counts">
                              <span>{option.suspects} suspects</span>
                              <span>{option.clues} evidence items</span>
                              <span>{option.hints} hints · up to {option.score} pts</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <button
                      className="generate-button"
                      type="submit"
                      disabled={isGenerating || premise.trim().length < 20 || premise.length > 600}
                    >
                      {isGenerating ? <LoaderCircle className="spin" size={19} /> : <Sparkles size={18} />}
                      <span>{isGenerating ? "Building your case..." : "Generate investigation"}</span>
                      {!isGenerating && <ArrowRight size={17} />}
                    </button>
                    <p className="generation-note"><LockKeyhole size={12} /> The solution remains concealed until you make your accusation.</p>
                  </form>
                </section>

                <aside className="right-rail">
                  <div className="briefing-card">
                    <div className="briefing-heading"><span className="briefing-icon"><Activity size={17} /></span> CASE BRIEFING</div>
                    <h3>Choose your level of challenge.</h3>
                    <p className="briefing-description">Difficulty determines the number of people, evidence items, and hints in your case.</p>
                    <div className="selected-difficulty">
                      <span className="mini-label">SELECTED DIFFICULTY</span>
                      <strong>{difficulty}</strong>
                      <span>{selectedDifficulty.detail}</span>
                    </div>
                    <div className="briefing-stats">
                      <div><UserRound size={16} /><span>Suspects</span><strong>{selectedDifficulty.suspects}</strong></div>
                      <div><FileSearch size={16} /><span>Evidence items</span><strong>{selectedDifficulty.clues}</strong></div>
                      <div><Lightbulb size={16} /><span>Available hints</span><strong>{selectedDifficulty.hints}</strong></div>
                    </div>
                  </div>

                  <div className="how-card">
                    <div className="how-heading"><span className="mini-label">THE INVESTIGATION</span><span className="process-number">01—03</span></div>
                    <div className="process-step"><span className="process-number-icon"><WandSparkles size={16} /></span><div><strong>Build the case</strong><p>AI creates a story, suspects, and evidence.</p></div></div>
                    <div className="process-line" />
                    <div className="process-step"><span className="process-number-icon"><Search size={16} /></span><div><strong>Investigate</strong><p>Discover clues and test each alibi.</p></div></div>
                    <div className="process-line" />
                    <div className="process-step"><span className="process-number-icon"><BadgeCheck size={16} /></span><div><strong>Deliver your verdict</strong><p>Accuse the culprit and reveal the truth.</p></div></div>
                  </div>

                  <div className="integrity-card">
                    <ShieldCheck size={18} />
                    <div><strong>Fair-play investigation</strong><p>The culprit and private solution are not shown in the active case view.</p></div>
                  </div>
                </aside>
              </div>
            </>
          ) : (
            <section className="case-results" id="generated-case">
              <div className="result-header">
                <div>
                  <span className="section-index">02 / INVESTIGATION DESK</span>
                  <h2>Your case, detective.</h2>
                  <p>Review the briefing, inspect the evidence, and decide who is responsible.</p>
                </div>
                <button className="new-case-button" onClick={handleStartNew}><Plus size={15} /> New case</button>
              </div>

              <section className="case-banner">
                <div className="case-banner-top">
                  <span className="case-overline"><span className="online-dot" /> {isCaseCompleted ? "CASE CLOSED" : "ACTIVE INVESTIGATION"}</span>
                  <span className={`difficulty-pill ${generatedCase.difficulty?.toLowerCase() || "medium"}`}>{generatedCase.difficulty || "Medium"} difficulty</span>
                </div>
                <h1>{generatedCase.title}</h1>
                <p className="case-premise">{generatedCase.premise}</p>
                {generatedCase.story && <p className="case-story">{generatedCase.story}</p>}
                <div className="case-meta">
                  <div><span>CASE REFERENCE</span><button className="case-id-copy" onClick={handleCopyCaseId}><code>{generatedCase.caseId}</code><Copy size={13} />{copied ? "Copied" : ""}</button></div>
                  <div><span>OPENED</span><strong>{formatDate(generatedCase.createdAt)}</strong></div>
                  <div><span>CASE SCORE</span><strong>{generatedCase.score ?? 0} PTS</strong></div>
                </div>
              </section>

              <div className="investigation-stats">
                <div className="stat-card"><span className="stat-icon"><UserRound size={18} /></span><div><strong>{generatedCase.suspects?.length || 0}</strong><span>Suspects</span></div></div>
                <div className="stat-card"><span className="stat-icon"><Search size={18} /></span><div><strong>{discoveredCount}/{totalClues}</strong><span>Evidence found</span></div></div>
                <div className="stat-card"><span className="stat-icon"><Lightbulb size={18} /></span><div><strong>{remainingHints}</strong><span>Hints remaining</span></div></div>
                <div className="stat-card"><span className="stat-icon"><Clock3 size={18} /></span><div><strong>{isCaseCompleted ? "Closed" : "Active"}</strong><span>Case status</span></div></div>
              </div>

              <div className="case-workspace-grid">
                <section className="workspace-panel suspects-panel">
                  <div className="panel-heading">
                    <div><span className="panel-kicker">PEOPLE OF INTEREST</span><h3>Meet the suspects</h3></div>
                    <span className="panel-count">{generatedCase.suspects?.length || 0} PERSONS</span>
                  </div>
                  <div className="suspect-list">
                    {(generatedCase.suspects || []).map((suspect, index) => (
                      <article className="suspect-card" key={suspect.suspectId}>
                        <div className="suspect-top">
                          <span className="suspect-avatar"><UserRound size={19} /></span>
                          <div className="suspect-identity"><span>SUSPECT {String(index + 1).padStart(2, "0")}</span><h4>{suspect.name}</h4><p>{suspect.role}</p></div>
                          <span className="suspect-code">{suspect.suspectId}</span>
                        </div>
                        <p className="suspect-description">{suspect.description}</p>
                        <div className="suspect-detail"><span>MOTIVE</span><p>{suspect.motive}</p></div>
                        <div className="suspect-detail"><span>ALIBI</span><p>{suspect.alibi}</p></div>
                      </article>
                    ))}
                  </div>
                </section>

                <section className="workspace-panel evidence-panel">
                  <div className="panel-heading">
                    <div><span className="panel-kicker">THE EVIDENCE BOARD</span><h3>Investigate the clues</h3></div>
                    <span className="panel-count">{discoveredCount}/{totalClues} FOUND</span>
                  </div>
                  <div className="evidence-progress"><span style={{ width: `${totalClues ? (discoveredCount / totalClues) * 100 : 0}%` }} /></div>
                  <div className="clue-list">
                    {(generatedCase.clues || []).map((clue, index) => {
                      const busy = busyAction === `clue:${clue.clueId}`;
                      return (
                        <article className={`clue-card ${clue.discovered ? "discovered" : "undiscovered"}`} key={clue.clueId}>
                          <div className="clue-number">{String(index + 1).padStart(2, "0")}</div>
                          <div className="clue-content">
                            <div className="clue-topline"><span>{clue.type || "EVIDENCE"}</span>{clue.discovered && <span className="found-label"><Check size={12} /> DISCOVERED</span>}</div>
                            <h4>{clue.title}</h4>
                            <p className="clue-location">{clue.location}</p>
                            {clue.discovered ? (
                              <p className="clue-description">{clue.description}</p>
                            ) : (
                              <button
                                className="clue-action"
                                onClick={() => handleDiscoverClue(clue)}
                                disabled={!!busyAction || isCaseCompleted}
                              >
                                {busy ? <LoaderCircle className="spin" size={14} /> : <Search size={14} />}
                                {busy ? "Examining evidence..." : "Examine evidence"}
                              </button>
                            )}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="gameplay-tools">
                <section className="workspace-panel gameplay-panel">
                  <div className="panel-heading">
                    <div><span className="panel-kicker">DETECTIVE'S NOTEBOOK</span><h3>Request a hint</h3></div>
                    <span className="gameplay-panel-icon"><Lightbulb size={18} /></span>
                  </div>
                  <p className="gameplay-description">Need a nudge? Reveal one hint at a time. Use them carefully; each one brings you closer to the truth.</p>
                  <div className="hint-progress"><span>HINTS USED</span><strong>{usedHints} / {totalHints}</strong></div>
                  <div className="hint-progress-track"><span className="hint-progress-fill" style={{ width: `${totalHints ? (usedHints / totalHints) * 100 : 0}%` }} /></div>
                  <button className="secondary-action-button" onClick={handleUseHint} disabled={!!busyAction || remainingHints <= 0 || isCaseCompleted}>
                    {busyAction === "hint" ? <LoaderCircle className="spin" size={15} /> : <Lightbulb size={15} />}
                    {busyAction === "hint" ? "Finding a hint..." : remainingHints > 0 ? "Reveal next hint" : "No hints remaining"}
                  </button>
                  {revealedHints.length > 0 ? (
                    <div className="revealed-hints">
                      {revealedHints.map((hint, index) => (
                        <article className="revealed-hint" key={hint.hintId || `${index}-${hint.text}`}>
                          <div className="revealed-hint-heading"><span>FIELD NOTE {String(index + 1).padStart(2, "0")}</span><BadgeCheck size={14} /></div>
                          <p>{hint.text || hint.description || hint.content}</p>
                        </article>
                      ))}
                    </div>
                  ) : <p className="empty-hints">Your notes are empty. Hints will appear here.</p>}
                </section>

                <section className="workspace-panel gameplay-panel accusation-panel">
                  <div className="panel-heading">
                    <div><span className="panel-kicker">FINAL DECISION</span><h3>Make your accusation</h3></div>
                    <span className="gameplay-panel-icon"><BadgeCheck size={18} /></span>
                  </div>
                  <p className="gameplay-description">Weigh the motives against the evidence. When you're certain, select the person you believe is responsible.</p>
                  <form onSubmit={handleAccusation}>
                    <label className="accusation-label" htmlFor="suspect-select">WHO COMMITTED THE CRIME?</label>
                    <select
                      id="suspect-select"
                      value={selectedSuspectId}
                      onChange={(event) => setSelectedSuspectId(event.target.value)}
                      disabled={isCaseCompleted || !!finalResult || !!busyAction}
                    >
                      <option value="">Select a suspect...</option>
                      {(generatedCase.suspects || []).map((suspect) => (
                        <option key={suspect.suspectId} value={suspect.suspectId}>{suspect.name} — {suspect.suspectId}</option>
                      ))}
                    </select>
                    <button className="accusation-button" type="submit" disabled={isCaseCompleted || !!finalResult || !!busyAction || !selectedSuspectId}>
                      {busyAction === "accusation" ? <LoaderCircle className="spin" size={15} /> : <ShieldCheck size={15} />}
                      {busyAction === "accusation" ? "Reviewing your verdict..." : isCaseCompleted ? "Investigation closed" : "Submit final accusation"}
                    </button>
                  </form>
                  <p className="accusation-warning"><LockKeyhole size={12} /> Your accusation cannot be changed after submission.</p>
                </section>
              </div>

              {finalResult && (
                <section className="final-result workspace-panel" id="final-result">
                  <div className="final-result-heading">
                    <span className="final-result-icon">{finalResult.isCorrect ? <Trophy size={23} /> : <XCircle size={23} />}</span>
                    <div><span className="panel-kicker">INVESTIGATION COMPLETE</span><h3>{finalResult.isCorrect ? "Excellent detective work." : "The case has been closed."}</h3></div>
                  </div>
                  <div className="final-score"><span>FINAL SCORE</span><strong>{finalResult.score ?? generatedCase.score ?? 0} PTS</strong></div>
                  <div className="culprit-reveal"><span className="mini-label">THE CULPRIT WAS</span><h2>{finalResult.culpritName}</h2><span>{finalResult.culpritSuspectId}</span></div>
                  <div className="solution-section"><h4>What really happened?</h4><p>{finalResult.explanation}</p></div>
                  <div className="solution-section"><h4>Evidence and reasoning</h4><p>{finalResult.reasoning}</p></div>
                  <div className="supporting-evidence">
                    <span className="mini-label">SUPPORTING EVIDENCE</span>
                    <div className="supporting-clue-list">
                      {(finalResult.supportingClueIds || []).map((clueId) => {
                        const clue = generatedCase.clues?.find((item) => item.clueId === clueId);
                        return <span key={clueId}><Check size={13} />{clue?.title || clueId}</span>;
                      })}
                    </div>
                  </div>
                  <div className="completed-footer"><ShieldCheck size={17} /> This case is complete. Its solution is saved with the investigation.</div>
                </section>
              )}
            </section>
          )}

          <footer className="page-footer">
            <span>CASEFILE © 2026</span>
            <span>BUILT FOR THE CURIOUS. DESIGNED FOR THE DETAIL-ORIENTED.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}

export default App;
