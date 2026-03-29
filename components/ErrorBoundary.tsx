import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: any;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: any): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = "An unexpected error occurred.";
      let errorDetails = null;

      try {
        // Check if it's our custom Firestore error
        const parsed = JSON.parse(this.state.error.message);
        if (parsed.error && parsed.operationType) {
          errorMessage = `Database Error: ${parsed.operationType} operation failed.`;
          errorDetails = parsed.error;
        }
      } catch (e) {
        errorMessage = this.state.error.message || errorMessage;
      }

      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
          <div className="w-20 h-20 bg-rose-500/20 text-rose-500 rounded-3xl flex items-center justify-center mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-4">Neural Link Interrupted</h1>
          <p className="text-slate-400 max-w-md mb-8 font-medium">{errorMessage}</p>
          {errorDetails && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 max-w-2xl w-full text-left overflow-auto">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Technical Logs</p>
              <code className="text-rose-400 text-xs break-all">{errorDetails}</code>
            </div>
          )}
          <button 
            onClick={() => window.location.reload()}
            className="px-8 py-4 bg-indigo-600 text-white text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-500/20"
          >
            Re-establish Link
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
