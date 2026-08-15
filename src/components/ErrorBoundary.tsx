/**
 * The last line of defence before a white screen (v1.0).
 *
 * Shows something calm and recoverable instead of a blank app (D§58), and is
 * the single place a crash reporter is wired in.
 *
 * The redaction that makes reporting safe lives in `lib/crashReport.ts` — pure
 * and unit-tested, because "crash reports never include financial data" is a
 * promise in PRIVACY.md and a promise needs a gate, not a comment.
 */

import { Component, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { reportCrash } from '@/lib/crashReport';
import { space } from '@/theme/tokens';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    reportCrash(error, info.componentStack ?? null);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      // No glass, no ambient background, no theme hooks: this renders when
      // something has already gone wrong, so it depends on as little as
      // possible. A fallback that can itself crash is not a fallback.
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space[6],
          gap: space[3],
          backgroundColor: '#0B0B12',
        }}
      >
        <Text variant="h2" style={{ color: '#F8FAFC' }}>
          Something went wrong
        </Text>
        <Text variant="body" style={{ color: '#A1A1AA' }}>
          Savi hit a problem and stopped. Your data is safe — nothing was changed.
        </Text>
        <Button label="Try again" onPress={this.reset} />
      </View>
    );
  }
}
