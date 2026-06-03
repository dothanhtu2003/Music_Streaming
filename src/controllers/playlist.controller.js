const playlistService = require("../services/playlist.service");
const {
  getUploadedFile,
  getUploadedFileUrl,
  removeUploadedFiles,
} = require("../middlewares/upload.middleware");
const { successResponse } = require("../utils/apiResponse");

const createPlaylist = async (req, res, next) => {
  try {
    const playlist = await playlistService.createPlaylist(req.user.id, req.body);

    return successResponse(res, "Playlist created successfully", playlist, 201);
  } catch (error) {
    return next(error);
  }
};

const getMyPlaylists = async (req, res, next) => {
  try {
    const result = await playlistService.getMyPlaylists(req.user.id, req.query);

    return successResponse(res, "My playlists fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getPublicPlaylists = async (req, res, next) => {
  try {
    const result = await playlistService.getPublicPlaylists(req.query);

    return successResponse(res, "Public playlists fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getPlaylistDetail = async (req, res, next) => {
  try {
    const playlist = await playlistService.getPlaylistDetail(req.params.id, req.user);

    return successResponse(res, "Playlist fetched successfully", playlist);
  } catch (error) {
    return next(error);
  }
};

const updatePlaylist = async (req, res, next) => {
  try {
    const playlist = await playlistService.updatePlaylist(
      req.params.id,
      req.user.id,
      req.body
    );

    return successResponse(res, "Playlist updated successfully", playlist);
  } catch (error) {
    return next(error);
  }
};

const deletePlaylist = async (req, res, next) => {
  try {
    const playlist = await playlistService.deletePlaylist(req.params.id, req.user.id);

    return successResponse(res, "Playlist deleted successfully", playlist);
  } catch (error) {
    return next(error);
  }
};

const addSongToPlaylist = async (req, res, next) => {
  try {
    const result = await playlistService.addSongToPlaylist(
      req.params.id,
      req.user.id,
      req.body
    );
    const message = result.alreadyExists
      ? "Song is already in playlist"
      : "Song added to playlist successfully";

    return successResponse(res, message, result);
  } catch (error) {
    return next(error);
  }
};

const removeSongFromPlaylist = async (req, res, next) => {
  try {
    const result = req.params.songId
      ? await playlistService.removeSongFromPlaylist(
          req.params.id,
          req.user.id,
          req.params.songId
        )
      : await playlistService.removeSongFromPlaylistByBody(
          req.params.id,
          req.user.id,
          req.body
        );
    const message = result.wasInPlaylist
      ? "Song removed from playlist successfully"
      : "Song was not in playlist";

    return successResponse(res, message, result);
  } catch (error) {
    return next(error);
  }
};

const reorderPlaylistSongs = async (req, res, next) => {
  try {
    const playlist = await playlistService.reorderPlaylistSongs(
      req.params.id,
      req.user.id,
      req.body
    );

    return successResponse(res, "Playlist songs reordered successfully", playlist);
  } catch (error) {
    return next(error);
  }
};

const uploadTrackToPlaylist = async (req, res, next) => {
  const audioFile = getUploadedFile(req, "audio", ["audio_file"]);
  const coverFile = getUploadedFile(req, "cover", ["cover_image"]);
  const uploadedFiles = Object.values(req.files || {}).flat();

  try {
    const result = await playlistService.uploadTrackToPlaylist(
      req.params.id,
      req.user,
      {
        title: req.body.title,
        genre: req.body.genre,
        description: req.body.description,
        file_url: getUploadedFileUrl(audioFile) || "",
        cover_url: getUploadedFileUrl(coverFile),
      }
    );

    return successResponse(
      res,
      "Track uploaded and added to playlist successfully",
      result,
      201
    );
  } catch (error) {
    await removeUploadedFiles(uploadedFiles);
    return next(error);
  }
};

module.exports = {
  createPlaylist,
  getMyPlaylists,
  getPublicPlaylists,
  getPlaylistDetail,
  updatePlaylist,
  deletePlaylist,
  addSongToPlaylist,
  removeSongFromPlaylist,
  reorderPlaylistSongs,
  uploadTrackToPlaylist,
};
