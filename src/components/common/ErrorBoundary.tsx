import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './States';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  /** Changing this value resets the boundary (e.g. the current route). */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Plano UI error', error, info.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return this.props.fallback ? (
        this.props.fallback(this.state.error, this.reset)
      ) : (
        <ErrorState
          title="This part of Plano crashed"
          message="Your data is safe. Try again, or reload the app if the problem persists."
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
