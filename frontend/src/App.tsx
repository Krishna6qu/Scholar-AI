import { BrowserRouter, Routes, Route } from "react-router-dom";
import HomePage from "@/pages/HomePage";
import VerifyOtpPage from "@/pages/VerifyOtpPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import DashboardPage from "@/pages/DashboardPage";
import ChatPage from "@/pages/ChatPage";
import SettingsPage from "@/pages/SettingsPage";
import StudyPackPage from "@/pages/StudyPackPage";
import QuizWizardPage from "@/pages/QuizWizardPage";
import QuizTakePage from "@/pages/QuizTakePage";
import FlashcardWizardPage from "@/pages/FlashcardWizardPage";
import FlashcardViewPage from "@/pages/FlashcardViewPage";
import NoteWizardPage from "@/pages/NoteWizardPage";
import NoteViewPage from "@/pages/NoteViewPage";
import MindMapWizardPage from "@/pages/MindMapWizardPage";
import MindMapViewPage from "@/pages/MindMapViewPage";
import RoadmapWizardPage from "@/pages/RoadmapWizardPage";
import RoadmapViewPage from "@/pages/RoadmapViewPage";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function App() {
  return (
    <BrowserRouter>
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
    </BrowserRouter>
  );
}
