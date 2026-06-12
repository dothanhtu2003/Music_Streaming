const crypto = require("crypto");
const path = require("path");
const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const { cloudinary } = require("../config/cloudinary");
const AppError = require("../utils/appError");

const AUDIO_MAX_SIZE = 20 * 1024 * 1024;
const COVER_MAX_SIZE = 5 * 1024 * 1024;
const AVATAR_MAX_SIZE = 2 * 1024 * 1024;

const CLOUDINARY_FOLDERS = {
  audio: "music-streaming/audio",
  cover: "music-streaming/covers",
  avatar: "music-streaming/avatars",
};

const audioMimeTypes = new Set(["audio/mpeg", "audio/mp3"]);
const imageMimeTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
]);
const audioExtensions = new Set([".mp3"]);
const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const isAudioField = (fieldName) => {
  return fieldName === "audio" || fieldName === "audio_file";
};

const isCoverField = (fieldName) => {
  return fieldName === "cover" || fieldName === "cover_image";
};

const isAvatarField = (fieldName) => {
  return fieldName === "avatar";
};

const getAudioExtension = (mimetype) => {
  if (!audioMimeTypes.has(mimetype)) {
    return null;
  }

  return ".mp3";
};

const getImageExtension = (mimetype) => {
  return imageMimeTypes.get(mimetype) || null;
};

const getOriginalExtension = (file) => {
  return path.extname(file.originalname || "").toLowerCase();
};

const getUploadedFile = (req, fieldName, aliases = []) => {
  const fieldNames = [fieldName, ...aliases];

  for (const currentFieldName of fieldNames) {
    const files = req.files?.[currentFieldName];

    if (Array.isArray(files) && files.length > 0) {
      return files[0];
    }
  }

  return null;
};

const getUploadedFileUrl = (file) => {
  return file?.secure_url || file?.path || null;
};

const getFileUploadType = (file, fallbackType = null) => {
  if (isAvatarField(file.fieldname)) {
    return "avatar";
  }

  if (isAudioField(file.fieldname)) {
    return "audio";
  }

  if (isCoverField(file.fieldname)) {
    return "cover";
  }

  if (fallbackType) {
    return fallbackType;
  }

  if (audioMimeTypes.has(file.mimetype)) {
    return "audio";
  }

  if (imageMimeTypes.has(file.mimetype)) {
    return "cover";
  }

  return null;
};

const getAllowedConfig = (uploadType) => {
  if (uploadType === "audio") {
    return {
      resourceType: "video",
      allowedFormats: ["mp3"],
      getExtension: getAudioExtension,
      allowedExtensions: audioExtensions,
      errorMessage: "Invalid audio format. Only MP3 files are allowed",
    };
  }

  return {
    resourceType: "image",
    allowedFormats: ["jpg", "jpeg", "png", "webp"],
    getExtension: getImageExtension,
    allowedExtensions: imageExtensions,
    errorMessage:
      uploadType === "avatar"
        ? "Invalid avatar format. Only JPG, PNG, and WebP images are allowed"
        : "Invalid cover format. Only JPG, PNG, and WebP images are allowed",
  };
};

const validateFileType = (file, uploadType) => {
  const config = getAllowedConfig(uploadType);
  const extension = config.getExtension(file.mimetype);
  const originalExtension = getOriginalExtension(file);

  if (!extension || !config.allowedExtensions.has(originalExtension)) {
    throw new AppError(config.errorMessage, 400);
  }
};

const createFileFilter = (fallbackType = null) => {
  return (req, file, cb) => {
    const uploadType = getFileUploadType(file, fallbackType);

    if (!uploadType) {
      return cb(
        new AppError(
          "Invalid file field. Use audio/audio_file and cover/cover_image",
          400
        )
      );
    }

    try {
      validateFileType(file, uploadType);
      return cb(null, true);
    } catch (error) {
      return cb(error);
    }
  };
};

const createCloudinaryStorage = (fallbackType = null) => {
  return new CloudinaryStorage({
    cloudinary,
    params: async (req, file) => {
      const uploadType = getFileUploadType(file, fallbackType);

      if (!uploadType) {
        throw new AppError(
          "Invalid file field. Use audio/audio_file and cover/cover_image",
          400
        );
      }

      validateFileType(file, uploadType);

      const config = getAllowedConfig(uploadType);
      const userPrefix = req.user?.id || "user";
      const publicId =
        uploadType === "avatar"
          ? `${userPrefix}-${Date.now()}-${crypto.randomBytes(8).toString("hex")}`
          : crypto.randomUUID();

      return {
        folder: CLOUDINARY_FOLDERS[uploadType],
        resource_type: config.resourceType,
        allowed_formats: config.allowedFormats,
        public_id: publicId,
      };
    },
  });
};

const getCloudinaryResourceType = (file) => {
  const uploadType = getFileUploadType(file);

  return uploadType === "audio" ? "video" : "image";
};

const logCloudinaryCleanupFailure = (file, error, resourceType) => {
  const publicId = file?.filename || "unknown";
  const fieldName = file?.fieldname || "unknown";
  const message = error?.message || "Unknown cleanup error";
  const code = error?.code || error?.error?.code || "unknown";
  const httpStatus =
    error?.http_code || error?.httpStatus || error?.statusCode || "unknown";

  console.warn(
    `[CLOUDINARY_CLEANUP_FAILED] public_id=${publicId} field=${fieldName} resource_type=${resourceType} error=${message} code=${code} http_status=${httpStatus}`
  );
};

const removeUploadedFile = async (file) => {
  if (!file?.filename) {
    return;
  }

  const resourceType = getCloudinaryResourceType(file);

  await cloudinary.uploader
    .destroy(file.filename, {
      resource_type: resourceType,
      invalidate: true,
    })
    .catch((error) => {
      logCloudinaryCleanupFailure(file, error, resourceType);
    });
};

const removeUploadedFiles = async (files = []) => {
  await Promise.all(files.map((file) => removeUploadedFile(file)));
};

const validateTrackUpload = async (req, res, next) => {
  const audioFile = getUploadedFile(req, "audio", ["audio_file"]);
  const coverFile = getUploadedFile(req, "cover", ["cover_image"]);
  const files = Object.values(req.files || {}).flat();

  try {
    if (!audioFile) {
      await removeUploadedFiles(files);
      return next(new AppError("Audio file is required", 400));
    }

    if (coverFile && coverFile.size > COVER_MAX_SIZE) {
      await removeUploadedFiles(files);
      return next(new AppError("Cover file is too large", 413));
    }

    return next();
  } catch (error) {
    await removeUploadedFiles(files);
    return next(error);
  }
};

const audioMulter = multer({
  storage: createCloudinaryStorage("audio"),
  limits: {
    fileSize: AUDIO_MAX_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter("audio"),
});

const coverMulter = multer({
  storage: createCloudinaryStorage("cover"),
  limits: {
    fileSize: COVER_MAX_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter("cover"),
});

const avatarMulter = multer({
  storage: createCloudinaryStorage("avatar"),
  limits: {
    fileSize: AVATAR_MAX_SIZE,
    files: 1,
  },
  fileFilter: createFileFilter("avatar"),
});

const trackMulter = multer({
  storage: createCloudinaryStorage(),
  limits: {
    fileSize: AUDIO_MAX_SIZE,
    files: 2,
  },
  fileFilter: createFileFilter(),
});

const uploadAudio = [audioMulter.single("file")];

const uploadCover = [coverMulter.single("file")];

const uploadAvatar = [avatarMulter.single("avatar")];

const uploadTrack = [
  trackMulter.fields([
    { name: "audio", maxCount: 1 },
    { name: "audio_file", maxCount: 1 },
    { name: "cover", maxCount: 1 },
    { name: "cover_image", maxCount: 1 },
  ]),
  validateTrackUpload,
];

module.exports = {
  uploadAudio,
  uploadCover,
  uploadAvatar,
  uploadTrack,
  getUploadedFile,
  getUploadedFileUrl,
  removeUploadedFiles,
  removeUploadedFile,
};
