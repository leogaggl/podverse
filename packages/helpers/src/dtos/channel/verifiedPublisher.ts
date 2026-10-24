/**
 * A publisher feed credited on a channel or item, after both feeds were checked to reference
 * each other. `medium_id` decides how it is shown and linked (`getChannelRouteKind`).
 */
export interface DTOVerifiedPublisher {
  id_text: string;
  title: string | null;
  medium_id: number;
}
