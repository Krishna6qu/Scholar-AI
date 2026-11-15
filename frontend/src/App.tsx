import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThreeDBackground from "@/components/ThreeDBackground";
import FocusTimer from "@/components/FocusTimer";
import ProtectedRoute from "@/components/ProtectedRoute";

const HomePage = lazy(() => import("@/pages/HomePage"));
const VerifyOtpPage = lazy(() => import("@/pages/VerifyOtpPage"));
const LoginPage = lazy(() => import("@/pages/LoginPage"));
const RegisterPage = lazy(() => import("@/pages/RegisterPage"));
const DashboardPage = lazy(() => import("@/pages/DashboardPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
const StudyPackPage = lazy(() => import("@/pages/StudyPackPage"));
const QuizWizardPage = lazy(() => import("@/pages/QuizWizardPage"));
const QuizTakePage = lazy(() => import("@/pages/QuizTakePage"));
const FlashcardWizardPage = lazy(() => import("@/pages/FlashcardWizardPage"));
const FlashcardViewPage = lazy(() => import("@/pages/FlashcardViewPage"));
const NoteWizardPage = lazy(() => import("@/pages/NoteWizardPage"));
const NoteViewPage = lazy(() => import("@/pages/NoteViewPage"));
const MindMapWizardPage = lazy(() => import("@/pages/MindMapWizardPage"));
const MindMapViewPage = lazy(() => import("@/pages/MindMapViewPage"));
const RoadmapWizardPage = lazy(() => import("@/pages/RoadmapWizardPage"));
const RoadmapViewPage = lazy(() => import("@/pages/RoadmapViewPage"));

function PageLoader() {
  return (
    <div className="min-h-screen bg-void-950 flex items-center justify-center text-void-300">
      Loading…
    </div>
  );
}

function AppBackground() {
  const location = useLocation();
  const isDashboard = location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/settings");
  return <ThreeDBackground variant={isDashboard ? "dashboard" : "default"} />;
}

export default function App() {
  useEffect(() => {
    if (localStorage.getItem("scholarai_reduced_motion") === "true") {
      document.documentElement.setAttribute("data-reduced-motion", "true");
    }
  }, []);
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AppBackground />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/verify-otp" element={<VerifyOtpPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
            <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            <Route path="/study" element={<ProtectedRoute><StudyPackPage /></ProtectedRoute>} />
            <Route path="/study/quiz" element={<ProtectedRoute><QuizWizardPage /></ProtectedRoute>} />
            <Route path="/study/quiz/:quizId" element={<ProtectedRoute><QuizTakePage /></ProtectedRoute>} />
            <Route path="/study/flashcards/new" element={<ProtectedRoute><FlashcardWizardPage /></ProtectedRoute>} />
            <Route path="/study/flashcards/:flashcardId" element={<ProtectedRoute><FlashcardViewPage /></ProtectedRoute>} />
            <Route path="/study/notes/new" element={<ProtectedRoute><NoteWizardPage /></ProtectedRoute>} />
            <Route path="/study/notes/:noteId" element={<ProtectedRoute><NoteViewPage /></ProtectedRoute>} />
            <Route path="/study/mindmap/new" element={<ProtectedRoute><MindMapWizardPage /></ProtectedRoute>} />
            <Route path="/study/mindmap/:mapId" element={<ProtectedRoute><MindMapViewPage /></ProtectedRoute>} />
            <Route path="/roadmap/new" element={<ProtectedRoute><RoadmapWizardPage /></ProtectedRoute>} />
            <Route path="/roadmap/:roadmapId" element={<ProtectedRoute><RoadmapViewPage /></ProtectedRoute>} />
          </Routes>
        </Suspense>
        <FocusTimer />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
