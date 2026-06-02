/**
 * Resolves the user profile linked to an artist row.
 * Prefers artists.user_id; falls back to a username match on artists.name.
 */
const buildArtistLinkedUserJoin = (userAlias = "u") => `
  LEFT JOIN users ${userAlias} ON ${userAlias}.id = COALESCE(
    ar.user_id,
    (
      SELECT u2.id
      FROM users u2
      WHERE LOWER(u2.username) = LOWER(ar.name)
      LIMIT 1
    )
  )
`;

const artistLinkedUserJoin = buildArtistLinkedUserJoin("u");

module.exports = {
  artistLinkedUserJoin,
  buildArtistLinkedUserJoin,
};
