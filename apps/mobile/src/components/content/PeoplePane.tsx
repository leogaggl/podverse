import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { screenBodyInsets } from '../../theme/screenLayout';
import { useTheme } from '../../theme/useTheme';
import { FillList } from '../primitives';
import { LoadingSection } from '../state/LoadingSection';
import type { AboutPerson } from './aboutPerson';
import { AboutPersonRow } from './AboutPersonRow';

export type PeoplePaneProps = {
  isLoading?: boolean;
  /** `inline` paints in a parent list footer. `fill` owns the section scroll. */
  layout?: 'fill' | 'inline';
  listHeader?: ReactNode;
  people: readonly AboutPerson[];
  testIDPrefix: string;
};

/**
 * People chip body. Callers pass the person array that belongs to this channel or item.
 */
export function PeoplePane({
  isLoading = false,
  layout = 'fill',
  listHeader,
  people,
  testIDPrefix,
}: PeoplePaneProps) {
  const { t } = useTranslation();
  const { styles: themeStyles, tokens } = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: {
          paddingBottom: tokens.spacing['2xl'],
          paddingHorizontal: screenBodyInsets(tokens.spacing).paddingHorizontal,
        },
        inline: {
          gap: tokens.spacing.xs,
        },
        list: {
          backgroundColor: themeStyles.screen.backgroundColor,
          flex: 1,
        },
      }),
    [themeStyles, tokens]
  );

  if (layout === 'inline') {
    if (isLoading && people.length === 0) {
      return <LoadingSection testID={`${testIDPrefix}-people-loading`} />;
    }
    if (people.length === 0) {
      return null;
    }
    return (
      <View style={styles.inline} testID={`${testIDPrefix}-people`}>
        {people.map((person) => (
          <AboutPersonRow
            key={person.id}
            person={person}
            testID={`${testIDPrefix}-person-${person.id}`}
          />
        ))}
      </View>
    );
  }

  return (
    <FillList
      ListEmptyComponent={
        isLoading ? <LoadingSection testID={`${testIDPrefix}-people-loading`} /> : null
      }
      ListHeaderComponent={
        listHeader !== null && listHeader !== undefined ? <>{listHeader}</> : null
      }
      accessibilityLabel={t('info.people.people')}
      contentContainerStyle={styles.content}
      data={isLoading ? [] : [...people]}
      keyExtractor={(person) => String(person.id)}
      renderItem={({ item: person }) => (
        <AboutPersonRow person={person} testID={`${testIDPrefix}-person-${person.id}`} />
      )}
      style={styles.list}
      testID={`${testIDPrefix}-people`}
    />
  );
}
