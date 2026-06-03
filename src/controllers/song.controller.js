const songService = require("../services/song.service");
const {
  getUploadedFile,
  getUploadedFileUrl,
  removeUploadedFiles,
} = require("../middlewares/upload.middleware");
const { successResponse } = require("../utils/apiResponse");

const getSongs = async (req, res, next) => {
  try {
    const result = await songService.getSongs(req.query);

    return successResponse(res, "Songs fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getMySongs = async (req, res, next) => {
  try {
    const result = await songService.getSongsByUser(req.user, req.query);

    return successResponse(res, "My songs fetched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const searchSongs = async (req, res, next) => {
  try {
    const result = await songService.searchSongs(req.query);

    return successResponse(res, "Songs searched successfully", result.items, 200, {
      pagination: result.pagination,
    });
  } catch (error) {
    return next(error);
  }
};

const getSongById = async (req, res, next) => {
  try {
    const song = await songService.getSongById(req.params.id);

    return successResponse(res, "Song fetched successfully", song);
  } catch (error) {
    return next(error);
  }
};

const getSongWaveform = async (req, res, next) => {
  try {
    const waveform = await songService.getSongWaveform(req.params.id);

    return successResponse(res, "Song waveform fetched successfully", waveform);
  } catch (error) {
    return next(error);
  }
};

const saveSongWaveform = async (req, res, next) => {
  try {
    const waveform = await songService.saveSongWaveform(req.params.id, req.body);

    return successResponse(res, "Song waveform cached successfully", waveform);
  } catch (error) {
    return next(error);
  }
};

const createSong = async (req, res, next) => {
  try {
    const song = await songService.createSong(req.body);

    return successResponse(res, "Song created successfully", song, 201);
  } catch (error) {
    return next(error);
  }
};

const uploadSong = async (req, res, next) => {
  const audioFile = getUploadedFile(req, "audio", ["audio_file"]);
  const coverFile = getUploadedFile(req, "cover", ["cover_image"]);
  const uploadedFiles = Object.values(req.files || {}).flat();

  try {
    const song = await songService.createUploadedSong(
      {
        title: req.body.title,
        genre: req.body.genre,
        description: req.body.description,
        file_url: getUploadedFileUrl(audioFile) || "",
        cover_url: getUploadedFileUrl(coverFile),
      },
      req.user
    );

    return successResponse(res, "Song uploaded successfully", song, 201);
  } catch (error) {
    await removeUploadedFiles(uploadedFiles);
    return next(error);
  }
};

const updateSong = async (req, res, next) => {
  try {
    const song = await songService.updateSong(req.params.id, req.body);

    return successResponse(res, "Song updated successfully", song);
  } catch (error) {
    return next(error);
  }
};

const deleteSong = async (req, res, next) => {
  try {
    const song = await songService.deleteSong(req.params.id);

    return successResponse(res, "Song deleted successfully", song);
  } catch (error) {
    return next(error);
  }
};

const incrementPlayCount = async (req, res, next) => {
  try {
    const song = await songService.incrementPlayCount(req.params.id);

    return successResponse(res, "Song play count increased successfully", song);
  } catch (error) {
    return next(error);
  }
};

const listenToSong = async (req, res, next) => {
  try {
    const result = await songService.listenToSong(req.params.id, req.user?.id);

    return successResponse(res, "Song listened successfully", result);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getSongs,
  getMySongs,
  searchSongs,
  getSongById,
  getSongWaveform,
  saveSongWaveform,
  createSong,
  uploadSong,
  updateSong,
  deleteSong,
  incrementPlayCount,
  listenToSong,
};
