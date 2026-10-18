import type { DTOChannel, RemoteItemsResponse } from '@podverse/helpers';
import { SideContent } from '@podverse/ui';

import { ContentAbout } from '../../../components/Content/About/ContentAbout';
import { ContentPeopleAccordion } from '../../../components/Content/About/ContentPeopleAccordion';
import { ContentPodroll } from '../../../components/Content/Podroll/ContentPodroll';

type PodcastPageSideContentProps = {
  channel: DTOChannel;
  podroll: RemoteItemsResponse | null;
};

export const PodcastPageSideContent = ({ channel, podroll }: PodcastPageSideContentProps) => {
  return (
    <SideContent>
      <ContentAbout
        description={channel.channel_description?.value}
        isAccordion={true}
        defaultOpen={true}
      />
      <ContentPeopleAccordion channel_persons={channel.channel_persons} defaultOpen={true} />
      <ContentPodroll remoteItemsResponse={podroll} isAccordion={true} defaultOpen={true} />
    </SideContent>
  );
};
