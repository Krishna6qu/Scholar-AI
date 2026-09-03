import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Uncaught render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-void-950 flex flex-col items-center justify-center px-6 text-center">
          <h1 className="text-xl text-white mb-2">Something went wrong</h1>
          <p className="text-void-300 text-sm mb-6 max-w-md">
            An unexpected error occurred. Try refreshing the page — if it keeps happening, log out and back in.
          </p>
          <button
            onClick={() => window.location.assign("/dashboard")}
            className="px-5 py-2 rounded-full bg-gradient-to-r from-neon-violet to-neon-cyan text-void-950 font-semibold text-sm"
          >
            Go to Dashboard
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
