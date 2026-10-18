import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CopyMarkdown } from '../../components/content/CopyMarkdown';
import { Accordion } from '../../components/primitives/Accordion';
import { MobileScreenContainer } from '../../components/screen/MobileScreenContainer';
import { LoadingSection } from '../../components/state/LoadingSection';
import { RetryableError } from '../../components/state/RetryableError';
import { useManagedCopy } from '../../hooks/useManagedCopy';
import { settingsCardGap } from '../../theme/screenLayout';
import { useTheme } from '../../theme/useTheme';
import { splitFaqLevel1Sections } from './faqSections';

export function MoreFaqScreen() {
  const { tokens } = useTheme();
  const { errorKey, isLoading, markdown, retry } = useManagedCopy({ slug: 'faq' });
  const split = useMemo(
    () => (markdown === null ? null : splitFaqLevel1Sections(markdown)),
    [markdown]
  );
  const styles = useMemo(
    () =>
      StyleSheet.create({
        sections: {
          gap: settingsCardGap(tokens.spacing),
        },
      }),
    [tokens]
  );
  const showCopy = !isLoading && errorKey === null && split !== null;

  return (
    <MobileScreenContainer scrollEnabled={!isLoading} testID="more-faq-screen">
      {isLoading ? <LoadingSection testID="more-faq-loading" /> : null}
      {!isLoading && (errorKey !== null || markdown === null) ? (
        <RetryableError
          errorKey={errorKey ?? 'errors.generic'}
          onRetry={retry}
          testID="more-faq-error"
        />
      ) : null}
      {showCopy && split !== null ? (
        <View style={styles.sections}>
          {split.preamble !== '' ? <CopyMarkdown markdown={split.preamble} /> : null}
          {split.sections.map((section, index) => (
            <Accordion
              key={`${section.title}-${index}`}
              testID={`more-faq-section-${index}`}
              title={section.title}
            >
              {section.body !== '' ? <CopyMarkdown markdown={section.body} /> : null}
            </Accordion>
          ))}
        </View>
      ) : null}
    </MobileScreenContainer>
  );
}
