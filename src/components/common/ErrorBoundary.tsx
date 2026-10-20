import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ErrorState } from './States';
import { reportError } from '@/services/errors';

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
    reportError(error);
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
          title="Ця частина Plano дала збій"
          message="Ваші дані в безпеці. Спробуйте ще раз або перезавантажте застосунок, якщо проблема повториться."
          onRetry={this.reset}
        />
      );
    }
    return this.props.children;
  }
}
