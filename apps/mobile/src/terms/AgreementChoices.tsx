import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { getCopyMarkdownDetails, getCopyMarkdownIntro } from '@podverse/helpers';

import { CopyMarkdown } from '../components/content/CopyMarkdown';
import { FormActions } from '../components/form/FormActions';
import { Accordion } from '../components/primitives/Accordion';
import { CheckboxRow } from '../components/primitives/CheckboxMark';
import { LoadingSection } from '../components/state/LoadingSection';
import { RetryableError } from '../components/state/RetryableError';
import { formActionsTopGap, proseDisclosureGap } from '../theme/screenLayout';
import { typography } from '../theme/typography';
import { useTheme } from '../theme/useTheme';

type AgreementChoicesProps = {
  acceptLabel: string;
  acceptTestID: string;
  accordionTestID: string;
  accordionTitle: string;
  checkboxChecked?: boolean;
  checkboxLabel?: string;
  checkboxTestID?: string;
  dateLabel: string | null;
  errorKey: string | null;
  fullMarkdown: string | null;
  isLoading: boolean;
  onAccept: () => void;
  onCheckboxChange?: (checked: boolean) => void;
  onReject: () => void;
  onRetry: () => void;
  rejectLabel: string;
  rejectTestID: string;
  requireCheckbox?: boolean;
  version: string | null;
};

export function AgreementChoices({
  acceptLabel,
  acceptTestID,
  accordionTestID,
  accordionTitle,
  checkboxChecked = false,
  checkboxLabel,
  checkboxTestID,
  dateLabel,
  errorKey,
  fullMarkdown,
  isLoading,
  onAccept,
  onCheckboxChange,
  onReject,
  onRetry,
  rejectLabel,
  rejectTestID,
  requireCheckbox = false,
  version,
}: AgreementChoicesProps) {
  const { styles: themeStyles, tokens } = useTheme();
  const intro = fullMarkdown === null ? null : getCopyMarkdownIntro(fullMarkdown);
  const details = fullMarkdown === null ? '' : getCopyMarkdownDetails(fullMarkdown);
  const canAccept =
    intro !== null && !isLoading && errorKey === null && version !== null && version !== '';
  const acceptDisabled = !canAccept || (requireCheckbox && !checkboxChecked);
  const showAccordion = canAccept && details !== '';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        accordion: {
          marginTop: proseDisclosureGap(tokens.spacing),
        },
        actions: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        body: {
          gap: tokens.spacing.md,
        },
        checkbox: {
          marginTop: formActionsTopGap(tokens.spacing),
        },
        date: {
          ...typography.prose,
          color: themeStyles.textSecondary.color,
        },
      }),
    [themeStyles, tokens]
  );

  return (
    <View>
      <View style={styles.body}>
        {isLoading ? <LoadingSection testID="agreement-loading" /> : null}
        {!isLoading && errorKey !== null ? (
          <RetryableError errorKey={errorKey} onRetry={onRetry} testID="agreement-error" />
        ) : null}
        {canAccept && intro !== null ? <CopyMarkdown markdown={intro} /> : null}
        {dateLabel !== null && !showAccordion ? (
          <Text style={styles.date}>{dateLabel}</Text>
        ) : null}
      </View>
      {showAccordion ? (
        <View style={styles.accordion}>
          <Accordion
            subtitle={dateLabel ?? undefined}
            testID={accordionTestID}
            title={accordionTitle}
          >
            <CopyMarkdown markdown={details} />
          </Accordion>
        </View>
      ) : null}
      {requireCheckbox && checkboxLabel !== undefined && onCheckboxChange !== undefined ? (
        <CheckboxRow
          checked={checkboxChecked}
          label={checkboxLabel}
          onPress={() => {
            onCheckboxChange(!checkboxChecked);
          }}
          style={styles.checkbox}
          testID={checkboxTestID}
        />
      ) : null}
      <FormActions
        actions={[
          {
            disabled: isLoading,
            label: rejectLabel,
            onPress: onReject,
            testID: rejectTestID,
            variant: 'secondary',
          },
          {
            disabled: acceptDisabled,
            label: acceptLabel,
            onPress: onAccept,
            testID: acceptTestID,
          },
        ]}
        style={styles.actions}
      />
    </View>
  );
}
