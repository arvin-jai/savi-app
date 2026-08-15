/**
 * Savi tab — Ask Savi (v0.4 / M10).
 *
 * The tab keeps its v0.1 behaviour as the floor: when Ask Savi is switched off
 * (AI-BOUNDARY §4), or before the first question, the deterministic InsightCard
 * is still here. Turning the assistant off costs the user the conversation, not
 * the intelligence — `computeInsight()` is arithmetic over their own data and
 * never leaves the device.
 */

import { useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AmbientBackground } from '@/components/AmbientBackground';
import { InsightCard } from '@/components/domain/InsightCard';
import { EmptyState } from '@/components/ui/feedback';
import { Text } from '@/components/ui/Text';
import { AskSavi } from '@/features/ai/AskSavi';
import { useAiPreferences } from '@/features/ai/api';
import { useInsight } from '@/features/insights/api';
import { layout, space } from '@/theme/tokens';

export default function SaviTab() {
  const { insight, isLoading: insightLoading } = useInsight();
  const { data: prefs, isLoading: prefsLoading } = useAiPreferences();

  const [conversationId, setConversationId] = useState<string | null>(null);

  // Fail closed while we do not yet know: never render an input that would send
  // a question before we have established the user allows it.
  const askEnabled = !prefsLoading && prefs?.enabled === true;

  const insightHeader =
    !insightLoading && insight ? <InsightCard insight={insight} /> : null;

  return (
    <View style={{ flex: 1 }}>
      <AmbientBackground />
      <SafeAreaView
        style={{ flex: 1, paddingHorizontal: layout.pagePaddingMobile, gap: space[4] }}
        edges={['top']}
      >
        <View>
          <Text variant="h1">Ask Savi ✨</Text>
          <Text variant="bodySm" tone="secondary">
            Your personal money &amp; life assistant
          </Text>
        </View>

        {askEnabled ? (
          <AskSavi
            conversationId={conversationId}
            onConversationStarted={setConversationId}
            disclosed={prefs?.disclosed_at != null}
            header={insightHeader}
          />
        ) : (
          <View style={{ flex: 1, gap: space[4] }}>
            {insightHeader}
            {!prefsLoading && (
              <EmptyState
                title="Ask Savi is switched off"
                body="Savi is still watching your spending and bills and will speak up when there's something worth knowing. To ask questions directly, turn Ask Savi back on in Settings."
              />
            )}
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}
