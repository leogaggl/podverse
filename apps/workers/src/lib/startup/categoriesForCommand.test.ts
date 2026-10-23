import { describe, expect, it } from 'vitest';

import {
  CATEGORY_BASE,
  CATEGORY_BILLING,
  CATEGORY_MQ,
  CATEGORY_ORM,
  CATEGORY_PARSER,
  CATEGORY_PODCAST_INDEX,
  CATEGORY_WEB_NOTIFICATIONS,
  getCategoriesForCommand,
} from './categoriesForCommand.js';

function sortCategories(set: ReadonlySet<string>): string[] {
  return [...set].sort();
}

describe('getCategoriesForCommand', () => {
  it('maps scheduledJobsRunDue to full parser stack categories', () => {
    expect(sortCategories(getCategoriesForCommand('scheduledJobsRunDue'))).toEqual(
      sortCategories(
        new Set([
          CATEGORY_BASE,
          CATEGORY_ORM,
          CATEGORY_MQ,
          CATEGORY_PARSER,
          CATEGORY_PODCAST_INDEX,
          CATEGORY_WEB_NOTIFICATIONS,
        ])
      )
    );
  });

  it('maps ormDescriptionsBackfill to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('ormDescriptionsBackfill'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps ormArchivedSlimReport to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('ormArchivedSlimReport'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps billingReconcile to Base, ORM, and Billing', () => {
    expect(sortCategories(getCategoriesForCommand('billingReconcile'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM, CATEGORY_BILLING]))
    );
  });

  it('maps billingStrikeEnsureWebhook to Base, ORM, and Billing', () => {
    expect(sortCategories(getCategoriesForCommand('billingStrikeEnsureWebhook'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM, CATEGORY_BILLING]))
    );
  });

  it('maps billingImportLegacyMembershipExpiry to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('billingImportLegacyMembershipExpiry'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps billingProcessorProductAdd to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('billingProcessorProductAdd'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps billingCheckoutChannelEnable to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('billingCheckoutChannelEnable'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps accountContentLogPurge to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('accountContentLogPurge'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps statsEventPartitionsMaintain to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('statsEventPartitionsMaintain'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps statsPopularityRefresh to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('statsPopularityRefresh'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps archiveAll to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('archiveAll'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps devStatsSeedSimulatedPopularity to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('devStatsSeedSimulatedPopularity'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps devSeedLocalUserContent to Base and ORM', () => {
    expect(sortCategories(getCategoriesForCommand('devSeedLocalUserContent'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM]))
    );
  });

  it('maps podcastIndexDeadFeedsFlagAndMerge to Base, ORM, and Podcast Index', () => {
    expect(sortCategories(getCategoriesForCommand('podcastIndexDeadFeedsFlagAndMerge'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_ORM, CATEGORY_PODCAST_INDEX]))
    );
  });

  it('maps mqRSSRunParser to full parser stack categories', () => {
    expect(sortCategories(getCategoriesForCommand('mqRSSRunParser'))).toEqual(
      sortCategories(
        new Set([
          CATEGORY_BASE,
          CATEGORY_ORM,
          CATEGORY_MQ,
          CATEGORY_PARSER,
          CATEGORY_PODCAST_INDEX,
          CATEGORY_WEB_NOTIFICATIONS,
        ])
      )
    );
  });

  it('maps devParserRSSParsePodcasting20Feeds to full parser stack categories', () => {
    expect(sortCategories(getCategoriesForCommand('devParserRSSParsePodcasting20Feeds'))).toEqual(
      sortCategories(
        new Set([
          CATEGORY_BASE,
          CATEGORY_ORM,
          CATEGORY_MQ,
          CATEGORY_PARSER,
          CATEGORY_PODCAST_INDEX,
          CATEGORY_WEB_NOTIFICATIONS,
        ])
      )
    );
  });

  it('maps devParserRSSParseMusicMediumFeeds to full parser stack categories', () => {
    expect(sortCategories(getCategoriesForCommand('devParserRSSParseMusicMediumFeeds'))).toEqual(
      sortCategories(
        new Set([
          CATEGORY_BASE,
          CATEGORY_ORM,
          CATEGORY_MQ,
          CATEGORY_PARSER,
          CATEGORY_PODCAST_INDEX,
          CATEGORY_WEB_NOTIFICATIONS,
        ])
      )
    );
  });

  it('maps devParserRSSParseArtistPublisherFeeds to full parser stack categories', () => {
    expect(
      sortCategories(getCategoriesForCommand('devParserRSSParseArtistPublisherFeeds'))
    ).toEqual(
      sortCategories(
        new Set([
          CATEGORY_BASE,
          CATEGORY_ORM,
          CATEGORY_MQ,
          CATEGORY_PARSER,
          CATEGORY_PODCAST_INDEX,
          CATEGORY_WEB_NOTIFICATIONS,
        ])
      )
    );
  });

  it('maps devDiscoverArtistPublisherFeeds to Base and PodcastIndex', () => {
    expect(sortCategories(getCategoriesForCommand('devDiscoverArtistPublisherFeeds'))).toEqual(
      sortCategories(new Set([CATEGORY_BASE, CATEGORY_PODCAST_INDEX]))
    );
  });
});
