'use client';

import { useTranslations } from 'next-intl';
import React, { useRef, useState } from 'react';

import type { DTOAccount, DTOChannel, DTOPlaylist } from '@podverse/helpers';
import { Button } from '@podverse/ui';

import { useAccount } from '../../../contexts/Account';
import { useModals } from '../../../contexts/Modals';
import { getApiRequestService } from '../../../factories/apiRequestService';
import { useMembershipGate } from '../../../hooks/useMembershipGate';
import { followedDirectoryArtistAlbumIdTexts } from '../../../lib/artistUnsubscribe';
import { UnsubscribeArtistModal } from './UnsubscribeArtistModal';

import styles from '../../../styles/components/Common/Media/Header/SubscribeButton.module.scss';

type SubscribeButtonProps = {
  entity: DTOChannel | DTOPlaylist | DTOAccount;
  kind: 'podcast' | 'artist' | 'album' | 'playlist' | 'profile';
  onEdit?: () => void;
  artistAlbums?: readonly DTOChannel[];
};

export const SubscribeButton: React.FC<SubscribeButtonProps> = ({
  entity,
  kind,
  onEdit,
  artistAlbums,
}) => {
  const apiRequestService = getApiRequestService();
  const tFeatures = useTranslations('features');
  const tInstructions = useTranslations('instructions');
  const tMisc = useTranslations('misc');
  const { loggedInAccount, setLoggedInAccount } = useAccount();
  const { setModalLoginRequired } = useModals();
  const { tryHandleMembershipGateError } = useMembershipGate();
  const [artistPromptAlbumIdTexts, setArtistPromptAlbumIdTexts] = useState<string[] | null>(null);
  const [artistPromptBusy, setArtistPromptBusy] = useState<
    'artist_only' | 'artist_and_albums' | null
  >(null);
  const artistPromptInFlight = useRef(false);

  if (kind === 'podcast' || kind === 'artist' || kind === 'album') {
    const channel = entity as DTOChannel;
    const isSubscribed = loggedInAccount?.account_following_channels?.some(
      (account_following_channel) => account_following_channel.channel_id === channel.id
    );

    const toggleSubscribe = async () => {
      if (!loggedInAccount) {
        setModalLoginRequired({ title: null, message: tInstructions('login_to_subscribe') });
        return;
      }

      try {
        if (isSubscribed) {
          if (kind === 'artist') {
            const followedAlbumIdTexts = followedDirectoryArtistAlbumIdTexts({
              artistIdText: channel.id_text,
              albums: artistAlbums ?? [],
              followingChannelIds: new Set(
                loggedInAccount.account_following_channels?.map((row) => row.channel_id) ?? []
              ),
            });
            if (followedAlbumIdTexts.length > 0) {
              setArtistPromptAlbumIdTexts(followedAlbumIdTexts);
              return;
            }
          }
          const updatedAccount = await apiRequestService.reqAccountUnfollowChannel({
            channel_id_text: channel.id_text,
          });
          await setLoggedInAccount(updatedAccount);
        } else {
          const updatedAccount = await apiRequestService.reqAccountFollowChannel({
            channel_id_text: channel.id_text,
          });
          await setLoggedInAccount(updatedAccount);
        }
      } catch (error) {
        if (!tryHandleMembershipGateError(error)) {
          throw error;
        }
      }
    };

    const cancelArtistPrompt = () => {
      if (artistPromptInFlight.current) {
        return;
      }
      setArtistPromptAlbumIdTexts(null);
    };

    const runArtistUnsubscribe = async (action: 'artist_only' | 'artist_and_albums') => {
      if (artistPromptInFlight.current || artistPromptAlbumIdTexts === null) {
        return;
      }
      artistPromptInFlight.current = true;
      setArtistPromptBusy(action);
      try {
        const updatedAccount =
          action === 'artist_only'
            ? await apiRequestService.reqAccountUnfollowChannel({
                channel_id_text: channel.id_text,
              })
            : await apiRequestService.reqAccountUnfollowBulk({
                channel_id_texts: [channel.id_text, ...artistPromptAlbumIdTexts],
              });
        await setLoggedInAccount(updatedAccount);
      } catch (error) {
        if (!tryHandleMembershipGateError(error)) {
          throw error;
        }
      } finally {
        artistPromptInFlight.current = false;
        setArtistPromptBusy(null);
        setArtistPromptAlbumIdTexts(null);
      }
    };

    return (
      <>
        <Button className={styles.button} variant="miniGlow" onClick={toggleSubscribe}>
          {isSubscribed ? tFeatures('unsubscribe') : tFeatures('subscribe')}
        </Button>
        <UnsubscribeArtistModal
          isOpen={artistPromptAlbumIdTexts !== null}
          albumCount={artistPromptAlbumIdTexts?.length ?? 0}
          artistTitle={channel.title ?? ''}
          busyAction={artistPromptBusy}
          onCancel={cancelArtistPrompt}
          onArtistOnly={() => {
            void runArtistUnsubscribe('artist_only');
          }}
          onArtistAndAlbums={() => {
            void runArtistUnsubscribe('artist_and_albums');
          }}
        />
      </>
    );
  } else if (kind === 'playlist') {
    const playlist = entity as DTOPlaylist;
    const isOwner = loggedInAccount?.id_text === playlist?.account?.id_text;

    const isSubscribedPlaylist = loggedInAccount?.account_following_playlists?.some(
      (account_following_playlist) => account_following_playlist.playlist_id === playlist.id
    );

    const toggleSubscribePlaylist = async () => {
      if (!loggedInAccount) {
        setModalLoginRequired({ title: null, message: tInstructions('login_to_subscribe') });
        return;
      }

      try {
        if (isSubscribedPlaylist) {
          const updatedAccount = await apiRequestService.reqAccountUnfollowPlaylist({
            playlist_id_text: playlist.id_text,
          });
          await setLoggedInAccount(updatedAccount);
        } else {
          const updatedAccount = await apiRequestService.reqAccountFollowPlaylist({
            playlist_id_text: playlist.id_text,
          });
          await setLoggedInAccount(updatedAccount);
        }
      } catch (error) {
        if (!tryHandleMembershipGateError(error)) {
          throw error;
        }
      }
    };

    if (isOwner) {
      return (
        <Button className={styles.button} variant="miniGlowWarning" onClick={onEdit}>
          {tMisc('edit')}
        </Button>
      );
    }

    return (
      <Button className={styles.button} variant="miniGlow" onClick={toggleSubscribePlaylist}>
        {isSubscribedPlaylist ? tFeatures('unsubscribe') : tFeatures('subscribe')}
      </Button>
    );
  } else if (kind === 'profile') {
    const account = entity as DTOAccount;
    const isOwner = loggedInAccount?.id_text === account?.id_text;

    const isFollowingAccount = loggedInAccount?.account_following_accounts?.some(
      (account_following_account) => account_following_account.following_account_id === account.id
    );

    const toggleFollowAccount = async () => {
      if (!loggedInAccount) {
        setModalLoginRequired({ title: null, message: tInstructions('login_to_subscribe') });
        return;
      }

      try {
        if (isFollowingAccount) {
          const updatedAccount = await apiRequestService.reqAccountUnfollowAccount({
            following_account_id_text: account.id_text,
          });
          await setLoggedInAccount(updatedAccount);
        } else {
          const updatedAccount = await apiRequestService.reqAccountFollowAccount({
            following_account_id_text: account.id_text,
          });
          await setLoggedInAccount(updatedAccount);
        }
      } catch (error) {
        if (!tryHandleMembershipGateError(error)) {
          throw error;
        }
      }
    };

    if (isOwner) {
      return (
        <Button className={styles.button} variant="miniGlowWarning" onClick={onEdit}>
          {tMisc('edit')}
        </Button>
      );
    }

    return (
      <Button className={styles.button} variant="miniGlow" onClick={toggleFollowAccount}>
        {isFollowingAccount ? tFeatures('unsubscribe') : tFeatures('subscribe')}
      </Button>
    );
  }

  return null;
};
