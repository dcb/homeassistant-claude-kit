import { Component, type ReactNode } from "react";
import { Icon } from "@iconify/react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** What to show in the error message (e.g. "Climate view") */
  label?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <Icon icon="mdi:alert-circle-outline" width={32} className="text-accent-red" />
          <p className="text-sm text-text-secondary">
            {this.props.label ? `${this.props.label} failed to load` : "Something went wrong"}
          </p>
          <button
            onClick={() => this.setState({ error: null })}
            className="rounded-full bg-white/10 px-4 py-2 text-xs font-medium text-text-primary hover:bg-white/15 active:bg-white/15"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
